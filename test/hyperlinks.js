import test from 'ava';
import sinon from 'sinon';
import terminalLink from 'terminal-link';
import {linkifyIssues, linkifyCommit, linkifyCommitRange} from '../source/util';

const MOCK_REPO_URL = 'https://github.com/unicorn/rainbow';
const MOCK_COMMIT_HASH = '5063f8a';
const MOCK_COMMIT_RANGE = `${MOCK_COMMIT_HASH}...master`;

const sandbox = sinon.createSandbox();

test.afterEach(() => {
	sandbox.restore();
});

const mockTerminalLinkUnsupported = () =>
	sandbox.stub(terminalLink, 'isSupported').value(false);

test('linkifyIssues correctly links issues', t => {
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes #3 #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/3#3]8;; ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	t.is(linkifyIssues(MOCK_REPO_URL, 'Commit message - fixes foo/bar#4'), 'Commit message - fixes ]8;;https://github.com/foo/bar/issues/4foo/bar#4]8;;');
});

test('linkifyIssues returns raw message if url is not provided', t => {
	const msg = 'Commit message - fixes #5';
	t.is(linkifyIssues(undefined, msg), msg);
});

test.serial('linkifyIssues returns raw message if terminalLink is not supported', t => {
	mockTerminalLinkUnsupported();
	const msg = 'Commit message - fixes #6';
	t.is(linkifyIssues(MOCK_REPO_URL, msg), msg);
});

test('linkifyCommit correctly links commits', t => {
	t.is(linkifyCommit(MOCK_REPO_URL, MOCK_COMMIT_HASH), ']8;;https://github.com/unicorn/rainbow/commit/5063f8a5063f8a]8;;');
});

test('linkifyCommit returns raw commit hash if url is not provided', t => {
	t.is(linkifyCommit(undefined, MOCK_COMMIT_HASH), MOCK_COMMIT_HASH);
});

test.serial('linkifyCommit returns raw commit hash if terminalLink is not supported', t => {
	mockTerminalLinkUnsupported();
	t.is(linkifyCommit(MOCK_REPO_URL, MOCK_COMMIT_HASH), MOCK_COMMIT_HASH);
});

test('linkifyCommitRange returns raw commitRange if url is not provided', t => {
	t.is(linkifyCommitRange(undefined, MOCK_COMMIT_RANGE), MOCK_COMMIT_RANGE);
});

test.serial('linkifyCommitRange returns raw commitRange if terminalLink is not supported', t => {
	mockTerminalLinkUnsupported();
	t.is(linkifyCommitRange(MOCK_REPO_URL, MOCK_COMMIT_RANGE), MOCK_COMMIT_RANGE);
});
