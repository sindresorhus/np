import test from 'ava';
import esmock from 'esmock';
import sinon from 'sinon';

const externalRegistry = 'http://my-internal-registry.local';

const createFixture = test.macro(async (t, {name = 'foo', npmNameStub, expected, isExternalRegistry = false}) => {
	/** @type {import('../../../source/npm/util.js')} */
	const npm = await esmock('../../../source/npm/util.js', {
		'npm-name': npmNameStub,
	});

	const pkg = isExternalRegistry
		? {name, publishConfig: {registry: externalRegistry}}
		: {name};

	const availability = await npm.isPackageNameAvailable(pkg);
	t.like(availability, expected);
});

test('available', createFixture, {
	npmNameStub: sinon.stub().resolves(true),
	expected: {isAvailable: true, isUnknown: false},
});

test('unavailable', createFixture, {
	npmNameStub: sinon.stub().resolves(false),
	expected: {isAvailable: false, isUnknown: false},
});

test('bad package name', createFixture, {
	name: '_foo',
	npmNameStub: sinon.stub().rejects('Invalid package name: _foo\n- name cannot start with an underscore'),
	expected: {isAvailable: false, isUnknown: true},
});

test('external registry', createFixture, {
	name: 'external-foo',
	isExternalRegistry: true,
	npmNameStub: async (name, {registryUrl}) => name === 'external-foo' && registryUrl === externalRegistry,
	expected: {isAvailable: true, isUnknown: false},
});
