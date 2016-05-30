import test from 'ava';
import m from './';

const np = input => m.bind(m, input);

test('wrong input', t => {
	t.throws(np('foo'), 'Version should be either path, minor, major, or a valid semver version.');
	t.throws(np('4.x.3'), 'Version should be either path, minor, major, or a valid semver version.');
});
