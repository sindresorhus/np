import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import esmock from 'esmock';

const verifyRelease = (title, {oldVersion, newVersion, prefixes = {}, like}) => {
	test(title, async () => {
		const repoUrl = 'https://github.com/sindresorhus/np';

		/**
		@type {import('../source/release-task-helper.js')}
		*/
		const {default: releaseTaskHelper} = await esmock('../source/release-task-helper.js', import.meta.url, {
			open: sinon.stub(),
			clipboardy: {
				write: sinon.stub(),
			},
			'../source/util.js': {
				getTagVersionPrefix: async () => prefixes.tag ?? 'v',
				getPreReleasePrefix: async () => prefixes.preRelease ?? '',
			},
			'new-github-release-url'(options) {
				assert.partialDeepStrictEqual(options, {repoUrl, ...like});

				// The real module returns a URL string, and `releaseTaskHelper` reads `.length`
				// on it to decide whether the release notes fit in the URL.
				return 'https://github.com/sindresorhus/np/releases/new';
			},
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
};

// TODO: test `body`

verifyRelease('main', {
	oldVersion: '1.0.0',
	newVersion: '1.1.0',
	like: {
		tag: 'v1.1.0',
		isPrerelease: false,
	},
});

verifyRelease('handles increment as new version', {
	oldVersion: '1.0.0',
	newVersion: 'minor',
	like: {
		tag: 'v1.1.0',
		isPrerelease: false,
	},
});

verifyRelease('uses resolved prefix', {
	oldVersion: '1.0.0',
	newVersion: '1.1.0',
	prefixes: {tag: 'ver'},
	like: {
		tag: 'ver1.1.0',
	},
});

verifyRelease('prerelease', {
	oldVersion: '1.0.0',
	newVersion: 'prerelease',
	prefixes: {preRelease: 'beta'},
	like: {
		tag: 'v1.0.1-beta.0',
		isPrerelease: true,
	},
});

test('uses clipboard when URL is too long', async () => {
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
	assert.equal(urlCalls.length, 2);
	assert.equal(urlCalls[0].body, longReleaseNotes);
	assert.equal(urlCalls[1].body, '<!-- Paste release notes from clipboard -->');
	assert.ok(clipboardStub.calledOnce);
	assert.ok(clipboardStub.calledWith(longReleaseNotes));
	assert.ok(openStub.calledOnce);
});

test('does not use clipboard when URL is short enough', async () => {
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
	assert.equal(urlCalls.length, 1);
	assert.equal(urlCalls[0].body, shortReleaseNotes);
	assert.ok(!(clipboardStub.called));
	assert.ok(openStub.calledOnce);
});
