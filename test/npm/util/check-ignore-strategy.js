import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import stripAnsi from 'strip-ansi';
import {oneLine} from 'common-tags';

const checkIgnoreStrategy = (title, {fixture = '', files, expected = ''} = {}) => {
	test(title, async () => {
		let output = '';

		/**
		@type {import('../../../source/npm/util.js')}
		*/
		const {checkIgnoreStrategy: checkIgnoreStrategyUnderTest} = await esmock('../../../source/npm/util.js', {
			import: {console: {log: (...arguments_) => output = arguments_.join('')}}, // eslint-disable-line no-return-assign
		});

		const fixtureDirectory = path.resolve('test/fixtures/files', fixture);
		const package_ = files ? {files} : {};

		await checkIgnoreStrategyUnderTest(package_, fixtureDirectory);

		output = stripAnsi(output).trim();
		assert.equal(output, expected);
	});
};

const ignoreStrategyMessage = oneLine`
    Warning: No files field specified in package.json nor is a .npmignore file present.
    Having one of those will prevent you from accidentally publishing development-specific files along with your package's source code to npm.
`;

checkIgnoreStrategy(
	'no files, no .npmignore',
	{fixture: 'main', expected: ignoreStrategyMessage},
);

checkIgnoreStrategy('no files w/ .npmignore', {fixture: 'npmignore', expected: ''});

checkIgnoreStrategy(
	'files, no .npmignore',
	{fixture: 'main', files: ['index.js'], expected: ''},
);

checkIgnoreStrategy(
	'files w/ .npmignore',
	{fixture: 'npmignore', files: ['index.js'], expected: ''},
);
