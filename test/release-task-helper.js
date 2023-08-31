import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';

const verifyRelease = test.macro(async (t, {oldVersion, newVersion, prefixes = {}, like}) => {
	const repoUrl = 'https://github.com/sindresorhus/np';

	/** @type {import('../source/release-task-helper.js')} */
	const {default: releaseTaskHelper} = await esmock('../source/release-task-helper.js', import.meta.url, {
		open: sinon.stub(),
		'../source/util.js': {
			getTagVersionPrefix: async () => prefixes.tag ?? 'v',
			getPreReleasePrefix: async () => prefixes.preRelease ?? '',
		},
		'new-github-release-url': options_ => t.like(options_, {repoUrl, ...like}),
	});

	await releaseTaskHelper(
		{version: newVersion, repoUrl, releaseNotes: sinon.stub()},
		{version: oldVersion},
	);
});

// TODO: test `body`

test('main', verifyRelease, {
	oldVersion: '1.0.0',
	newVersion: '1.1.0',
	like: {
		tag: 'v1.1.0',
		isPrerelease: false,
	},
});

test('handles increment as new version', verifyRelease, {
	oldVersion: '1.0.0',
	newVersion: 'minor',
	like: {
		tag: 'v1.1.0',
		isPrerelease: false,
	},
});

test('uses resolved prefix', verifyRelease, {
	oldVersion: '1.0.0',
	newVersion: '1.1.0',
	prefixes: {tag: 'ver'},
	like: {
		tag: 'ver1.1.0',
	},
});

test('prerelease', verifyRelease, {
	oldVersion: '1.0.0',
	newVersion: 'prerelease',
	prefixes: {preRelease: 'beta'},
	like: {
		tag: 'v1.0.1-beta.0',
		isPrerelease: true,
	},
});
