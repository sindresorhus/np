import test from 'node:test';
import assert from 'node:assert/strict';

test('np defines `Symbol.observable` before loading rxjs', async () => {
	// `listr-input` is loaded lazily and bundles its own rxjs 6. Every copy of rxjs picks up `Symbol.observable` when it loads, so np must define it before the first one loads. Otherwise the OTP prompt's observables are rejected with “You provided an invalid object where a stream was expected”.
	await import('../source/index.js');
	const {observable} = await import('rxjs');
	// eslint-disable-next-line unicorn/no-nonstandard-builtin-properties
	assert.equal(observable, Symbol.observable);
});
