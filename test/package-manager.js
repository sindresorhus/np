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
