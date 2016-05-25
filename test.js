import test from 'ava';
import m from './';

const np = input => m.bind(m, input);

test('wrong input', t => {
	t.throws(np('foo'), 'Invalid version.');
	t.throws(np('4.x.3'), 'Invalid version.');
});
