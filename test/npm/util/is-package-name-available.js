import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import sinon from 'sinon';

const externalRegistry = 'http://my-internal-registry.local';

const createFixture = (title, {name = 'foo', npmNameStub, expected, isExternalRegistry = false}) => {
	test(title, async () => {
		/**
		@type {import('../../../source/npm/util.js')}
		*/
		const npm = await esmock('../../../source/npm/util.js', {
			'npm-name': npmNameStub,
		});

		const package_ = isExternalRegistry
			? {name, publishConfig: {registry: externalRegistry}}
			: {name};

		const availability = await npm.isPackageNameAvailable(package_);
		assert.partialDeepStrictEqual(availability, expected);
	});
};

createFixture('available', {
	npmNameStub: sinon.stub().resolves(true),
	expected: {isAvailable: true, isUnknown: false},
});

createFixture('unavailable', {
	npmNameStub: sinon.stub().resolves(false),
	expected: {isAvailable: false, isUnknown: false},
});

createFixture('bad package name', {
	name: '_foo',
	npmNameStub: sinon.stub().rejects('Invalid package name: _foo\n- name cannot start with an underscore'),
	expected: {isAvailable: false, isUnknown: true},
});

createFixture('external registry', {
	name: 'external-foo',
	isExternalRegistry: true,
	npmNameStub: async (name, {registryUrl}) => name === 'external-foo' && registryUrl === externalRegistry,
	expected: {isAvailable: true, isUnknown: false},
});
