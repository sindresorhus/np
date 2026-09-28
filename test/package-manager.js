import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {getPackageManagerConfig} from '../source/package-manager/index.js';
import {
	npmConfig,
	yarnConfig,
	yarnBerryConfig,
	pnpmConfig,
	bunConfig,
} from '../source/package-manager/configs.js';

test('detects npm from package-lock.json', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'package-lock.json'), '');

	const config = getPackageManagerConfig(temporaryDirectory, {name: 'test', version: '1.0.0'});

	assert.equal(config, npmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects pnpm from pnpm-lock.yaml', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'pnpm-lock.yaml'), '');

	const config = getPackageManagerConfig(temporaryDirectory, {name: 'test', version: '1.0.0'});

	assert.equal(config, pnpmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Classic from yarn.lock without .yarnrc.yml', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'yarn.lock'), '');

	const config = getPackageManagerConfig(temporaryDirectory, {name: 'test', version: '1.0.0'});

	assert.equal(config, yarnConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Berry from yarn.lock with .yarnrc.yml', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'yarn.lock'), '');
	fs.writeFileSync(path.join(temporaryDirectory, '.yarnrc.yml'), 'nodeLinker: node-modules\n');

	const config = getPackageManagerConfig(temporaryDirectory, {name: 'test', version: '1.0.0'});

	assert.equal(config, yarnBerryConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Berry from packageManager field', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		packageManager: 'yarn@3.0.0',
	});

	assert.equal(config, yarnBerryConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Classic from packageManager field', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		packageManager: 'yarn@1.22.0',
	});

	assert.equal(config, yarnConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects pnpm from devEngines.packageManager field', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		devEngines: {
			packageManager: {
				name: 'pnpm',
				version: '>=9',
			},
		},
	});

	assert.equal(config, pnpmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Bun from devEngines.packageManager field', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		devEngines: {
			packageManager: {
				name: 'bun',
				version: '^1.0.0',
			},
		},
	});

	assert.equal(config, bunConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Berry from devEngines.packageManager field', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		devEngines: {
			packageManager: {
				name: 'yarn',
				version: '^4.0.0',
			},
		},
	});

	assert.equal(config, yarnBerryConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Classic from devEngines.packageManager field', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		devEngines: {
			packageManager: {
				name: 'yarn',
				version: '^1.22.0',
			},
		},
	});

	assert.equal(config, yarnConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects package manager from devEngines.packageManager array', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		devEngines: {
			packageManager: [
				{
					name: 'pnpm',
					version: '>=9',
				},
				{
					name: 'npm',
					onFail: 'warn',
				},
			],
		},
	});

	assert.equal(config, pnpmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('packageManager field takes precedence over devEngines.packageManager field', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		packageManager: 'npm@10.0.0',
		devEngines: {
			packageManager: {
				name: 'pnpm',
			},
		},
	});

	assert.equal(config, npmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('throws when devEngines.packageManager has no name', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'pnpm-lock.yaml'), '');

	assert.throws(() => getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		devEngines: {
			packageManager: {
				version: '>=9',
			},
		},
	}), {
		message: 'Missing "name" property for "packageManager".',
	});

	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('throws when devEngines.packageManager array entry has no name', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	assert.throws(() => getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		devEngines: {
			packageManager: [
				{
					version: '>=9',
				},
				{
					name: 'pnpm',
				},
			],
		},
	}), {
		message: 'Missing "name" property for "packageManager".',
	});

	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('throws for invalid devEngines.packageManager name', () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	assert.throws(() => getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		devEngines: {
			packageManager: {
				name: 'deno',
			},
		},
	}), {
		message: 'Invalid package manager: deno',
	});

	fs.rmSync(temporaryDirectory, {recursive: true});
});
