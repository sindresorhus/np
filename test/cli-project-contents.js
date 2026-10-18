import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import esmock from 'esmock';
import getConfig from '../source/config.js';
import {npPackage, readPackage} from '../source/util.js';
import {npmConfig} from '../source/package-manager/configs.js';

for (const {description, configuredContents, explicitContents, fromSubdirectory = true, hasProjectManifest = true, configInPackageJson = false, expectedPackage, expectedFolder} of [
	{
		description: 'a nested invocation uses contents from the project root config',
		configuredContents: 'dist',
		expectedPackage: 'child-package',
		expectedFolder: 'dist',
	},
	{
		description: 'an explicit relative contents flag overrides the root config',
		configuredContents: 'dist',
		explicitContents: '../alternate',
		expectedPackage: 'alternate-package',
		expectedFolder: 'alternate',
	},
	{
		description: 'an explicit contents flag works without a project manifest',
		explicitContents: 'dist',
		fromSubdirectory: false,
		hasProjectManifest: false,
		expectedPackage: 'child-package',
		expectedFolder: 'dist',
	},
	{
		description: 'an ordinary nested invocation selects the project package',
		expectedPackage: 'parent-package',
		expectedFolder: '.',
	},
	{
		description: 'a project-root invocation uses its configured contents',
		configuredContents: 'dist',
		fromSubdirectory: false,
		expectedPackage: 'child-package',
		expectedFolder: 'dist',
	},
	{
		description: 'a nested invocation uses contents from the project package.json config',
		configuredContents: 'dist',
		configInPackageJson: true,
		expectedPackage: 'child-package',
		expectedFolder: 'dist',
	},
]) {
	test(description, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const projectDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'nested-contents-config-'));
		t.after(() => fs.rm(projectDirectory, {recursive: true}));
		const contentsDirectory = path.join(projectDirectory, 'dist');
		const alternateDirectory = path.join(projectDirectory, 'alternate');
		const invocationDirectory = fromSubdirectory ? path.join(projectDirectory, 'src') : projectDirectory;
		await fs.mkdir(contentsDirectory);
		await fs.mkdir(alternateDirectory);
		await fs.mkdir(path.join(projectDirectory, 'src'));
		if (hasProjectManifest) {
			await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'parent-package', version: '1.0.0', ...configInPackageJson && {np: {contents: configuredContents}}}));
		}

		await fs.writeFile(path.join(contentsDirectory, 'package.json'), JSON.stringify({name: 'child-package', version: '1.0.0'}));
		await fs.writeFile(path.join(alternateDirectory, 'package.json'), JSON.stringify({name: 'alternate-package', version: '1.0.0'}));
		if (configuredContents !== undefined && !configInPackageJson) {
			await fs.writeFile(path.join(projectDirectory, '.np-config.json'), JSON.stringify({contents: configuredContents}));
		}

		const ui = sinon.stub().callsFake(async options => ({...options, confirm: false}));
		t.mock.method(console, 'log', () => {});
		t.mock.method(console, 'error', () => {});
		t.mock.method(process, 'cwd', () => invocationDirectory);

		await esmock('../source/cli-implementation.js', {}, {
			meow: {default: () => ({input: ['patch'], flags: {publish: false, contents: explicitContents}, pkg: npPackage})},
			'update-notifier': {default: () => ({notify() {}})},
			'../source/config.js': {default: getConfig},
			'../source/util.js': {readPackage},
			'../source/git-util.js': {defaultBranch: async () => 'main'},
			'../source/git-tasks.js': {async verifyGitTasks() {}},
			'../source/package-manager/index.js': {getPackageManagerConfig: () => npmConfig},
			'../source/ui.js': {default: ui},
			'exit-hook': {gracefulExit() {}},
			// Fixtures live inside this repository, so isolate the no-ancestor-package case from its package.json.
			...!hasProjectManifest && {'package-directory': {packageDirectory: async () => undefined}},
		});

		assert.ok(ui.calledOnce);
		assert.equal(ui.firstCall.args[1].package_.name, expectedPackage);
		assert.equal(ui.firstCall.args[1].rootDirectory, path.join(projectDirectory, expectedFolder));
	});
}
