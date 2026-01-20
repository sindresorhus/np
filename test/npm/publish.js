import test from 'ava';
import {getPackagePublishArguments} from '../../source/npm/publish.js';

test('no options set', t => {
	t.deepEqual(
		getPackagePublishArguments({}),
		['publish'],
	);
});

test('options.contents - normalizes relative path', t => {
	t.deepEqual(
		getPackagePublishArguments({contents: 'dist'}),
		['publish', './dist'],
	);
});

test('options.contents - preserves ./ prefix', t => {
	t.deepEqual(
		getPackagePublishArguments({contents: './dist'}),
		['publish', './dist'],
	);
});

test('options.contents - preserves ../ prefix', t => {
	t.deepEqual(
		getPackagePublishArguments({contents: '../dist'}),
		['publish', '../dist'],
	);
});

test('options.contents - preserves absolute path', t => {
	t.deepEqual(
		getPackagePublishArguments({contents: '/absolute/path'}),
		['publish', '/absolute/path'],
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
