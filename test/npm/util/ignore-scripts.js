import process from 'node:process';
import assert from 'node:assert/strict';
import {_createFixture} from '../../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../../source/npm/util.js')>>}
*/
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

createFixture('reads pnpm ignore-scripts setting', [{
	command: 'npm config get ignore-scripts',
	stdout: 'false',
}, {
	command: 'pnpm config get ignore-scripts',
	stdout: 'true',
}], async ({
	testedModule: {isIgnoreScriptsEnabled},
}) => {
	assert.ok(await isIgnoreScriptsEnabled(process.cwd(), 'pnpm'));
});

createFixture('reads Yarn ignore-scripts setting', [{
	command: 'npm config get ignore-scripts',
	stdout: 'false',
}, {
	command: 'yarn config get ignore-scripts',
	stdout: 'true',
}], async ({
	testedModule: {isIgnoreScriptsEnabled},
}) => {
	assert.ok(await isIgnoreScriptsEnabled(process.cwd(), 'yarn'));
});
