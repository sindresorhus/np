import test from 'node:test';
import assert from 'node:assert/strict';
import stripAnsi from 'strip-ansi';
import {groupFilesInFolders} from '../../source/util.js';

const testJoinList = (title, {list, expected}) => {
	test(title, () => {
		const output = groupFilesInFolders(list);
		assert.equal(stripAnsi(output), expected);
	});
};

testJoinList('one item', {
	list: [
		'scripts/a.sh',
	],
	expected: '- scripts/a.sh',
});

testJoinList('top-level files', {
	list: [
		'index.js',
		'readme.md',
	],
	expected: `- index.js
- readme.md`,
});

testJoinList('mix of collapsed and expanded folders', {
	list: [
		'scripts/a.sh',
		'scripts/b.sh',
		'scripts/c.sh',
		'test/_utils-1.js',
		'test/_utils-2.js',
		'test/_utils-3.js',
		'test/_utils-4.js',
		'test/_utils-5.js',
		'test/_utils-6.js',
	],
	expected: `- scripts/a.sh
- scripts/b.sh
- scripts/c.sh
- test/* (6 files)`,
});
