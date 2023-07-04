import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';
import stripAnsi from 'strip-ansi';
import {oneLine} from 'common-tags';

const checkIgnoreStrategy = test.macro(async (t, {fixture = '', files, expected = ''} = {}) => {
	let output = '';

	/** @type {import('../../../source/npm/util.js')} */
	const {checkIgnoreStrategy} = await esmock('../../../source/npm/util.js', {
		import: {console: {log: (...args) => output = args.join('')}}, // eslint-disable-line no-return-assign
	});

	const fixtureDir = path.resolve('test/fixtures/files', fixture);
	const pkg = files ? {files} : {};

	await checkIgnoreStrategy(pkg, fixtureDir);

	output = stripAnsi(output).trim();
	t.is(output, expected);
});

const ignoreStrategyMessage = oneLine`
	Warning: No files field specified in package.json nor is a .npmignore file present.
	Having one of those will prevent you from accidentally publishing development-specific files along with your package's source code to npm.
`;

test('no files, no .npmignore', checkIgnoreStrategy, {fixture: 'main', expected: ignoreStrategyMessage});

test('no files w/ .npmignore', checkIgnoreStrategy, {fixture: 'npmignore', expected: ''});

test('files, no .npmignore', checkIgnoreStrategy, {fixture: 'main', files: ['index.js'], expected: ''});

test('files w/ .npmignore', checkIgnoreStrategy, {fixture: 'npmignore', files: ['index.js'], expected: ''});
