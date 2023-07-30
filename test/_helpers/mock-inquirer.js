import {debuglog} from 'node:util';
import esmock from 'esmock';
import is from '@sindresorhus/is';
import stripAnsi from 'strip-ansi';
import mapObject from 'map-obj';

// NOTE: This only handles prompts of type 'input', 'list', and 'confirm'. If other prompt types are added, they must be implemented here.
// Based on https://gist.github.com/yyx990803/f61f347b6892078c40a9e8e77b9bd984

// TODO: log with AVA instead (NODE_DEBUG-'np-test')
const log = debuglog('np-test');

/** @typedef {import('ava').ExecutionContext<Record<string, never>>} ExecutionContext */
/** @typedef {string | boolean} ShortAnswer */
/** @typedef {Record<'input' | 'error', string> | Record<'choice', string> | Record<'confirm', boolean>} LongAnswer */
/** @typedef {ShortAnswer | LongAnswer} Answer */
/** @typedef {Record<string, Answer>} Answers  */
/** @typedef {import('inquirer').DistinctQuestion & {name?: never}} Prompt */

/**
@param {object} o
@param {ExecutionContext} o.t
@param {Answers} o.inputAnswers Test input
@param {Record<string, Prompt> | Prompt[]} o.prompts Actual prompts
*/
const mockPrompt = async ({t, inputAnswers, prompts}) => {
	const answers = {};

	// Ensure `prompts` is an object
	if (Array.isArray(prompts)) {
		const promptsObject = {};

		for (const prompt of prompts) {
			promptsObject[prompt.name] = prompt;
		}

		prompts = promptsObject;
	}

	log('prompts:', Object.keys(prompts));

	/* eslint-disable no-await-in-loop */
	for (const [name, prompt] of Object.entries(prompts)) {
		if (prompt.when !== undefined) {
			if (is.boolean(prompt.when) && !prompt.when) {
				log(`skipping prompt '${name}'`);
				continue;
			}

			if (is.function_(prompt.when) && !prompt.when(answers)) {
				log(`skipping prompt '${name}'`);
				continue;
			}
		}

		log(`getting input for prompt '${name}'`);

		const setValue = value => {
			if (prompt.validate) {
				const result = prompt.validate(value);

				if (result !== true) {
					if (is.string(result)) {
						throw new Error(result);
					}

					if (result === false) {
						throw new Error('You must provide a valid value');
					}
				}
			}

			if (is.string(value)) {
				log(`filtering value '${value}' for prompt '${name}'`);
			} else {
				log(`filtering value for prompt '${name}':`, value);
			}

			answers[name] = prompt.filter
				? prompt.filter(value) // eslint-disable-line unicorn/no-array-callback-reference
				: value;

			log(`got value '${answers[name]}' for prompt '${name}'`);
		};

		/** @param {Answer} input */
		const chooseValue = async input => {
			t.is(prompt.type, 'list');
			let choices;

			if (is.asyncFunction(prompt.choices)) {
				choices = await prompt.choices(answers);
			} else if (is.function_(prompt.choices)) {
				choices = prompt.choices(answers);
			} else {
				choices = prompt.choices;
			}

			log(`choices for prompt '${name}':`, choices);

			const value = choices.find(choice => {
				if (is.object(choice)) {
					return choice.name && stripAnsi(choice.name).startsWith(input.choice ?? input);
				}

				if (is.string(choice)) {
					return stripAnsi(choice).startsWith(input.choice ?? input);
				}

				return false;
			});

			// `value.value` could exist but literally be `undefined`
			setValue(Object.hasOwn(value, 'value') ? value.value : value);
		};

		const input = inputAnswers[name];

		if (is.undefined(input)) {
			t.fail(`Expected input for prompt '${name}'.`);
			continue;
		}

		if (is.string(input)) {
			log(`found input for prompt '${name}': '${input}'`);
		} else {
			log(`found input for prompt '${name}':`, input);
		}

		/** @param {Answer} input */
		const handleInput = async input => {
			if (is.string(input)) {
				if (['input'].includes(prompt.type)) {
					setValue(input);
				} else if (['list'].includes(prompt.type)) {
					return chooseValue(input);
				} else {
					t.fail('Incorrect input type');
				}

				return;
			}

			if (input.input !== undefined) {
				t.is(prompt.type, 'input');
				setValue(input.input);
				return;
			}

			if (input.choice !== undefined) {
				await chooseValue(input);
				return;
			}

			if (is.boolean(input.confirm) || is.boolean(input)) {
				t.is(prompt.type, 'confirm');
				setValue(input.confirm ?? input);
			}
		};

		// Multiple inputs for the given prompt
		if (is.array(input)) {
			for (const attempt of input) {
				if (attempt.error) {
					await t.throwsAsync(
						handleInput(attempt),
						{message: attempt.error},
					);
				} else {
					await handleInput(attempt);
				}
			}
		}

		await handleInput(input);
	}
	/* eslint-enable no-await-in-loop */

	return answers;
};

/** @param {import('esmock').MockMap} mocks */
const fixRelativeMocks = mocks => mapObject(mocks, (key, value) => [key.replace('./', '../../source/'), value]);

/**
@param {object} o
@param {ExecutionContext} o.t
@param {Answers} o.answers
@param {import('esmock').MockMap} [o.mocks]
@param {string[]} [o.logs]
*/
export const mockInquirer = async ({t, answers, mocks = {}, logs = []}) => {
	/** @type {import('../../source/ui.js')} */
	const ui = await esmock('../../source/ui.js', import.meta.url, {
		inquirer: {
			prompt: async prompts => mockPrompt({t, inputAnswers: answers, prompts}),
		},
	}, {
		...fixRelativeMocks(mocks),
		// Mock globals
		import: {
			console: {log: (...args) => logs.push(...args)},
		},
	});

	return {ui, logs};
};
