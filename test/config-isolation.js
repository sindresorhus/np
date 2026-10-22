import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import esmock from 'esmock';

test('the local binary does not inherit an operating system global config', async t => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'config-isolation-'));
	t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
	const projectDirectory = path.join(temporaryDirectory, 'project');
	await fs.mkdir(projectDirectory);
	await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'fixture', version: '1.0.0'}));
	const {stdout} = await execa(process.execPath, ['--input-type=module', '--eval', String.raw`
		import fs from 'node:fs/promises';
		import path from 'node:path';
		import {createRequire} from 'node:module';
		import getConfig from './source/config.js';
		const envPaths = createRequire(import.meta.resolve('cosmiconfig'))('env-paths');
		const globalDirectory = envPaths('np', {suffix: ''}).config;
		await fs.mkdir(globalDirectory, {recursive: true});
		await fs.writeFile(path.join(globalDirectory, 'config.json'), JSON.stringify({contents: 'unexpected-global-directory'}));
		// Write the string directly, because logging undefined uses util.inspect, which adds color codes when the stream supports colors.
		process.stdout.write(JSON.stringify(await getConfig(process.argv[1])) + '\n');
	`, projectDirectory], {
		env: {
			HOME: temporaryDirectory,
			XDG_CONFIG_HOME: path.join(temporaryDirectory, 'config'),
			APPDATA: temporaryDirectory,
			LOCALAPPDATA: temporaryDirectory,
		},
	});

	assert.equal(stdout, 'undefined');
});

test('the global binary merges home config with project overrides', async t => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'config-merge-'));
	t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
	const homeDirectory = path.join(temporaryDirectory, 'home');
	const projectDirectory = path.join(temporaryDirectory, 'project');
	const unconfiguredProjectDirectory = path.join(temporaryDirectory, 'unconfigured-project');
	await fs.mkdir(homeDirectory);
	await fs.mkdir(projectDirectory);
	await fs.mkdir(unconfiguredProjectDirectory);
	await fs.writeFile(path.join(homeDirectory, '.np-config.json'), JSON.stringify({tests: false, cleanup: false}));
	await fs.writeFile(path.join(projectDirectory, '.np-config.json'), JSON.stringify({tests: true}));
	const getConfig = await esmock('../source/config.js', {
		'is-installed-globally': true,
		'node:os': {homedir: () => homeDirectory},
	});

	assert.deepEqual(await getConfig(projectDirectory), {tests: true, cleanup: false});
	assert.deepEqual(await getConfig(unconfiguredProjectDirectory), {tests: false, cleanup: false});
});
