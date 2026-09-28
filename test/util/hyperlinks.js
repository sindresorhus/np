import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';

const MOCK_REPO_URL = 'https://github.com/unicorn/rainbow';
const MOCK_COMMIT_HASH = '5063f8a';
const MOCK_COMMIT_RANGE = `${MOCK_COMMIT_HASH}...master`;

const verifyLinks = (title, {linksSupported}, assertions) => {
	test(title, async () => {
		/**
		@type {typeof import('../../source/util.js')}
		*/
		const util = await esmock('../../source/util.js', {}, {
			'supports-hyperlinks': {
				stdout: linksSupported,
				stderr: linksSupported,
			},
		});

		await assertions({util});
	});
};

verifyLinks('linkifyIssues correctly links issues', {
	linksSupported: true,
}, ({util: {linkifyIssues}}) => {
	assert.equal(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	assert.equal(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes #3 #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/3#3]8;; ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	assert.equal(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes foo/bar#4'), 'Commit message - fixes ]8;;https://github.com/foo/bar/issues/4foo/bar#4]8;;');
});

verifyLinks('linkifyIssues returns raw message if url is not provided', {
	linksSupported: true,
}, ({util: {linkifyIssues}}) => {
	const message = 'Commit message - fixes #5';
	assert.equal(linkifyIssues(undefined, message), message);
});

verifyLinks('linkifyIssues returns raw message if terminalLink is not supported', {
	linksSupported: false,
}, ({util: {linkifyIssues}}) => {
	const message = 'Commit message - fixes #6';
	assert.equal(linkifyIssues(MOCK_REPO_URL, message), `${message} ${MOCK_REPO_URL}/issues/6`);
});

verifyLinks('linkifyCommit correctly links commits', {
	linksSupported: true,
}, ({util: {linkifyCommit}}) => {
	assert.equal(linkifyCommit(MOCK_REPO_URL, MOCK_COMMIT_HASH), ']8;;https://github.com/unicorn/rainbow/commit/5063f8a5063f8a]8;;');
});

verifyLinks('linkifyCommit returns raw commit hash if url is not provided', {
	linksSupported: true,
}, ({util: {linkifyCommit}}) => {
	assert.equal(linkifyCommit(undefined, MOCK_COMMIT_HASH), MOCK_COMMIT_HASH);
});

verifyLinks(
	'linkifyCommit returns raw commit hash if terminalLink is not supported',
	{
		linksSupported: false,
	},
	({util: {linkifyCommit}}) => {
		assert.equal(linkifyCommit(MOCK_REPO_URL, MOCK_COMMIT_HASH), `${MOCK_COMMIT_HASH} ${MOCK_REPO_URL}/commit/${MOCK_COMMIT_HASH}`);
	},
);

verifyLinks('linkifyCommitRange returns raw commitRange if url is not provided', {
	linksSupported: true,
}, ({util: {linkifyCommitRange}}) => {
	assert.equal(linkifyCommitRange(undefined, MOCK_COMMIT_RANGE), MOCK_COMMIT_RANGE);
});

verifyLinks(
	'linkifyCommitRange returns raw commitRange if terminalLink is not supported',
	{
		linksSupported: false,
	},
	({util: {linkifyCommitRange}}) => {
		assert.equal(linkifyCommitRange(MOCK_REPO_URL, MOCK_COMMIT_RANGE), `${MOCK_COMMIT_RANGE} ${MOCK_REPO_URL}/compare/${MOCK_COMMIT_RANGE}`);
	},
);

verifyLinks('linkifyCommitRange correctly links commit range', {
	linksSupported: true,
}, ({util: {linkifyCommitRange}}) => {
	assert.equal(linkifyCommitRange(MOCK_REPO_URL, MOCK_COMMIT_RANGE), ']8;;https://github.com/unicorn/rainbow/compare/5063f8a...master5063f8a...master]8;;');
});
