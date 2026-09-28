import test from 'node:test';
import assert from 'node:assert/strict';
import {template as chalk, makeTemplate} from 'chalk-template';
// eslint-disable-next-line unicorn/import-style -- Use an isolated color-enabled instance so these assertions also check highlighting in CI.
import {Chalk} from 'chalk';
import esmock from 'esmock';
import Version from '../source/version.js';

test('formatting uses each comparison without changing later formatting', async () => {
	const template = makeTemplate(new Chalk({level: 1}));
	const {default: ColoredVersion} = await esmock('../source/version.js', {
		'chalk-template': {template},
	});
	const version = new ColoredVersion('2.3.4');

	assert.equal(version.format({previousVersion: '1.3.4'}), template('{dim {cyan 2}.3.4}'));
	assert.equal(version.format({previousVersion: '2.2.4'}), template('{dim 2.{cyan 3}.4}'));
	assert.equal(version.format({previousVersion: '2.3.4'}), template('{dim 2.3.4}'));
	assert.equal(version.format(), template('{dim 2.3.4}'));
});

test('formatting a prerelease does not change its next increment', () => {
	const version = new Version('1.0.0-beta.1');
	version.format({previousVersion: '1.0.0-beta.0'});

	assert.equal(version.setFrom('prerelease').toString(), '1.0.0-beta.2');
});

test('formatting a prerelease does not change version comparisons', () => {
	const version = new Version('1.0.0-beta.1');
	const range = '>=1.0.0-beta.2 <1.0.0';
	assert.equal(version.satisfies(range), false);
	version.format({previousVersion: '1.0.0-beta.0'});

	assert.equal(version.satisfies(range), false);
});

for (const {current, previous, next, formattedPrefix} of [
	{
		current: '1.0.0-beta.1', previous: '1.0.0-beta.0', next: '1.0.0-beta.2', formattedPrefix: '1.0.0-beta.',
	},
	{
		current: '1.0.0-1.1', previous: '1.0.0-1.0', next: '1.0.0-1.2', formattedPrefix: '1.0.0-1.',
	},
	{
		current: '1.0.0-beta.preview.1', previous: '1.0.0-beta.preview.0', next: '1.0.0-beta.preview.2', formattedPrefix: '1.0.0-beta.preview.',
	},
]) {
	test(`repeated formatting with different colors preserves prerelease ${current}`, () => {
		const version = new Version(current);

		const formatted = ['green', 'red', 'yellow'].map(diffColor => version.format({previousVersion: previous, diffColor}));
		assert.deepEqual(formatted, [
			chalk(`{dim ${formattedPrefix}{green 1}}`),
			chalk(`{dim ${formattedPrefix}{red 1}}`),
			chalk(`{dim ${formattedPrefix}{yellow 1}}`),
		]);
		assert.equal(version.toString(), current);

		assert.equal(version.setFrom('prerelease').toString(), next);
	});
}
