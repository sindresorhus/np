import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {execa} from 'execa';
import semver from 'semver';
import {npmConfig, pnpmConfig, yarnBerryConfig} from '../../source/package-manager/configs.js';
import {verifyPackageEntryPoints} from '../../source/npm/util.js';
import {assertTaskSkipped} from '../_helpers/task-list.js';

const createProject = async (t, fields) => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const rootDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'published-entry-points-'));
	t.after(() => fs.rm(rootDirectory, {recursive: true}));
	await fs.mkdir(path.join(rootDirectory, 'lib'));
	await fs.writeFile(path.join(rootDirectory, 'lib', 'index.js'), 'module.exports = 1;');
	const package_ = {
		name: 'published-entry-points-fixture', version: '1.0.0', files: ['lib'], ...fields,
	};
	await fs.writeFile(path.join(rootDirectory, 'package.json'), JSON.stringify(package_));
	return {package_, rootDirectory};
};

const getTasks = async (package_, rootDirectory, packageManager) => {
	const {default: prerequisiteTasks} = await esmock('../../source/prerequisite-tasks.js', import.meta.url, {
		execa: {execa: async () => ({stdout: '11.13.0'})},
		'../../source/git-util.js': {
			async verifyRecentGitVersion() {},
			async verifyUserConfigIsSet() {},
			hasUpstream: async () => false,
			async verifyRemoteIsValid() {},
			async fetch() {},
			async verifyTagDoesNotExistOnRemote() {},
		},
		'../../source/util.js': {getTagVersionPrefix: async () => 'v'},
		'../../source/npm/util.js': {
			checkConnection: async () => true,
			getPublishedPackageEngines: async () => undefined,
			isIgnoreScriptsEnabled: async () => false,
			// Keep the real validator and npm pack subprocess so the original false rejection is exercised.
			verifyPackageEntryPoints,
		},
	});
	return prerequisiteTasks('1.1.0', package_, {dryRun: true}, {packageManager, rootDirectory});
};

for (const packageManager of [pnpmConfig, yarnBerryConfig]) {
	for (const field of ['main', 'bin', 'exports']) {
		test(`${packageManager.id} entry point inspection skips publishConfig.${field} overrides`, async t => {
			const {package_, rootDirectory} = await createProject(t, {[field]: './src/index.js', publishConfig: {[field]: './lib/index.js'}});
			const tasks = await getTasks(package_, rootDirectory, packageManager);
			await assert.doesNotReject(tasks.run({renderer: 'silent'}));
			assertTaskSkipped(tasks, 'Verify package entry points');
		});
	}
}

for (const packageManager of [npmConfig, pnpmConfig, yarnBerryConfig]) {
	test(`${packageManager.id} still rejects ordinary missing entry points`, async t => {
		const {package_, rootDirectory} = await createProject(t, {exports: './missing.js'});
		const tasks = await getTasks(package_, rootDirectory, packageManager);
		await assert.rejects(tasks.run({renderer: 'silent'}), /Missing entry points/v);
	});
}

test('npm still validates entry points when publishConfig overrides are present', async t => {
	const {package_, rootDirectory} = await createProject(t, {exports: './missing.js', publishConfig: {exports: './lib/index.js'}});
	const tasks = await getTasks(package_, rootDirectory, npmConfig);
	await assert.rejects(tasks.run({renderer: 'silent'}), /Missing entry points/v);
});

test('pnpm still validates entry points with unrelated publishConfig settings', async t => {
	const {package_, rootDirectory} = await createProject(t, {exports: './missing.js', publishConfig: {access: 'public'}});
	const tasks = await getTasks(package_, rootDirectory, pnpmConfig);
	await assert.rejects(tasks.run({renderer: 'silent'}), /Missing entry points/v);
});

for (const {packageManager, minimumVersion} of [{packageManager: pnpmConfig, minimumVersion: '11.13.0'}, {packageManager: yarnBerryConfig, minimumVersion: '4.18.1'}]) {
	test(`${packageManager.id} publishes entry point overrides in its actual tarball`, async t => {
		const {exitCode, stdout: version} = await execa(packageManager.cli, ['--version'], {reject: false, env: {COREPACK_ENABLE_NETWORK: '0'}});
		if (exitCode !== 0 || !semver.valid(version) || semver.lt(version, minimumVersion)) {
			t.skip(`${packageManager.id} is not available offline`);
			return;
		}

		const overrides = {main: './lib/index.js', bin: {'fixture-cli': './lib/index.js'}, exports: './lib/index.js'};
		const {rootDirectory} = await createProject(t, {
			main: './src/index.js', bin: './src/index.js', exports: './src/index.js', publishConfig: overrides,
		});
		const archive = path.join(rootDirectory, 'artifact.tgz');
		if (packageManager.id === 'yarn-berry') {
			await fs.writeFile(path.join(rootDirectory, 'yarn.lock'), '');
			await fs.writeFile(path.join(rootDirectory, '.yarnrc.yml'), 'enableNetwork: false\n');
			await execa(packageManager.cli, ['install'], {cwd: rootDirectory, env: {COREPACK_ENABLE_NETWORK: '0'}});
		}

		await execa(packageManager.cli, ['pack', '--out', archive], {cwd: rootDirectory, env: {COREPACK_ENABLE_NETWORK: '0'}});
		const {stdout: manifest} = await execa('tar', ['-xOf', archive, 'package/package.json']);
		const publishedPackage = JSON.parse(manifest);
		assert.equal(publishedPackage.main, overrides.main);
		assert.deepEqual(publishedPackage.bin, overrides.bin);
		assert.equal(publishedPackage.exports, overrides.exports);
		const {stdout: files} = await execa('tar', ['-tf', archive]);
		assert.match(files, /package\/lib\/index\.js/v);
	});
}
