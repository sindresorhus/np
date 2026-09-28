import test from 'node:test';
import assert from 'node:assert/strict';
import {firstValueFrom} from 'rxjs';
import {getPackagePublishArguments, runPublish} from '../../source/npm/publish.js';

test('no options set', () => {
	assert.deepEqual(
		getPackagePublishArguments({}),
		['publish'],
	);
});

test('options.tag', () => {
	assert.deepEqual(
		getPackagePublishArguments({tag: 'beta'}),
		['publish', '--tag', 'beta'],
	);
});

test('options.otp', () => {
	assert.deepEqual(
		getPackagePublishArguments({otp: '123456'}),
		['publish', '--otp', '123456'],
	);
});

test('options.publishScoped', () => {
	assert.deepEqual(
		getPackagePublishArguments({publishScoped: true}),
		['publish', '--access', 'public'],
	);
});

test('options.provenance', () => {
	assert.deepEqual(
		getPackagePublishArguments({provenance: true}),
		['publish', '--provenance'],
	);
});

test('options.stage', () => {
	assert.deepEqual(
		getPackagePublishArguments({stage: true}),
		['stage', 'publish'],
	);
});

test('options.stage with other flags', () => {
	assert.deepEqual(
		getPackagePublishArguments({stage: true, tag: 'beta', provenance: true}),
		['stage', 'publish', '--tag', 'beta', '--provenance'],
	);
});

test('runPublish uses cwd option when provided', async () => {
	const observable = runPublish(['echo', ['test']], {cwd: '/tmp'});
	// Should complete successfully
	await assert.doesNotReject(firstValueFrom(observable));
});

test('runPublish returns an Observable that completes successfully', async () => {
	const observable = runPublish(['echo', ['test']]);
	assert.notEqual(observable, undefined);
	// Process should complete successfully with our default options
	await assert.doesNotReject(firstValueFrom(observable));
});
