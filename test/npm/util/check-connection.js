import test from 'ava';
import {_createFixture} from '../../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('success', createFixture, [{
	command: 'npm ping',
	exitCode: 0,
	options: {timeout: 15_000},
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

test('timeout', createFixture, [{
	command: 'npm ping',
	exitCode: 1,
	timedOut: true,
}], async ({t, testedModule: npm}) => {
	await t.throwsAsync(
		npm.checkConnection(),
		{message: 'Connection to npm registry timed out'},
	);
});
