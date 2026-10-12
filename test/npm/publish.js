import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {getPackagePublishArguments, runPublish} from '../../source/npm/publish.js';

test('no options set', () => {
	assert.deepEqual(
		getPackagePublishArguments({}),
		['publish'],
	);
});

test('options.tag', () => {
	assert.deepEqual(
		getPackagePublishArguments({tag: 'beta'}),
		['publish', '--tag', 'beta'],
	);
});

test('options.otp', () => {
	assert.deepEqual(
		getPackagePublishArguments({otp: '123456'}),
		['publish', '--otp', '123456'],
	);
});

test('options.publishScoped', () => {
	assert.deepEqual(
		getPackagePublishArguments({publishScoped: true}),
		['publish', '--access', 'public'],
	);
});

test('options.provenance', () => {
	assert.deepEqual(
		getPackagePublishArguments({provenance: true}),
		['publish', '--provenance'],
	);
});

test('options.stage', () => {
	assert.deepEqual(
		getPackagePublishArguments({stage: true}),
		['stage', 'publish'],
	);
});

test('options.stage with other flags', () => {
	assert.deepEqual(
		getPackagePublishArguments({stage: true, tag: 'beta', provenance: true}),
		['stage', 'publish', '--tag', 'beta', '--provenance'],
	);
});

test('runPublish uses cwd option when provided', async () => {
	const {stdout} = await runPublish(['pwd', []], {cwd: '/tmp', task: {}});
	assert.equal(await fs.realpath(stdout), await fs.realpath('/tmp'));
});

test('runPublish shows the output in the task', async () => {
	const task = {};
	await runPublish(['echo', ['test']], {task});
	assert.equal(task.output, 'test\n');
});

test('runPublish includes stderr and stdout in the error message', async () => {
	await assert.rejects(
		runPublish(['node', ['--eval', 'process.stdout.write("Packing"); process.stderr.write("npm error 404 Not Found"); process.exitCode = 1;']], {task: {}}),
		{message: /npm error 404 Not Found[\s\S]*Packing/v},
	);
});
