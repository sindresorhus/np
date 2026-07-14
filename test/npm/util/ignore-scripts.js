import process from 'node:process';
import test from 'ava';
import {_createFixture} from '../../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('reads pnpm ignore-scripts setting', createFixture, [{
	command: 'npm config get ignore-scripts',
	stdout: 'false',
}, {
	command: 'pnpm config get ignore-scripts',
	stdout: 'true',
}], async ({t, testedModule: {isIgnoreScriptsEnabled}}) => {
	t.true(await isIgnoreScriptsEnabled(process.cwd(), 'pnpm'));
});

test('reads Yarn ignore-scripts setting', createFixture, [{
	command: 'npm config get ignore-scripts',
	stdout: 'false',
}, {
	command: 'yarn config get ignore-scripts',
	stdout: 'true',
}], async ({t, testedModule: {isIgnoreScriptsEnabled}}) => {
	t.true(await isIgnoreScriptsEnabled(process.cwd(), 'yarn'));
});
