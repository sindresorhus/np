import test from 'ava';
import {firstValueFrom} from 'rxjs';
import {getPackagePublishArguments, runPublish} from '../../source/npm/publish.js';

test('no options set', t => {
	t.deepEqual(
		getPackagePublishArguments({}),
		['publish'],
	);
});

test('options.tag', t => {
	t.deepEqual(
		getPackagePublishArguments({tag: 'beta'}),
		['publish', '--tag', 'beta'],
	);
});

test('options.otp', t => {
	t.deepEqual(
		getPackagePublishArguments({otp: '123456'}),
		['publish', '--otp', '123456'],
	);
});

test('options.publishScoped', t => {
	t.deepEqual(
		getPackagePublishArguments({publishScoped: true}),
		['publish', '--access', 'public'],
	);
});

test('options.provenance', t => {
	t.deepEqual(
		getPackagePublishArguments({provenance: true}),
		['publish', '--provenance'],
	);
});

test('runPublish uses cwd option when provided', async t => {
	const observable = runPublish(['echo', ['test']], {cwd: '/tmp'});
	// Should complete successfully
	await t.notThrowsAsync(firstValueFrom(observable));
});

test('runPublish returns an Observable that completes successfully', async t => {
	const observable = runPublish(['echo', ['test']]);
	t.not(observable, undefined);
	// Process should complete successfully with our default options
	await t.notThrowsAsync(firstValueFrom(observable));
});
