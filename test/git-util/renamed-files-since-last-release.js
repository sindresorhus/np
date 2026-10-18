import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import esmock from 'esmock';

for (const {filename, expected} of [
	{filename: 'new.js', expected: {unpublished: [], firstTime: ['new.js']}},
	{filename: 'new.md', expected: {unpublished: ['new.md'], firstTime: []}},
]) {
	test(`renamed files are classified against packed files: ${filename}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'renamed-files-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const git = arguments_ => execa('git', arguments_, {cwd: temporaryDirectory});
		await git(['init']);
		await git(['config', 'user.name', 'Test']);
		await git(['config', 'user.email', 'test@example.com']);
		await fs.writeFile(path.join(temporaryDirectory, 'package.json'), JSON.stringify({name: 'fixture', version: '1.0.0', files: ['*.js']}));
		await fs.writeFile(path.join(temporaryDirectory, 'old.js'), 'export const value = true;\n');
		await git(['add', '.']);
		await git(['commit', '-m', 'Initial release']);
		await git(['tag', 'v1.0.0']);
		await git(['mv', 'old.js', filename]);
		await git(['commit', '-m', 'Rename entry point']);
		const {getNewFiles} = await esmock('../../source/util.js', {}, {
			execa: {
				async execa(command, arguments_, options) {
					return execa(command, arguments_, {...options, cwd: temporaryDirectory});
				},
			},
		});

		assert.deepEqual(await getNewFiles(temporaryDirectory), expected);
	});
}
