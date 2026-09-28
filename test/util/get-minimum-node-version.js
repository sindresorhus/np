import test from 'node:test';
import assert from 'node:assert/strict';
import {getMinimumNodeVersion} from '../../source/util.js';

test('returns minimum version from >=X range', () => {
	assert.equal(getMinimumNodeVersion('>=18'), '18.0.0');
	assert.equal(getMinimumNodeVersion('>=18.0.0'), '18.0.0');
	assert.equal(getMinimumNodeVersion('>=16.14.0'), '16.14.0');
});

test('returns minimum version from ^X range', () => {
	assert.equal(getMinimumNodeVersion('^18'), '18.0.0');
	assert.equal(getMinimumNodeVersion('^18.0.0'), '18.0.0');
	assert.equal(getMinimumNodeVersion('^16.14.0'), '16.14.0');
});

test('returns minimum version from X range', () => {
	assert.equal(getMinimumNodeVersion('18'), '18.0.0');
	assert.equal(getMinimumNodeVersion('18.0.0'), '18.0.0');
});

test('returns minimum version from OR range', () => {
	assert.equal(getMinimumNodeVersion('18 || 20'), '18.0.0');
	assert.equal(getMinimumNodeVersion('>=16 || >=18'), '16.0.0');
});

test('returns minimum version from complex range', () => {
	assert.equal(getMinimumNodeVersion('>=18.0.0 <20.0.0'), '18.0.0');
	assert.equal(getMinimumNodeVersion('>=16.14.0 <17.0.0 || >=18.0.0'), '16.14.0');
});

test('returns undefined for invalid input', () => {
	assert.equal(getMinimumNodeVersion(undefined), undefined);
	assert.equal(getMinimumNodeVersion(null), undefined);
	assert.equal(getMinimumNodeVersion(''), undefined);
	assert.equal(getMinimumNodeVersion(123), undefined);
});

test('returns undefined for invalid range', () => {
	assert.equal(getMinimumNodeVersion('invalid'), undefined);
});
