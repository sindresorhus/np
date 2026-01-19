import test from 'ava';
import stripAnsi from 'strip-ansi';
import {groupFilesInFolders} from '../../source/util.js';

const testJoinList = test.macro((t, {list, expected}) => {
	const output = groupFilesInFolders(list);
	t.is(stripAnsi(output), expected);
});

test('one item', testJoinList, {
	list: [
		'scripts/a.sh',
	],
	expected: '- scripts/a.sh',
});

test('mix of collapsed and expanded folders', testJoinList, {
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
