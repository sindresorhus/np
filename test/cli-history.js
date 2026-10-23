import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import esmock from 'esmock';
import {execa} from 'execa';
import {ExitPromptError} from '@inquirer/core';
import {PresentableError} from 'presentable-error';
import {npPackage} from '../source/util.js';
import {npmConfig} from '../source/package-manager/configs.js';

const loadCli = async (t, {action = 'update', interactive = true, flags = {}, historyError, promptError, mergeError, workingTreeError, exitCode = 0} = {}) => {
	const prompt = promptError ? sinon.stub().rejects(promptError) : sinon.stub().resolves({action});
	const execute = sinon.stub().resolves({exitCode});
	if (mergeError) {
		execute.withArgs('git').rejects(mergeError);
	}

	const verifyGitTasks = historyError ? sinon.stub().rejects(historyError) : sinon.stub().resolves();
	const readPackage = sinon.stub().resolves({package_: {name: 'fixture', version: '1.0.0'}, rootDirectory: process.cwd()});
	const ui = sinon.stub().callsFake(async options => ({...options, confirm: false}));
	const verifyWorkingTreeIsClean = workingTreeError ? sinon.stub().rejects(workingTreeError) : sinon.stub().resolves();
	const gracefulExit = sinon.stub();
	const consoleError = t.mock.method(console, 'error', () => {});
	await esmock('../source/cli-implementation.js', {}, {
		meow: {default: () => ({input: ['patch'], flags: {publish: false, ...flags}, pkg: npPackage})},
		'update-notifier': {default: () => ({notify() {}})},
		'is-interactive': {default: () => interactive},
		inquirer: {prompt},
		execa: {execa: execute},
		'../source/config.js': {default: async () => ({})},
		'../source/util.js': {readPackage},
		'../source/package-manager/index.js': {getPackageManagerConfig: () => npmConfig},
		'../source/git-util.js': {defaultBranch: async () => 'main', getCurrentBranch: async () => 'main', verifyWorkingTreeIsClean},
		'../source/git-tasks.js': {verifyGitTasks},
		'../source/ui.js': {default: ui},
		'exit-hook': {gracefulExit},
	});
	return {
		prompt, execute, verifyGitTasks, readPackage, ui, verifyWorkingTreeIsClean, gracefulExit, consoleError,
	};
};

const behindError = () => Object.assign(new PresentableError('Remote history differs. Please pull changes.'), {isBehind: true});

for (const exitCode of [0, 1]) {
	test(`cli offers a fast-forward and restarts before loading package data, propagating exit code ${exitCode}`, async t => {
		const {prompt, execute, verifyGitTasks, readPackage, ui, verifyWorkingTreeIsClean, gracefulExit, consoleError} = await loadCli(t, {historyError: behindError(), exitCode});

		assert.ok(prompt.calledOnce);
		assert.deepEqual(prompt.firstCall.firstArg.action.choices.map(choice => choice.value), ['update', 'cancel']);
		assert.deepEqual(execute.firstCall.args, ['git', ['merge', '--ff-only', '@{u}'], {stdio: 'inherit'}]);
		assert.deepEqual(execute.secondCall.args, [process.execPath, [...process.execArgv, ...process.argv.slice(1)], {stdio: 'inherit', reject: false}]);
		sinon.assert.callOrder(verifyGitTasks, prompt, verifyWorkingTreeIsClean, execute);
		assert.ok(readPackage.notCalled);
		assert.ok(ui.notCalled);
		assert.ok(gracefulExit.calledOnceWithExactly(exitCode));
		assert.equal(consoleError.mock.callCount(), 0);
	});
}

for (const {description, options, expectedExitCode} of [
	{description: 'canceling the update', options: {action: 'cancel'}},
	{description: 'canceling with Ctrl+C', options: {promptError: new ExitPromptError('User canceled')}, expectedExitCode: 130},
	{description: 'a failed fast-forward', options: {mergeError: new Error('Fast-forward failed')}, expectedExitCode: 1},
]) {
	test(`cli stops before loading package data after ${description}`, async t => {
		const {readPackage, ui, execute, gracefulExit} = await loadCli(t, {historyError: behindError(), ...options});

		assert.ok(readPackage.notCalled);
		assert.ok(ui.notCalled);
		assert.equal(execute.callCount, options.mergeError ? 1 : 0);
		assert.deepEqual(gracefulExit.firstCall.args, expectedExitCode === undefined ? [] : [expectedExitCode]);
	});
}

for (const options of [
	{interactive: false, historyError: behindError()},
	{flags: {dryRun: true}, historyError: behindError()},
	{historyError: new PresentableError('Local and remote history have diverged. Resolve the divergence before releasing.')},
	{historyError: new PresentableError('Unclean working tree. Commit or stash changes first.')},
	{historyError: new Error('Fetch failed')},
]) {
	test(`cli leaves unrecoverable Git errors unchanged: ${JSON.stringify(options)}`, async t => {
		const {prompt, execute, gracefulExit, consoleError} = await loadCli(t, options);

		assert.ok(prompt.notCalled);
		assert.ok(execute.notCalled);
		assert.ok(gracefulExit.calledOnceWithExactly(1));
		assert.ok(consoleError.mock.calls[0].arguments[0].includes(options.historyError.message));
	});
}

test('cli does not fast-forward when the working tree became unclean after the prompt', async t => {
	const workingTreeError = new PresentableError('Unclean working tree. Commit or stash changes first.');
	const {prompt, execute, readPackage, gracefulExit, consoleError} = await loadCli(t, {historyError: behindError(), workingTreeError});

	assert.ok(prompt.calledOnce);
	assert.ok(execute.notCalled);
	assert.ok(readPackage.notCalled);
	assert.ok(gracefulExit.calledOnceWithExactly(1));
	assert.ok(consoleError.mock.calls[0].arguments[0].includes(workingTreeError.message));
});

test('cli keeps `--any-branch` when restarting after a fast-forward', async t => {
	const {prompt, execute, verifyGitTasks} = await loadCli(t, {historyError: behindError(), flags: {anyBranch: true, branch: 'release'}});

	assert.ok(prompt.calledOnce);
	assert.deepEqual(verifyGitTasks.firstCall.firstArg, {anyBranch: true, branch: 'release', remote: undefined});
	assert.deepEqual(execute.secondCall.args, [process.execPath, [...process.execArgv, ...process.argv.slice(1), '--any-branch'], {stdio: 'inherit', reject: false}]);
});

test('cli continues after successful history validation without prompting', async t => {
	const {prompt, execute, verifyGitTasks, readPackage, ui} = await loadCli(t);

	assert.ok(prompt.notCalled);
	assert.ok(execute.notCalled);
	assert.ok(ui.calledOnce);
	sinon.assert.callOrder(verifyGitTasks, readPackage, ui);
});

test('updating the branch fetches automatically and restarts with the incoming package and executable config', async t => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const directory = await fs.mkdtemp(path.resolve('.ai-temporary', 'history-restart-'));
	t.after(() => fs.rm(directory, {recursive: true}));
	const projectDirectory = path.join(directory, 'project');
	await fs.mkdir(projectDirectory);
	const git = arguments_ => execa('git', arguments_, {cwd: projectDirectory});
	await git(['init', '--initial-branch=main']);
	await git(['config', 'user.name', 'Test']);
	await git(['config', 'user.email', 'test@example.com']);
	await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'fixture', version: '1.0.0'}));
	await fs.writeFile(path.join(projectDirectory, '.np-config.mjs'), 'export default {testScript: "old-test"};\n');
	await git(['add', '.']);
	await git(['commit', '-m', 'Initial commit']);
	await execa('git', ['init', '--bare', path.join(directory, 'remote.git')]);
	await git(['remote', 'add', 'origin', path.join(directory, 'remote.git')]);
	await git(['push', '--set-upstream', 'origin', 'main']);
	await execa('git', ['clone', '--branch', 'main', path.join(directory, 'remote.git'), path.join(directory, 'peer')]);
	const peer = arguments_ => execa('git', arguments_, {cwd: path.join(directory, 'peer')});
	await peer(['config', 'user.name', 'Test']);
	await peer(['config', 'user.email', 'test@example.com']);
	await fs.writeFile(path.join(directory, 'peer/package.json'), JSON.stringify({name: 'fixture', version: '2.0.0', packageManager: 'pnpm@11.3.0'}));
	await fs.writeFile(path.join(directory, 'peer/.np-config.mjs'), 'export default {testScript: "incoming-test"};\n');
	await peer(['add', '.']);
	await peer(['commit', '-m', 'Incoming release changes']);
	await peer(['push']);
	const {stdout: originalUpstream} = await git(['rev-parse', '@{u}']);
	const runner = path.join(directory, 'runner.mjs');
	await fs.writeFile(runner, `
		import esmock from ${JSON.stringify(import.meta.resolve('esmock'))};
		await esmock(${JSON.stringify(path.resolve('source/cli-implementation.js'))}, {}, {
			'update-notifier': {default: () => ({notify() {}})},
			'is-interactive': {default: () => true},
			inquirer: {
				async prompt() {
					return {action: 'update'};
				},
			},
			${JSON.stringify(path.resolve('source/ui.js'))}: {default: async (options, context) => {
				console.log('RELEASE_CONTEXT ' + JSON.stringify({version: context.package_.version, manager: options.packageManager.id, testScript: options.testScript}));
				return {...options, confirm: false};
			}},
		});
	`);
	const {stdout, stderr, exitCode} = await execa(process.execPath, [runner, 'patch', '--no-publish'], {cwd: projectDirectory, reject: false, timeout: 60_000});

	assert.equal(exitCode, 0, stderr);
	const contextLine = stdout.split('\n').find(line => line.startsWith('RELEASE_CONTEXT '));
	assert.ok(contextLine, stdout);
	assert.deepEqual(JSON.parse(contextLine.slice('RELEASE_CONTEXT '.length)), {version: '2.0.0', manager: 'pnpm', testScript: 'incoming-test'});
	const {stdout: head} = await git(['rev-parse', 'HEAD']);
	const {stdout: upstream} = await git(['rev-parse', '@{u}']);
	assert.notEqual(upstream, originalUpstream);
	assert.equal(head, upstream);
});
