import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import semver from 'semver';
import {pnpmConfig} from '../source/package-manager/configs.js';
import {npPackage} from '../source/util.js';

for (const hasLockfile of [true, false]) {
	test(`pnpm install enforces dependency engines with a lockfile: ${hasLockfile}`, () => {
		const [, arguments_] = hasLockfile ? pnpmConfig.installCommand : pnpmConfig.installCommandNoLockfile;
		assert.ok(arguments_.includes('--engine-strict'));
	});

	for (const compatible of [true, false]) {
		test(`pnpm rejects incompatible dependency engines with a lockfile: ${hasLockfile}, compatible: ${compatible}`, async t => {
			const pnpmVersion = await execa('pnpm', ['--version'], {reject: false, env: {COREPACK_ENABLE_NETWORK: '0'}});
			if (pnpmVersion.failed || !semver.satisfies(pnpmVersion.stdout, npPackage.engines.pnpm)) {
				t.skip(`pnpm ${npPackage.engines.pnpm} is not available offline`);
				return;
			}

			assert.equal(pnpmVersion.exitCode, 0);
			await fs.mkdir('.ai-temporary', {recursive: true});
			const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'pnpm-engines-'));
			t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
			const dependencyDirectory = path.join(temporaryDirectory, 'dependency');
			await fs.mkdir(dependencyDirectory);
			await fs.writeFile(path.join(dependencyDirectory, 'package.json'), JSON.stringify({
				name: 'engine-dependency-fixture', version: '1.0.0', engines: {node: compatible ? '*' : '>=999'},
			}));
			await execa('npm', ['pack', '--pack-destination', temporaryDirectory], {cwd: dependencyDirectory});
			const projectDirectory = path.join(temporaryDirectory, 'project');
			await fs.mkdir(projectDirectory);
			await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({
				name: 'engine-project-fixture', version: '1.0.0', dependencies: {'engine-dependency-fixture': 'file:../engine-dependency-fixture-1.0.0.tgz'},
			}));
			const options = {cwd: projectDirectory, env: {COREPACK_ENABLE_NETWORK: '0'}};
			const installArguments = ['--offline', '--ignore-scripts', '--store-dir', path.join(temporaryDirectory, 'store')];
			if (hasLockfile) {
				await execa('pnpm', ['install', '--lockfile-only', '--engine-strict=false', ...installArguments], options);
			}

			const [command, arguments_] = hasLockfile ? pnpmConfig.installCommand : pnpmConfig.installCommandNoLockfile;
			const result = await execa(command, [...arguments_, ...installArguments], {...options, reject: false});
			assert.equal(result.exitCode, compatible ? 0 : 1, 'Only compatible dependencies should install successfully.');
			assert.match(result.stdout + result.stderr, compatible ? /Done/v : /ERR_PNPM_UNSUPPORTED_ENGINE/v);
		});
	}
}
