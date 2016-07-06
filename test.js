import test from 'ava';
import m from './';

test('wrong input', t => {
	t.throws(m('foo'), 'Version should be either major, minor, patch, premajor, preminor, prepatch, prerelease, or a valid semver version.');
	t.throws(m('4.x.3'), 'Version should be either major, minor, patch, premajor, preminor, prepatch, prerelease, or a valid semver version.');
});
