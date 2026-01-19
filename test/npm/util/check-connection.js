import {setTimeout} from 'node:timers/promises';
import test from 'ava';
import esmock from 'esmock';
import {_createFixture} from '../../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('success', createFixture, [{
	command: 'npm ping',
	exitCode: 0,
}], async ({t, testedModule: npm}) => {
	t.true(await npm.checkConnection());
});

test('fail', createFixture, [{
	command: 'npm ping',
	exitCode: 1,
}], async ({t, testedModule: npm}) => {
	await t.throwsAsync(
		npm.checkConnection(),
		{message: 'Connection to npm registry failed'},
	);
});

test('timeout', async t => {
	t.timeout(16_000);
	const npm = await esmock('../../../source/npm/util.js', {}, {
		execa: {execa: async () => setTimeout(16_000, {})},
	});

	await t.throwsAsync(
		npm.checkConnection(),
		{message: 'Connection to npm registry timed out'},
	);
});
