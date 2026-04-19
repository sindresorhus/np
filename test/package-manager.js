import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'ava';
import {getPackageManagerConfig} from '../source/package-manager/index.js';
import {
	npmConfig,
	yarnConfig,
	yarnBerryConfig,
	pnpmConfig,
	bunConfig,
} from '../source/package-manager/configs.js';

test('detects npm from package-lock.json', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'package-lock.json'), '');

	const config = getPackageManagerConfig(temporaryDirectory, {name: 'test', version: '1.0.0'});

	t.is(config, npmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects pnpm from pnpm-lock.yaml', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'pnpm-lock.yaml'), '');

	const config = getPackageManagerConfig(temporaryDirectory, {name: 'test', version: '1.0.0'});

	t.is(config, pnpmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Classic from yarn.lock without .yarnrc.yml', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'yarn.lock'), '');

	const config = getPackageManagerConfig(temporaryDirectory, {name: 'test', version: '1.0.0'});

	t.is(config, yarnConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Berry from yarn.lock with .yarnrc.yml', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'yarn.lock'), '');
	fs.writeFileSync(path.join(temporaryDirectory, '.yarnrc.yml'), 'nodeLinker: node-modules\n');

	const config = getPackageManagerConfig(temporaryDirectory, {name: 'test', version: '1.0.0'});

	t.is(config, yarnBerryConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Berry from packageManager field', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		packageManager: 'yarn@3.0.0',
	});

	t.is(config, yarnBerryConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Classic from packageManager field', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	const config = getPackageManagerConfig(temporaryDirectory, {
		name: 'test',
		version: '1.0.0',
		packageManager: 'yarn@1.22.0',
	});

	t.is(config, yarnConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects pnpm from devEngines.packageManager field', t => {
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

	t.is(config, pnpmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Bun from devEngines.packageManager field', t => {
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

	t.is(config, bunConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Berry from devEngines.packageManager field', t => {
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

	t.is(config, yarnBerryConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects Yarn Classic from devEngines.packageManager field', t => {
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

	t.is(config, yarnConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('detects package manager from devEngines.packageManager array', t => {
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

	t.is(config, pnpmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('packageManager field takes precedence over devEngines.packageManager field', t => {
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

	t.is(config, npmConfig);
	fs.rmSync(temporaryDirectory, {recursive: true});
});

test('throws when devEngines.packageManager has no name', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));
	fs.writeFileSync(path.join(temporaryDirectory, 'pnpm-lock.yaml'), '');

	t.throws(() => getPackageManagerConfig(temporaryDirectory, {
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

test('throws when devEngines.packageManager array entry has no name', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	t.throws(() => getPackageManagerConfig(temporaryDirectory, {
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

test('throws for invalid devEngines.packageManager name', t => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'np-test-'));

	t.throws(() => getPackageManagerConfig(temporaryDirectory, {
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
