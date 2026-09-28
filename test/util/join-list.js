import test from 'node:test';
import assert from 'node:assert/strict';
import stripAnsi from 'strip-ansi';
import {joinList} from '../../source/util.js';

const testJoinList = (title, {list, expected}) => {
	test(title, () => {
		const output = joinList(list);
		assert.equal(stripAnsi(output), expected);
	});
};

testJoinList('one item', {
	list: ['foo'],
	expected: '- foo',
});

testJoinList('two items', {
	list: ['foo', 'bar'],
	expected: '- foo\n- bar',
});

testJoinList('multiple items', {
	list: ['foo', 'bar', 'baz'],
	expected: '- foo\n- bar\n- baz',
});
