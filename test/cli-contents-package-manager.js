import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {npPackage, readPackage} from '../source/util.js';

for (const {name, packageManagerFields, explicitManager, hasProjectManifest = true, expectedManager = 'pnpm'} of [
	{name: 'packageManager', packageManagerFields: {packageManager: 'pnpm@11.0.0'}},
	{name: 'devEngines', packageManagerFields: {devEngines: {packageManager: {name: 'pnpm', version: '11.0.0'}}}},
	{
		name: 'an explicit flag', packageManagerFields: {packageManager: 'pnpm@11.0.0'}, explicitManager: 'npm', expectedManager: 'npm',
	},
	{name: 'the contents manifest without a project manifest', hasProjectManifest: false},
]) {
	test(`contents publishing selects its package manager from ${name}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const projectDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'contents-package-manager-'));
		t.after(() => fs.rm(projectDirectory, {recursive: true}));
		const contentsDirectory = path.join(projectDirectory, 'dist');
		await fs.mkdir(contentsDirectory);
		if (hasProjectManifest) {
			await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'project-package', version: '1.0.0', ...packageManagerFields}));
		}

		await fs.writeFile(path.join(contentsDirectory, 'package.json'), JSON.stringify({name: 'published-package', version: '1.0.0', packageManager: hasProjectManifest ? 'npm@10.0.0' : 'pnpm@11.0.0'}));
		t.mock.method(process, 'cwd', () => projectDirectory);
		t.mock.method(console, 'log', () => {});
		t.mock.method(console, 'error', () => {});
		let receivedOptions;
		await esmock('../source/cli-implementation.js', {
			meow: {default: () => ({input: ['patch'], flags: {publish: false, contents: 'dist', packageManager: explicitManager}, pkg: npPackage})},
			'update-notifier': {default: () => ({notify() {}})},
			'../source/config.js': {default: async () => ({})},
			'../source/util.js': {readPackage},
			'../source/git-util.js': {defaultBranch: async () => 'main'},
			'../source/git-tasks.js': {async verifyGitTasks() {}},
			'../source/ui.js': {
				async default(options) {
					receivedOptions = options;
					return {...options, confirm: false};
				},
			},
			'exit-hook': {gracefulExit() {}},
			...!hasProjectManifest && {'package-directory': {packageDirectory: async () => undefined}},
		});

		assert.equal(receivedOptions.packageManager.id, expectedManager);
		assert.equal(receivedOptions.packageManager.installCommandNoLockfile[0], expectedManager);
	});
}
