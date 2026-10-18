import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import esmock from 'esmock';
import {npmConfig} from '../../source/package-manager/configs.js';

for (const {remoteName, explicitRemote, tracking = true} of [
	{remoteName: 'upstream'},
	{remoteName: 'origin'},
	{remoteName: 'upstream', explicitRemote: 'release'},
	{remoteName: 'origin', tracking: false},
]) {
	test(`prerequisites validate and fetch ${explicitRemote ?? remoteName} with tracking ${tracking}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'prerequisite-upstream-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const projectDirectory = path.join(temporaryDirectory, 'project');
		const remoteDirectory = path.join(temporaryDirectory, 'remote.git');
		await fs.mkdir(projectDirectory);
		const git = arguments_ => execa('git', arguments_, {cwd: projectDirectory});
		await git(['init']);
		await git(['config', 'user.name', 'Test']);
		await git(['config', 'user.email', 'test@example.com']);
		await git(['commit', '--allow-empty', '-m', 'Initial release']);
		await git(['init', '--bare', remoteDirectory]);
		await git(['remote', 'add', remoteName, remoteDirectory]);
		await git(['push', ...tracking ? ['--set-upstream'] : [], remoteName, 'HEAD']);
		if (explicitRemote) {
			await git(['remote', 'add', explicitRemote, remoteDirectory]);
		}

		const {stdout: branch} = await git(['branch', '--show-current']);
		const gitCommands = [];
		const mocks = {
			execa: {
				async execa(command, arguments_, options) {
					if (command === 'git') {
						gitCommands.push(arguments_);
						return execa(command, arguments_, {...options, cwd: projectDirectory});
					}

					assert.equal(command, 'npm');
					return {stdout: arguments_[0] === '--version' ? '10.0.0' : 'v'};
				},
			},
		};
		const {verifyGitTasks} = await esmock('../../source/git-tasks.js', {}, mocks);
		await assert.doesNotReject(verifyGitTasks({branch, remote: explicitRemote}));
		gitCommands.length = 0;
		const prerequisiteTasks = await esmock('../../source/prerequisite-tasks.js', {}, mocks);
		const package_ = {name: 'fixture', version: '1.0.0', private: true};
		const tasks = prerequisiteTasks('1.1.0', package_, {yolo: true, remote: explicitRemote}, {packageManager: npmConfig, rootDirectory: projectDirectory});

		await assert.doesNotReject(tasks.run({renderer: 'silent'}));
		const expectedRemote = explicitRemote ?? (tracking ? remoteName : undefined);
		assert.deepEqual(gitCommands.filter(arguments_ => arguments_[0] === 'ls-remote'), [['ls-remote', expectedRemote ?? 'origin', 'HEAD']]);
		assert.deepEqual(gitCommands.filter(arguments_ => arguments_[0] === 'fetch'), [['fetch', ...expectedRemote ? [expectedRemote] : []]]);
	});
}
