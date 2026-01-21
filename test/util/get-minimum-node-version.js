import test from 'ava';
import {getMinimumNodeVersion} from '../../source/util.js';

test('returns minimum version from >=X range', t => {
	t.is(getMinimumNodeVersion('>=18'), '18.0.0');
	t.is(getMinimumNodeVersion('>=18.0.0'), '18.0.0');
	t.is(getMinimumNodeVersion('>=16.14.0'), '16.14.0');
});

test('returns minimum version from ^X range', t => {
	t.is(getMinimumNodeVersion('^18'), '18.0.0');
	t.is(getMinimumNodeVersion('^18.0.0'), '18.0.0');
	t.is(getMinimumNodeVersion('^16.14.0'), '16.14.0');
});

test('returns minimum version from X range', t => {
	t.is(getMinimumNodeVersion('18'), '18.0.0');
	t.is(getMinimumNodeVersion('18.0.0'), '18.0.0');
});

test('returns minimum version from OR range', t => {
	t.is(getMinimumNodeVersion('18 || 20'), '18.0.0');
	t.is(getMinimumNodeVersion('>=16 || >=18'), '16.0.0');
});

test('returns minimum version from complex range', t => {
	t.is(getMinimumNodeVersion('>=18.0.0 <20.0.0'), '18.0.0');
	t.is(getMinimumNodeVersion('>=16.14.0 <17.0.0 || >=18.0.0'), '16.14.0');
});

test('returns undefined for invalid input', t => {
	t.is(getMinimumNodeVersion(undefined), undefined);
	t.is(getMinimumNodeVersion(null), undefined);
	t.is(getMinimumNodeVersion(''), undefined);
	t.is(getMinimumNodeVersion(123), undefined);
});

test('returns undefined for invalid range', t => {
	t.is(getMinimumNodeVersion('invalid'), undefined);
});
