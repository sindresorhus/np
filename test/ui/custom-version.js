import {PassThrough} from 'node:stream';
import test from 'node:test';
import assert from 'node:assert/strict';
import inquirer from 'inquirer';
import {npmConfig} from '../../source/package-manager/configs.js';
import {mockInquirer} from '../_helpers/mock-inquirer.js';

for (const {input: invalidVersion, message} of [
	{input: 'not-a-version', message: 'Custom version not-a-version should be a valid SemVer version.'},
	{input: 'major', message: 'Custom version should not be a SemVer increment.'},
	{input: '1.0.0', message: 'Custom version 1.0.0 should be higher than current version 1.0.0.'},
	{input: '0.9.0', message: 'Custom version 0.9.0 should be higher than current version 1.0.0.'},
]) {
	test(`the custom version prompt allows correcting ${invalidVersion}`, {timeout: 5000}, async t => {
		let customVersion;
		const {ui} = await mockInquirer({
			t,
			answers: {version: 'Other (specify)', customVersion: '2.0.0'},
			onPrompt(prompts) {
				customVersion = prompts.customVersion;
			},
			mocks: {
				'./util.js': {getPreReleasePrefix: async () => ''},
				'./git-util.js': {
					latestTagOrFirstCommit: async () => 'v1.0.0',
					commitLogFromRevision: async () => 'A change abc123',
				},
				execa: {execa: async () => ({stdout: 'https://registry.npmjs.org/'})},
			},
		});
		await ui({packageManager: npmConfig, runPublish: false, availability: {}}, {package_: {name: 'fixture', version: '1.0.0'}});

		const input = new PassThrough();
		const output = new PassThrough();
		t.after(() => {
			input.destroy();
			output.destroy();
		});
		const prompt = inquirer.createPromptModule({input, output, signal: t.signal});
		let terminalOutput = '';
		let hasSubmitted = false;
		let hasCorrected = false;
		output.on('data', chunk => {
			terminalOutput += chunk;
			if (!hasSubmitted && terminalOutput.includes('Version')) {
				hasSubmitted = true;
				setImmediate(() => input.write(`${invalidVersion}\n`));
			}

			if (!hasCorrected && terminalOutput.includes(message)) {
				hasCorrected = true;
				setImmediate(() => input.write('\u{15}2.0.0\n'));
			}
		});

		// Use Inquirer's actual validation and filtering order, including a retry after invalid input.
		const answers = await prompt({customVersion});
		assert.equal(answers.customVersion.toString(), '2.0.0');
		assert.equal(hasCorrected, true);
	});
}
