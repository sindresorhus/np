import test from 'ava';
import publish, {getPackagePublishArguments} from '../../source/npm/publish.js';

test('getPackagePublishArguments - no options set', t => {
	t.deepEqual(
		getPackagePublishArguments({}),
		['publish'],
	);
});

test('getPackagePublishArguments - options.contents', t => {
	t.deepEqual(
		getPackagePublishArguments({contents: 'dist'}),
		['publish', 'dist'],
	);
});

test('getPackagePublishArguments - options.tag', t => {
	t.deepEqual(
		getPackagePublishArguments({tag: 'beta'}),
		['publish', '--tag', 'beta'],
	);
});

test('getPackagePublishArguments - options.otp', t => {
	t.deepEqual(
		getPackagePublishArguments({otp: '123456'}),
		['publish', '--otp', '123456'],
	);
});

test('getPackagePublishArguments - options.publishScoped', t => {
	t.deepEqual(
		getPackagePublishArguments({publishScoped: true}),
		['publish', '--access', 'public'],
	);
});
