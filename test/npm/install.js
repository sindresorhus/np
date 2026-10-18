import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import {npmConfig} from '../../source/package-manager/configs.js';

for (const environment of [{NODE_ENV: 'production'}, {NPM_CONFIG_OMIT: 'dev'}]) {
	test(`npm locked install keeps test dependencies with ${JSON.stringify(environment)}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'npm-dev-dependency-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		await fs.mkdir(path.join(temporaryDirectory, 'test-tool'));
		await fs.writeFile(path.join(temporaryDirectory, 'test-tool/package.json'), JSON.stringify({name: 'test-tool', version: '1.0.0'}));
		await fs.writeFile(path.join(temporaryDirectory, 'package.json'), JSON.stringify({name: 'fixture', version: '1.0.0', devDependencies: {'test-tool': 'file:./test-tool'}}));
		const options = {cwd: temporaryDirectory, env: {NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false'}};
		await execa('npm', ['install', '--package-lock-only', '--ignore-scripts'], options);

		await execa(...npmConfig.installCommand, {...options, env: {...options.env, ...environment}});

		// Tests and pack lifecycle scripts need development tools even in a production-configured shell.
		const installedPackage = await fs.readFile(path.join(temporaryDirectory, 'node_modules/test-tool/package.json'), 'utf8');
		assert.equal(JSON.parse(installedPackage).name, 'test-tool');
	});
}
