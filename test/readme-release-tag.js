import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';

test('the documented maintenance release command uses a publishable dist-tag', async t => {
	const readme = await fs.readFile(new URL('../readme.md', import.meta.url), 'utf8');
	const example = readme.split('### Release an update to an old major version')[1].split('###')[0];
	const tag = example.match(/--tag=(?<tag>\S+)/v)?.groups.tag;
	assert.ok(tag);
	await fs.mkdir('.ai-temporary', {recursive: true});
	const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'readme-release-tag-'));
	t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
	await fs.writeFile(path.join(temporaryDirectory, 'package.json'), JSON.stringify({name: 'np-readme-maintenance-fixture', version: '1.0.1'}));
	const result = await execa('npm', ['publish', '--dry-run', '--ignore-scripts', '--offline', `--tag=${tag}`], {
		cwd: temporaryDirectory,
		env: {NPM_CONFIG_CACHE: path.join(temporaryDirectory, 'npm-cache')},
		reject: false,
	});
	assert.equal(result.exitCode, 0, result.stderr);
});
