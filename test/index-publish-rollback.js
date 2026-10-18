import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import esmock from 'esmock';
import {npmConfig} from '../source/package-manager/configs.js';

for (const {name, scripts, uploaded, preserved} of [
	{
		name: 'publish lifecycle failure', scripts: {publish: 'node -e "process.exit(1)"'}, uploaded: true, preserved: true,
	},
	{
		name: 'postpublish lifecycle failure', scripts: {postpublish: 'node -e "process.exit(1)"'}, uploaded: true, preserved: true,
	},
	{
		name: 'prepublishOnly failure with a postpublish hook', scripts: {prepublishOnly: 'node -e "process.exit(1)"', postpublish: 'node -e "process.exit(0)"'}, uploaded: false, preserved: true,
	},
	{
		name: 'registry rejection without publish hooks', scripts: {}, uploaded: false, preserved: false,
	},
]) {
	test(`failed publish preserves release state only when upload success is uncertain: ${name}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'publish-rollback-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const uploadedVersions = [];
		const server = http.createServer(async (request, response) => {
			if (request.method === 'PUT' && preserved) {
				let body = '';
				for await (const chunk of request) {
					body += chunk;
				}

				uploadedVersions.push(...Object.keys(JSON.parse(body).versions));
				response.writeHead(201, {'content-type': 'application/json'});
				response.end(JSON.stringify({ok: true}));
				return;
			}

			response.writeHead(request.method === 'PUT' ? 403 : 404, {'content-type': 'application/json'});
			response.end(JSON.stringify({error: 'not allowed'}));
		});
		await new Promise(resolve => {
			server.listen(0, '127.0.0.1', resolve);
		});
		t.after(() => new Promise(resolve => {
			server.close(resolve);
		}));
		const registry = `127.0.0.1:${server.address().port}`;
		const package_ = {name: 'publish-rollback-fixture', version: '1.0.0', scripts};
		await fs.writeFile(path.join(temporaryDirectory, 'package.json'), JSON.stringify(package_));
		await fs.writeFile(path.join(temporaryDirectory, '.npmrc'), `registry=http://${registry}/\n//${registry}/:_authToken=synthetic-fixture\nfetch-retries=0\n`);
		const run = (command, arguments_, options = {}) => execa(command, arguments_, {...options, cwd: temporaryDirectory});
		await run('git', ['init']);
		await run('git', ['config', 'user.name', 'Test']);
		await run('git', ['config', 'user.email', 'test@example.com']);
		await run('git', ['add', '.']);
		await run('git', ['commit', '-m', 'Initial release']);
		let exitCallback;
		const np = await esmock('../source/index.js', {
			'../source/prerequisite-tasks.js'() {},
			'../source/git-tasks.js'() {},
			'exit-hook': {
				asyncExitHook(callback) {
					exitCallback = callback;
				},
			},
		}, {execa: {execa: run}});
		t.mock.method(console, 'log', () => {});

		let publishError;
		await assert.rejects(np('1.1.0', {
			packageManager: npmConfig,
			runPublish: true,
			yolo: true,
			tests: false,
			cleanup: false,
			availability: {},
			renderer: 'silent',
		}, {package_, rootDirectory: temporaryDirectory}), error => {
			assert.match(error.message, /Error publishing package/v);
			publishError = error;
			return true;
		});

		await exitCallback();
		assert.deepEqual(uploadedVersions, uploaded ? ['1.1.0'] : []);
		const {stdout: tag} = await run('git', ['tag', '--list', 'v1.1.0']);
		assert.equal(tag, preserved ? 'v1.1.0' : '');
		const currentPackage = JSON.parse(await fs.readFile(path.join(temporaryDirectory, 'package.json'), 'utf8'));
		assert.equal(currentPackage.version, preserved ? '1.1.0' : '1.0.0');
		assert.match(publishError.message, preserved ? /release commit and tag were preserved/v : /rolled back to its previous state/v);
	});
}
