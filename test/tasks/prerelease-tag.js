import assert from 'node:assert/strict';
import {npmConfig} from '../../source/package-manager/configs.js';
import {_createFixture} from '../_helpers/stub-execa.js';
import {run, assertTaskFailed} from '../_helpers/task-list.js';

const createFixture = _createFixture('../../source/prerequisite-tasks.js', import.meta.url);
const commands = [
	{command: 'git rev-parse @{u}', exitCode: 1, stderr: 'fatal: no upstream configured'},
	{command: 'git config user.name', stdout: 'Test User'},
	{command: 'git config user.email', stdout: 'test@example.com'},
	{command: 'npm config get tag-version-prefix --workspaces=false', stdout: 'v'},
	{command: 'git rev-parse --quiet --verify refs/tags/v1.1.0-beta.0', stdout: ''},
	{command: 'git rev-parse --quiet --verify refs/tags/v1.1.0', stdout: ''},
];

for (const tag of ['latest', 'LAteSt']) {
	createFixture(`rejects explicit ${tag} for a prerelease`, commands, async ({testedModule: prerequisiteTasks}) => {
		const tasks = prerequisiteTasks('1.1.0-beta.0', {name: 'test', version: '1.0.0'}, {tag, yolo: true}, {packageManager: npmConfig});
		await assert.rejects(run(tasks), /dist-tag.*latest/v);
		assertTaskFailed(tasks, 'Check for pre-release version');
	});
}

for (const {version, tag, private: isPrivate = false} of [
	{version: '1.1.0', tag: 'latest'},
	{version: '1.1.0-beta.0', tag: 'next'},
	{version: '1.1.0-beta.0', private: true},
]) {
	createFixture(`allows ${version} with tag ${tag} for private package ${isPrivate}`, commands, async ({testedModule: prerequisiteTasks}) => {
		const tasks = prerequisiteTasks(version, {name: 'test', version: '1.0.0', private: isPrivate}, {tag, yolo: true}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));
	});
}
