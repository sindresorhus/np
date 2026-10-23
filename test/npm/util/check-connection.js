import assert from 'node:assert/strict';
import {_createFixture} from '../../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../../source/npm/util.js')>>}
*/
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

createFixture('success', [{
	command: 'npm ping',
	exitCode: 0,
	options: {timeout: 15_000},
}], async ({
	testedModule: npm,
}) => {
	assert.ok(await npm.checkConnection());
});

createFixture('fail', [{
	command: 'npm ping',
	exitCode: 1,
}], async ({
	testedModule: npm,
}) => {
	await assert.rejects(
		npm.checkConnection(),
		{message: 'Connection to npm registry failed'},
	);
});

createFixture('timeout', [{
	command: 'npm ping',
	exitCode: 1,
	timedOut: true,
}], async ({
	testedModule: npm,
}) => {
	await assert.rejects(
		npm.checkConnection(),
		{message: 'Connection to npm registry timed out', isPresentable: true},
	);
});
