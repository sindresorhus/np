import test from 'ava';
import esmock from 'esmock';

const MOCK_REPO_URL = 'https://github.com/unicorn/rainbow';
const MOCK_COMMIT_HASH = '5063f8a';
const MOCK_COMMIT_RANGE = `${MOCK_COMMIT_HASH}...master`;

const verifyLinks = test.macro(async (t, {linksSupported}, assertions) => {
	/** @type {typeof import('../../source/util.js')} */
	const util = await esmock('../../source/util.js', {}, {
		'supports-hyperlinks': {
			stdout: linksSupported,
			stderr: linksSupported,
		},
	});

	await assertions({t, util});
});

test('linkifyIssues correctly links issues', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyIssues}}) => {
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes #3 #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/3#3]8;; ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes foo/bar#4'), 'Commit message - fixes ]8;;https://github.com/foo/bar/issues/4foo/bar#4]8;;');
});

test('linkifyIssues returns raw message if url is not provided', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyIssues}}) => {
	const message = 'Commit message - fixes #5';
	t.is(linkifyIssues(undefined, message), message);
});

test('linkifyIssues returns raw message if terminalLink is not supported', verifyLinks, {
	linksSupported: false,
}, ({t, util: {linkifyIssues}}) => {
	const message = 'Commit message - fixes #6';
	t.is(linkifyIssues(MOCK_REPO_URL, message), message);
});

test('linkifyCommit correctly links commits', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyCommit}}) => {
	t.is(linkifyCommit(MOCK_REPO_URL, MOCK_COMMIT_HASH), ']8;;https://github.com/unicorn/rainbow/commit/5063f8a5063f8a]8;;');
});

test('linkifyCommit returns raw commit hash if url is not provided', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyCommit}}) => {
	t.is(linkifyCommit(undefined, MOCK_COMMIT_HASH), MOCK_COMMIT_HASH);
});

test('linkifyCommit returns raw commit hash if terminalLink is not supported', verifyLinks, {
	linksSupported: false,
}, ({t, util: {linkifyCommit}}) => {
	t.is(linkifyCommit(MOCK_REPO_URL, MOCK_COMMIT_HASH), MOCK_COMMIT_HASH);
});

test('linkifyCommitRange returns raw commitRange if url is not provided', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyCommitRange}}) => {
	t.is(linkifyCommitRange(undefined, MOCK_COMMIT_RANGE), MOCK_COMMIT_RANGE);
});

test('linkifyCommitRange returns raw commitRange if terminalLink is not supported', verifyLinks, {
	linksSupported: false,
}, ({t, util: {linkifyCommitRange}}) => {
	t.is(linkifyCommitRange(MOCK_REPO_URL, MOCK_COMMIT_RANGE), MOCK_COMMIT_RANGE);
});

test('linkifyCommitRange correctly links commit range', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyCommitRange}}) => {
	t.is(linkifyCommitRange(MOCK_REPO_URL, MOCK_COMMIT_RANGE), ']8;;https://github.com/unicorn/rainbow/compare/5063f8a...master5063f8a...master]8;;');
});
