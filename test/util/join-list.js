import test from 'ava';
import stripAnsi from 'strip-ansi';
import {joinList} from '../../source/util.js';

const testJoinList = test.macro((t, {list, expected}) => {
	const output = joinList(list);
	t.is(stripAnsi(output), expected);
});

test('one item', testJoinList, {
	list: ['foo'],
	expected: '- foo',
});

test('two items', testJoinList, {
	list: ['foo', 'bar'],
	expected: '- foo\n- bar',
});

test('multiple items', testJoinList, {
	list: ['foo', 'bar', 'baz'],
	expected: '- foo\n- bar\n- baz',
});
