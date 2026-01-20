import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';

const verifyRelease = test.macro(async (t, {oldVersion, newVersion, prefixes = {}, like}) => {
	const repoUrl = 'https://github.com/sindresorhus/np';

	/** @type {import('../source/release-task-helper.js')} */
	const {default: releaseTaskHelper} = await esmock('../source/release-task-helper.js', import.meta.url, {
		open: sinon.stub(),
		clipboardy: {
			write: sinon.stub(),
		},
		'../source/util.js': {
			getTagVersionPrefix: async () => prefixes.tag ?? 'v',
			getPreReleasePrefix: async () => prefixes.preRelease ?? '',
		},
		'new-github-release-url': options_ => t.like(options_, {repoUrl, ...like}),
	});

	await releaseTaskHelper(
		{
			version: newVersion,
			repoUrl,
			releaseNotes: true,
			generateReleaseNotes: sinon.stub(),
		},
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

test('uses clipboard when URL is too long', async t => {
	const repoUrl = 'https://github.com/sindresorhus/np';
	const clipboardStub = sinon.stub();
	const openStub = sinon.stub();
	const urlCalls = [];

	// Generate a very long release notes string that will exceed the URL limit
	const longReleaseNotes = 'x'.repeat(8000);

	const {default: releaseTaskHelper} = await esmock('../source/release-task-helper.js', import.meta.url, {
		open: openStub,
		clipboardy: {
			write: clipboardStub,
		},
		'../source/util.js': {
			async getTagVersionPrefix() {
				return 'v';
			},
			async getPreReleasePrefix() {
				return '';
			},
		},
		'new-github-release-url'(options_) {
			urlCalls.push(options_);
			// Generate a realistic URL
			const baseUrl = `${options_.repoUrl}/releases/new`;
			const parameters = new URLSearchParams({
				tag: options_.tag,
				body: options_.body,
				prerelease: options_.isPrerelease ? '1' : '0',
			});
			return `${baseUrl}?${parameters.toString()}`;
		},
	});

	await releaseTaskHelper(
		{
			version: '1.1.0',
			repoUrl,
			releaseNotes: true,
			generateReleaseNotes: () => longReleaseNotes,
		},
		{version: '1.0.0'},
	);

	// Should be called twice: once with long notes, once with placeholder
	t.is(urlCalls.length, 2);
	t.is(urlCalls[0].body, longReleaseNotes);
	t.is(urlCalls[1].body, '<!-- Paste release notes from clipboard -->');
	t.true(clipboardStub.calledOnce);
	t.true(clipboardStub.calledWith(longReleaseNotes));
	t.true(openStub.calledOnce);
});

test('does not use clipboard when URL is short enough', async t => {
	const repoUrl = 'https://github.com/sindresorhus/np';
	const clipboardStub = sinon.stub();
	const openStub = sinon.stub();
	const urlCalls = [];

	const shortReleaseNotes = 'Short release notes';

	const {default: releaseTaskHelper} = await esmock('../source/release-task-helper.js', import.meta.url, {
		open: openStub,
		clipboardy: {
			write: clipboardStub,
		},
		'../source/util.js': {
			async getTagVersionPrefix() {
				return 'v';
			},
			async getPreReleasePrefix() {
				return '';
			},
		},
		'new-github-release-url'(options_) {
			urlCalls.push(options_);
			// Generate a realistic URL
			const baseUrl = `${options_.repoUrl}/releases/new`;
			const parameters = new URLSearchParams({
				tag: options_.tag,
				body: options_.body,
				prerelease: options_.isPrerelease ? '1' : '0',
			});
			return `${baseUrl}?${parameters.toString()}`;
		},
	});

	await releaseTaskHelper(
		{
			version: '1.1.0',
			repoUrl,
			releaseNotes: true,
			generateReleaseNotes: () => shortReleaseNotes,
		},
		{version: '1.0.0'},
	);

	// Should be called only once with the short notes
	t.is(urlCalls.length, 1);
	t.is(urlCalls[0].body, shortReleaseNotes);
	t.false(clipboardStub.called);
	t.true(openStub.calledOnce);
});
