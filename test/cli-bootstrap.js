import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import {npPackage, npRootDirectory} from '../source/util.js';

const cli = path.join(npRootDirectory, 'source', 'cli.js');

for (const fromSubdirectory of [false, true]) {
	test(`the CLI prefers a local ESM installation with top-level await from a subdirectory: ${fromSubdirectory}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'cli-bootstrap-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const localPackage = path.join(temporaryDirectory, 'node_modules', 'np');
		await fs.mkdir(path.join(localPackage, 'source'), {recursive: true});
		await fs.writeFile(path.join(localPackage, 'package.json'), JSON.stringify({name: 'np', version: '99.0.0', type: 'module'}));
		await fs.writeFile(path.join(localPackage, 'source', 'cli.js'), 'await Promise.resolve();\nconsole.log("local fixture");\n');
		const cwd = fromSubdirectory ? path.join(temporaryDirectory, 'src') : temporaryDirectory;
		await fs.mkdir(cwd, {recursive: true});
		const result = await execa(process.execPath, [cli, '--version'], {cwd, reject: false});
		assert.equal(result.exitCode, 0, result.stderr);
		assert.equal(result.stdout, 'local fixture');
	});
}

test('the CLI uses its own installation when no local np is installed', async t => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'cli-bootstrap-'));
	t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
	const {stdout} = await execa(process.execPath, [cli, '--version'], {cwd: temporaryDirectory});
	assert.equal(stdout, npPackage.version);
});

test('the CLI does not hand off to itself when invoked through a local installation', async t => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'cli-bootstrap-'));
	t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
	await fs.mkdir(path.join(temporaryDirectory, 'node_modules'));
	await fs.symlink(npRootDirectory, path.join(temporaryDirectory, 'node_modules', 'np'), 'junction');
	const {stdout} = await execa(process.execPath, [cli, '--version'], {cwd: temporaryDirectory});
	assert.equal(stdout, npPackage.version);
});
