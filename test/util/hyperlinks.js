import test from 'ava';
import esmock from 'esmock';
import terminalLink from 'terminal-link';

const MOCK_REPO_URL = 'https://github.com/unicorn/rainbow';
const MOCK_COMMIT_HASH = '5063f8a';
const MOCK_COMMIT_RANGE = `${MOCK_COMMIT_HASH}...master`;

const verifyLinks = test.macro(async (t, {linksSupported}, assertions) => {
	// TODO: copy terminalLink to allow concurrent tests
	/** @type {typeof import('../../source/util.js')} */
	const util = await esmock('../../source/util.js', {
		'terminal-link': Object.assign(terminalLink, {
			isSupported: linksSupported,
		}),
	}, {
		'supports-hyperlinks': {
			stdout: linksSupported,
			stderr: linksSupported,
		},
	});

	await assertions({t, util});
});

test.serial('linkifyIssues correctly links issues', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyIssues}}) => {
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes #3 #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/3#3]8;; ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes foo/bar#4'), 'Commit message - fixes ]8;;https://github.com/foo/bar/issues/4foo/bar#4]8;;');
});

test.serial('linkifyIssues returns raw message if url is not provided', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyIssues}}) => {
	const message = 'Commit message - fixes #5';
	t.is(linkifyIssues(undefined, message), message);
});

test.serial('linkifyIssues returns raw message if terminalLink is not supported', verifyLinks, {
	linksSupported: false,
}, ({t, util: {linkifyIssues}}) => {
	const message = 'Commit message - fixes #6';
	t.is(linkifyIssues(MOCK_REPO_URL, message), message);
});

test.serial('linkifyCommit correctly links commits', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyCommit}}) => {
	t.is(linkifyCommit(MOCK_REPO_URL, MOCK_COMMIT_HASH), ']8;;https://github.com/unicorn/rainbow/commit/5063f8a5063f8a]8;;');
});

test.serial('linkifyCommit returns raw commit hash if url is not provided', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyCommit}}) => {
	t.is(linkifyCommit(undefined, MOCK_COMMIT_HASH), MOCK_COMMIT_HASH);
});

test.serial('linkifyCommit returns raw commit hash if terminalLink is not supported', verifyLinks, {
	linksSupported: false,
}, ({t, util: {linkifyCommit}}) => {
	t.is(linkifyCommit(MOCK_REPO_URL, MOCK_COMMIT_HASH), MOCK_COMMIT_HASH);
});

test.serial('linkifyCommitRange returns raw commitRange if url is not provided', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyCommitRange}}) => {
	t.is(linkifyCommitRange(undefined, MOCK_COMMIT_RANGE), MOCK_COMMIT_RANGE);
});

test.serial('linkifyCommitRange returns raw commitRange if terminalLink is not supported', verifyLinks, {
	linksSupported: false,
}, ({t, util: {linkifyCommitRange}}) => {
	t.is(linkifyCommitRange(MOCK_REPO_URL, MOCK_COMMIT_RANGE), MOCK_COMMIT_RANGE);
});

test.serial('linkifyCommitRange correctly links commit range', verifyLinks, {
	linksSupported: true,
}, ({t, util: {linkifyCommitRange}}) => {
	t.is(linkifyCommitRange(MOCK_REPO_URL, MOCK_COMMIT_RANGE), ']8;;https://github.com/unicorn/rainbow/compare/5063f8a...master5063f8a...master]8;;');
});
