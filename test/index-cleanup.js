import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {npmConfig} from '../source/package-manager/configs.js';

const sourcePath = path.resolve(import.meta.dirname, '../source/index.js');

for (const {invocationDirectory, contents = false} of [
	{invocationDirectory: '.'},
	{invocationDirectory: 'src'},
	{invocationDirectory: 'src', contents: true},
]) {
	test(`cleans project dependencies when invoked from ${invocationDirectory}${contents ? ' with separate package contents' : ''}`, async t => {
		const originalDirectory = process.cwd();
		await fs.mkdir('.ai-temporary', {recursive: true});
		const projectDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'np-cleanup-repro-'));
		const package_ = {name: 'cleanup-fixture', version: '1.0.0'};
		const rootDirectory = contents ? path.join(projectDirectory, 'dist') : projectDirectory;
		await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify(package_));
		await fs.mkdir(path.join(projectDirectory, 'src'));
		await fs.mkdir(path.join(projectDirectory, 'node_modules'));
		await fs.writeFile(path.join(projectDirectory, 'node_modules', 'synthetic-fixture'), 'fixture');
		if (contents) {
			await fs.mkdir(path.join(rootDirectory, 'node_modules'), {recursive: true});
			await fs.writeFile(path.join(rootDirectory, 'package.json'), JSON.stringify(package_));
			await fs.writeFile(path.join(rootDirectory, 'node_modules', 'keep'), 'fixture');
		}

		t.after(async () => {
			process.chdir(originalDirectory);
			await fs.rm(projectDirectory, {recursive: true});
		});
		const commands = [];
		const np = await esmock(sourcePath, {
			execa: {
				execa(command, arguments_, options) {
					commands.push({command, arguments: arguments_, options});
					return {async * iterable() {}};
				},
			},
			'../source/git-tasks.js'() {},
			'../source/git-util.js': {
				async hasUpstream() {
					return false;
				},
				async verifyWorkingTreeIsClean() {},
			},
			'exit-hook': {asyncExitHook() {}},
		});
		// Reproduce invocation from a subdirectory, while cleanup targets the package root.
		// eslint-disable-next-line node-test/no-process-chdir-in-test
		process.chdir(path.join(projectDirectory, invocationDirectory));

		const result = await np('patch', {
			packageManager: npmConfig,
			cleanup: true,
			tests: false,
			runPublish: false,
			availability: {},
			renderer: 'silent',
		}, {package_, rootDirectory, projectDirectory: contents ? projectDirectory : undefined});

		assert.equal(result.name, package_.name);
		await assert.rejects(fs.access(path.join(projectDirectory, 'node_modules')), {code: 'ENOENT'});
		assert.ok(await fs.stat(path.join(projectDirectory, 'src')));
		assert.equal(commands[0].command, 'npm');
		assert.equal(commands[0].options.cwd, projectDirectory);
		if (contents) {
			// eslint-disable-next-line node-test/no-conditional-assertion
			assert.equal(await fs.readFile(path.join(rootDirectory, 'node_modules', 'keep'), 'utf8'), 'fixture');
		}
	});
}
