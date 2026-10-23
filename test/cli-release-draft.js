import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {stripVTControlCharacters} from 'node:util';
import {execa} from 'execa';
import esmock from 'esmock';

const cli = path.resolve(import.meta.dirname, '../source/cli.js');

test('release-draft previews the tagged release without requiring a release branch or clean working tree', async t => {
	await fs.mkdir('.ai-temporary', {recursive: true});
	const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'cli-release-draft-'));
	t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
	const git = arguments_ => execa('git', arguments_, {cwd: temporaryDirectory});
	await git(['init', '--initial-branch=feature']);
	await git(['config', 'user.name', 'Test']);
	await git(['config', 'user.email', 'test@example.com']);
	const packagePath = path.join(temporaryDirectory, 'package.json');
	const package_ = {name: 'fixture', version: '1.0.0', repository: 'https://github.com/example/fixture'};
	await fs.writeFile(packagePath, JSON.stringify(package_));
	await fs.writeFile(path.join(temporaryDirectory, '.npmrc'), 'tag-version-prefix=v\n');
	await git(['add', '.']);
	await git(['commit', '-m', 'Initial release']);
	await git(['tag', 'v1.0.0']);
	await git(['commit', '--allow-empty', '-m', 'Released improvement']);
	await fs.writeFile(packagePath, JSON.stringify({...package_, version: '1.1.0'}));
	await git(['commit', '-am', '1.1.0']);
	await git(['tag', 'v1.1.0']);
	await fs.writeFile(path.join(temporaryDirectory, 'untracked.txt'), 'Uncommitted work');
	const {stdout: headBefore} = await git(['rev-parse', 'HEAD']);
	const manifestBefore = await fs.readFile(packagePath, 'utf8');

	const {exitCode, stdout, stderr} = await execa(process.execPath, [cli, 'release-draft', '--dry-run'], {
		cwd: temporaryDirectory,
		env: {FORCE_COLOR: '1'},
		reject: false,
		timeout: 20_000,
	});

	assert.equal(exitCode, 0, stderr);
	assert.match(stripVTControlCharacters(stdout), /Create a release draft on GitHub for fixture/v);
	assert.match(stdout, /Released improvement/v);
	assert.match(stdout, /compare\/v1\.0\.0\.\.\.v1\.1\.0/v);
	assert.doesNotMatch(stdout, /published|Publish a new version/v);

	await t.test('opens the latest tag without release notes', async t => { // eslint-disable-line no-shadow -- node:test requires the subtest's own context to be named t.
		t.mock.property(process, 'argv', [process.execPath, cli, 'release-draft', '--no-release-notes']);
		t.mock.method(process, 'cwd', () => temporaryDirectory);
		t.mock.method(console, 'log', () => {});
		const consoleErrorMock = t.mock.method(console, 'error', () => {});
		let openedUrl;
		const exits = [];

		await esmock('../source/cli-implementation.js', {}, {
			'update-notifier': {default: () => ({notify() {}})},
			execa: {execa: async (command, arguments_, options) => execa(command, arguments_, {...options, cwd: temporaryDirectory})},
			async open(url) {
				openedUrl = url;
			},
			'exit-hook': {
				gracefulExit(code) {
					exits.push(code);
				},
			},
		});

		assert.equal(consoleErrorMock.mock.callCount(), 0);
		assert.deepEqual(exits, [undefined]);
		const url = new URL(openedUrl);
		assert.equal(url.origin + url.pathname, 'https://github.com/example/fixture/releases/new');
		assert.equal(url.searchParams.get('tag'), 'v1.1.0');
		assert.equal(url.searchParams.get('body'), '');
	});

	const {stdout: headAfter} = await git(['rev-parse', 'HEAD']);
	assert.equal(headAfter, headBefore);
	assert.equal(await fs.readFile(packagePath, 'utf8'), manifestBefore);
});
