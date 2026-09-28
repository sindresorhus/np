import test from 'node:test';
import assert from 'node:assert/strict';
import handleNpmError from '../../source/npm/handle-npm-error.js';

const makeError = ({code, stdout, stderr}) => ({
	code,
	stdout: stdout ?? '',
	stderr: stderr ?? '',
});

test('error code 402 - privately publish scoped package', () => {
	assert.throws(
		() => handleNpmError(makeError({code: 402})),
		{message: 'You cannot publish a scoped package privately without a paid plan. Did you mean to publish publicly?'},
	);

	assert.throws(
		() => handleNpmError(makeError({stderr: 'npm ERR! 402 Payment Required'})),
		{message: 'You cannot publish a scoped package privately without a paid plan. Did you mean to publish publicly?'},
	);
});

test('error code 402 - npm 10+ log prefix', () => {
	assert.throws(
		() => handleNpmError(makeError({stderr: 'npm error code E402\nnpm error 402 Payment Required - PUT https://registry.npmjs.org/@scope%2fname - You must sign up for private packages'})),
		{message: 'You cannot publish a scoped package privately without a paid plan. Did you mean to publish publicly?'},
	);
});
