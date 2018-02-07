import test from 'ava';
import m from '../lib/util';

test('link issues', t => {
	t.is(m.linkifyIssues('https://github.com/unicorn/rainbow', 'Commit message - fixes #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	t.is(m.linkifyIssues('https://github.com/unicorn/rainbow', 'Commit message - fixes #3 #4'), 'Commit message - fixes ]8;;https://github.com/unicorn/rainbow/issues/3#3]8;; ]8;;https://github.com/unicorn/rainbow/issues/4#4]8;;');
	t.is(m.linkifyIssues('https://github.com/unicorn/rainbow', 'Commit message - fixes foo/bar#4'), 'Commit message - fixes ]8;;https://github.com/foo/bar/issues/4foo/bar#4]8;;');
});

test('link commit', t => {
	t.is(m.linkifyCommit('https://github.com/unicorn/rainbow', '5063f8a'), ']8;;https://github.com/unicorn/rainbow/commit/5063f8a5063f8a]8;;');
});
