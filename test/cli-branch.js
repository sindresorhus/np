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

const loadCli = async (t, options = {}) => {
	const {
		action = 'current', flags = {}, input = ['patch'], interactive = true, currentBranch = 'feature', localBranch = true, exitCode = 0, localConfig = {},
		promptError, checkoutError, workingTreeError, historyError,
	} = options;
	const prompt = promptError ? sinon.stub().rejects(promptError) : sinon.stub().resolves({action});
	if (historyError) {
		prompt.onSecondCall().resolves({action: 'update'});
	}

	const signalListenerCounts = [];
	const execute = sinon.stub().callsFake(async () => {
		signalListenerCounts.push(process.listenerCount('SIGINT'));
		return {exitCode};
	});
	if (checkoutError) {
		execute.withArgs('git').rejects(checkoutError);
	}

	const readPackage = sinon.stub().resolves({package_: {name: 'fixture', version: '1.0.0'}, rootDirectory: process.cwd()});
	const ui = sinon.stub().callsFake(async releaseOptions => ({...releaseOptions, confirm: false}));
	const publish = sinon.stub();
	const verifyGitTasks = historyError ? sinon.stub().rejects(historyError) : sinon.stub();
	const verifyWorkingTreeIsClean = workingTreeError ? sinon.stub().rejects(workingTreeError) : sinon.stub();
	const getCurrentBranch = sinon.stub().resolves(currentBranch);
	const defaultBranch = sinon.stub().resolves('main');
	const gracefulExit = sinon.stub();
	const consoleError = t.mock.method(console, 'error', () => {});
	await esmock('../source/cli-implementation.js', {}, {
		meow: {default: () => ({input, flags: {publish: false, ...flags}, pkg: npPackage})},
		'update-notifier': {default: () => ({notify() {}})},
		'is-interactive': {default: () => interactive},
		inquirer: {prompt},
		execa: {execa: execute},
		'../source/config.js': {default: async () => localConfig},
		'../source/util.js': {readPackage},
		'../source/package-manager/index.js': {getPackageManagerConfig: () => npmConfig},
		'../source/git-util.js': {
			defaultBranch, getCurrentBranch, hasLocalBranch: async () => localBranch, verifyWorkingTreeIsClean,
		},
		'../source/git-tasks.js': {verifyGitTasks},
		'../source/ui.js': {default: ui},
		'../source/index.js': {default: publish},
		'exit-hook': {gracefulExit},
	});
	return {
		prompt, execute, signalListenerCounts, readPackage, ui, publish, verifyGitTasks, verifyWorkingTreeIsClean, getCurrentBranch, defaultBranch, gracefulExit, consoleError,
	};
};

test('cli continues on the current branch for this invocation before the release wizard', async t => {
	const localConfig = {branch: 'release'};
	const {prompt, execute, readPackage, ui, verifyGitTasks} = await loadCli(t, {localConfig});

	assert.ok(prompt.calledOnce);
	assert.equal(prompt.firstCall.firstArg.action.type, 'select');
	assert.deepEqual(prompt.firstCall.firstArg.action.choices.map(choice => choice.value), ['switch', 'current', 'cancel']);
	assert.match(prompt.firstCall.firstArg.action.message, /feature.*release/v);
	assert.ok(execute.notCalled);
	assert.ok(verifyGitTasks.calledOnceWithExactly({anyBranch: true, branch: 'HEAD', remote: undefined}));
	assert.equal(ui.firstCall.firstArg.anyBranch, true);
	assert.equal(ui.firstCall.firstArg.branch, 'HEAD');
	assert.deepEqual(localConfig, {branch: 'release'});
	sinon.assert.callOrder(prompt, verifyGitTasks, readPackage, ui);
});

test('cli keeps continuing from the current branch when restarting after a fast-forward', async t => {
	const historyError = Object.assign(new PresentableError('Remote history differs. Please pull changes.'), {isBehind: true});
	const {prompt, execute, gracefulExit} = await loadCli(t, {historyError});

	assert.equal(prompt.callCount, 2);
	assert.deepEqual(prompt.secondCall.firstArg.action.choices.map(choice => choice.value), ['update', 'cancel']);
	assert.deepEqual(execute.firstCall.args, ['git', ['merge', '--ff-only', '@{u}'], {stdio: 'inherit'}]);
	assert.deepEqual(execute.secondCall.args, [process.execPath, [...process.execArgv, ...process.argv.slice(1), '--any-branch'], {stdio: 'inherit', reject: false}]);
	assert.ok(gracefulExit.calledOnceWithExactly(0));
});

test('cli sanitizes branch labels without changing the branch passed to checkout', async t => {
	const branch = 'rele\u{85}ase';
	const currentBranch = 'fea\u{9B}ture';
	const {prompt, execute} = await loadCli(t, {action: 'switch', flags: {branch}, currentBranch});
	const question = prompt.firstCall.firstArg.action;

	assert.match(question.message, /feature.*release/v);
	assert.doesNotMatch([question.message, ...question.choices.map(choice => choice.name)].join(' '), /\p{Control}/v);
	assert.deepEqual(execute.firstCall.args, ['git', ['checkout', branch, '--']]);
});

for (const exitCode of [0, 1]) {
	test(`cli switches branches and propagates the restarted command exit code ${exitCode}`, async t => {
		const signalListenerCount = process.listenerCount('SIGINT');
		const {execute, signalListenerCounts, readPackage, ui, publish, verifyWorkingTreeIsClean, gracefulExit, consoleError} = await loadCli(t, {action: 'switch', exitCode});

		assert.deepEqual(execute.firstCall.args, ['git', ['checkout', 'main', '--']]);
		assert.deepEqual(execute.secondCall.args, [process.execPath, [...process.execArgv, ...process.argv.slice(1)], {stdio: 'inherit', reject: false}]);
		// Ctrl+C is left to the restarted command only while it runs.
		assert.deepEqual(signalListenerCounts, [signalListenerCount, signalListenerCount + 1]);
		assert.equal(process.listenerCount('SIGINT'), signalListenerCount);
		sinon.assert.callOrder(verifyWorkingTreeIsClean, execute);
		assert.ok(gracefulExit.calledOnceWithExactly(exitCode));
		assert.ok(readPackage.notCalled);
		assert.ok(ui.notCalled);
		assert.ok(publish.notCalled);
		assert.equal(consoleError.mock.callCount(), 0);
	});
}

for (const {description, action, workingTreeError, checkoutError, expectedExitCode} of [
	{description: 'cancel', action: 'cancel', expectedExitCode: undefined},
	{description: 'an unclean working tree', workingTreeError: new Error('Unclean working tree'), expectedExitCode: 1},
	{
		description: 'a failed checkout', action: 'switch', checkoutError: new Error('Checkout failed'), expectedExitCode: 1,
	},
]) {
	test(`cli stops before loading the package when branch resolution ends with ${description}`, async t => {
		const {execute, readPackage, ui, publish, prompt, gracefulExit} = await loadCli(t, {action, workingTreeError, checkoutError});

		assert.ok(readPackage.notCalled);
		assert.ok(ui.notCalled);
		assert.ok(publish.notCalled);
		assert.equal(execute.callCount, checkoutError ? 1 : 0);
		assert.equal(prompt.callCount, workingTreeError ? 0 : 1);
		assert.deepEqual(gracefulExit.firstCall.args, expectedExitCode === undefined ? [] : [expectedExitCode]);
	});
}

for (const {branchLookups = 1, currentBranchLookups = 0, ...options} of [
	{interactive: false},
	{flags: {dryRun: true}},
	{localConfig: {dryRun: true}},
	{localConfig: {preview: true}},
	{flags: {anyBranch: true}, branchLookups: 0},
	{input: ['release-draft'], branchLookups: 0},
	{currentBranch: 'main', currentBranchLookups: 1},
	{localBranch: false, currentBranchLookups: 1},
]) {
	test(`cli skips branch recovery for ${JSON.stringify(options)}`, async t => {
		const {prompt, execute, defaultBranch, getCurrentBranch} = await loadCli(t, options);

		assert.ok(prompt.notCalled);
		assert.ok(execute.notCalled);
		assert.equal(defaultBranch.callCount, branchLookups);
		assert.equal(getCurrentBranch.callCount, currentBranchLookups);
	});
}

test('cli handles cancellation of the branch prompt with Ctrl+C', async t => {
	const {gracefulExit, readPackage, execute, consoleError} = await loadCli(t, {promptError: new ExitPromptError('User canceled')});

	assert.ok(gracefulExit.calledOnceWithExactly(130));
	assert.ok(readPackage.notCalled);
	assert.ok(execute.notCalled);
	assert.equal(consoleError.mock.callCount(), 0);
});

test('switching branches restarts with the target package and executable config', async t => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const directory = await fs.mkdtemp(path.resolve('.ai-temporary', 'branch-restart-'));
	t.after(() => fs.rm(directory, {recursive: true}));
	const projectDirectory = path.join(directory, 'project');
	await fs.mkdir(projectDirectory);
	const git = arguments_ => execa('git', arguments_, {cwd: projectDirectory});
	await git(['init', '--initial-branch=main']);
	await git(['config', 'user.name', 'Test']);
	await git(['config', 'user.email', 'test@example.com']);
	await fs.mkdir(path.join(projectDirectory, 'dist'));
	await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'project', version: '1.0.0', packageManager: 'pnpm@11.3.0'}));
	await fs.writeFile(path.join(projectDirectory, 'dist/package.json'), JSON.stringify({name: 'release-package', version: '1.2.3'}));
	await fs.writeFile(path.join(projectDirectory, '.np-config.mjs'), 'export default {contents: "dist", testScript: "main-test"};\n');
	await git(['add', '.']);
	await git(['commit', '-m', 'Release branch']);
	await git(['checkout', '-b', 'feature']);
	await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'feature-package', version: '2.0.0'}));
	await fs.writeFile(path.join(projectDirectory, '.np-config.mjs'), 'export default {contents: "missing", testScript: "feature-test"};\n');
	await git(['add', '.']);
	await git(['commit', '-m', 'Feature branch']);
	const runner = path.join(directory, 'runner.mjs');
	await fs.writeFile(runner, `
		import esmock from ${JSON.stringify(import.meta.resolve('esmock'))};
		await esmock(${JSON.stringify(path.resolve('source/cli-implementation.js'))}, {}, {
			'update-notifier': {default: () => ({notify() {}})},
			'is-interactive': {default: () => true},
			inquirer: {
				async prompt() {
					return {action: 'switch'};
				},
			},
			${JSON.stringify(path.resolve('source/ui.js'))}: {default: async (options, context) => {
				const {package_} = context;
				console.log(JSON.stringify({version: package_.version, name: package_.name, manager: options.packageManager.id, testScript: options.testScript, branch: options.branch}));
				return {...options, confirm: false};
			}},
		});
	`);
	const {stdout, stderr, exitCode} = await execa(process.execPath, [runner, 'patch', '--no-publish'], {cwd: projectDirectory, reject: false, timeout: 60_000});

	assert.equal(exitCode, 0, stderr);
	assert.deepEqual(JSON.parse(stdout), {
		version: '1.2.3', name: 'release-package', manager: 'pnpm', testScript: 'main-test', branch: 'main',
	});
	const {stdout: currentBranch} = await git(['branch', '--show-current']);
	assert.equal(currentBranch, 'main');
});

test('cli keeps Git validation when branch recovery is unavailable', async t => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const directory = await fs.mkdtemp(path.resolve('.ai-temporary', 'branch-validation-'));
	t.after(() => fs.rm(directory, {recursive: true}));
	const projectDirectory = path.join(directory, 'project');
	await fs.mkdir(projectDirectory);
	const git = arguments_ => execa('git', arguments_, {cwd: projectDirectory});
	await git(['init', '--initial-branch=main']);
	await git(['config', 'user.name', 'Test']);
	await git(['config', 'user.email', 'test@example.com']);
	await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'fixture', version: '1.0.0'}));
	await git(['add', '.']);
	await git(['commit', '-m', 'Initial commit']);
	await git(['checkout', '-b', 'feature']);
	const {stdout: originalHead} = await git(['rev-parse', 'HEAD']);
	const cli = path.resolve('source/cli-implementation.js');
	const runner = path.join(directory, 'runner.mjs');
	await fs.writeFile(runner, `
		import esmock from ${JSON.stringify(import.meta.resolve('esmock'))};
		await esmock(${JSON.stringify(cli)}, {}, {
			'update-notifier': {default: () => ({notify() {}})},
			'is-interactive': {default: () => true},
			inquirer: {
				async prompt() {
					throw new Error('Unexpected branch prompt');
				},
			},
			${JSON.stringify(path.resolve('source/ui.js'))}: {
				default: async () => {
					throw new Error('Unexpected release wizard');
				},
			},
		});
	`);

	for (const {description, interactive, flags = [], branch = 'main'} of [
		{description: 'a noninteractive invocation'},
		{description: 'an interactive dry run', interactive: true, flags: ['--dry-run']},
		{
			description: 'a missing local release branch', interactive: true, flags: ['--branch', 'release'], branch: 'release',
		},
	]) {
		// eslint-disable-next-line no-await-in-loop -- Reuse the repository while checking that every invocation leaves it unchanged.
		await t.test(description, async () => {
			const {stdout, stderr, exitCode} = await execa(process.execPath, [interactive ? runner : cli, 'patch', '--no-publish', ...flags], {cwd: projectDirectory, reject: false, timeout: 20_000});
			assert.equal(exitCode, 1);
			assert.ok(stderr.includes(`Not on \`${branch}\` branch. Use --any-branch to publish anyway`), stderr);
			assert.doesNotMatch(stderr, /Unexpected branch prompt|Unexpected release wizard/v);
			assert.equal(stdout, '');
			const {stdout: currentBranch} = await git(['branch', '--show-current']);
			const {stdout: currentHead} = await git(['rev-parse', 'HEAD']);
			assert.equal(currentBranch, 'feature');
			assert.equal(currentHead, originalHead);
		});
	}
});
