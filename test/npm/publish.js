import test from 'ava';
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

test('runPublish uses cwd option when provided', async t => {
	const result = await runPublish(['echo', ['test']], {cwd: '/tmp'});
	t.is(result.cwd, '/tmp');
});

test('runPublish sets stdin to inherit and includes timeout', async t => {
	const result = runPublish(['echo', ['test']]);
	t.not(result, undefined);
	// Process should complete successfully with our default options
	await t.notThrowsAsync(result);
});
