import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {getPublishedPackageEngines} from '../../source/npm/util.js';
import {npmConfig} from '../../source/package-manager/configs.js';

for (const {name, currentVersion, nextVersion, node, shouldReject, packageName = 'maintenance-engine-fixture'} of [
	{
		name: 'maintenance patch', currentVersion: '1.0.0', nextVersion: '1.0.1', node: '>=18', shouldReject: true,
	},
	{
		name: 'maintenance minor', currentVersion: '1.0.0', nextVersion: '1.1.0', node: '>=18', shouldReject: true,
	},
	{
		name: 'scoped maintenance patch', currentVersion: '1.0.0', nextVersion: '1.0.1', node: '>=18', shouldReject: true, packageName: '@fixture/maintenance-engine-fixture',
	},
	{
		name: 'unchanged maintenance engines', currentVersion: '1.0.0', nextVersion: '1.0.1', node: '>=16', shouldReject: false,
	},
	{
		name: 'maintenance major', currentVersion: '1.0.0', nextVersion: '2.0.0', node: '>=18', shouldReject: false,
	},
	{
		name: 'current latest patch', currentVersion: '3.0.0', nextVersion: '3.0.1', node: '>=24', shouldReject: true,
	},
	{
		name: 'prerelease promotion', currentVersion: '3.1.0-beta.0', nextVersion: '3.1.0', node: '>=24', shouldReject: true,
	},
]) {
	test(`engine protection uses the correct published baseline: ${name}`, async t => {
		const versions = Object.fromEntries([
			['1.0.0', '>=16'], ['3.0.0', '>=22'], ['3.1.0-beta.0', '>=24'],
		].map(([version, nodeRange]) => [version, {name: packageName, version, engines: {node: nodeRange}}]));
		const metadata = JSON.stringify({name: packageName, 'dist-tags': {latest: '3.0.0'}, versions});
		const server = http.createServer((_, response) => {
			response.writeHead(200, {'content-type': 'application/json'});
			response.end(metadata);
		});
		await new Promise(resolve => {
			server.listen(0, '127.0.0.1', resolve);
		});
		t.after(() => new Promise(resolve => {
			server.close(resolve);
		}));
		const prerequisiteTasks = await esmock('../../source/prerequisite-tasks.js', import.meta.url, {
			'../../source/npm/util.js': {getPublishedPackageEngines, async verifyPackageEntryPoints() {}, async isIgnoreScriptsEnabled() {}},
			'../../source/git-util.js': {
				async verifyRecentGitVersion() {}, async verifyUserConfigIsSet() {}, async hasUpstream() {},
				async verifyRemoteIsValid() {}, async fetch() {}, async verifyTagDoesNotExistOnRemote() {},
			},
			'../../source/util.js': {getTagVersionPrefix: async () => 'v'},
			execa: {execa: async () => ({stdout: '12.2.0'})},
		});
		const tasks = prerequisiteTasks(nextVersion, {
			name: packageName, version: currentVersion, engines: {node},
			publishConfig: {registry: `http://127.0.0.1:${server.address().port}/`},
		}, {}, {packageManager: npmConfig});
		const outcome = await tasks.run({renderer: 'silent'}).then(() => undefined).catch(error => error);
		assert.equal(Boolean(outcome), shouldReject, outcome?.message ?? 'A maintenance release must compare against its own published version.');
		assert.match(outcome?.message ?? '', shouldReject ? /requires a major version bump/v : /^$/v);
	});
}
