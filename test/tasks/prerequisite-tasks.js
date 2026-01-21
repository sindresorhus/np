import process from 'node:process';
import test from 'ava';
import {npmConfig, yarnConfig} from '../../source/package-manager/configs.js';
import {npPackage} from '../../source/util.js';
import {SilentRenderer} from '../_helpers/listr-renderer.js';
import {_createFixture} from '../_helpers/stub-execa.js';
import {
	run,
	assertTaskFailed,
	assertTaskDisabled,
	assertTaskSkipped,
} from '../_helpers/listr.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/prerequisite-tasks.js')>>} */
const createFixture = _createFixture('../../source/prerequisite-tasks.js', import.meta.url);

test.beforeEach(() => {
	process.env.NODE_ENV = 'test';
});

test.afterEach(() => {
	SilentRenderer.clearTasks();
	process.env.NODE_ENV = 'test';
});

test.serial('public-package published on npm registry: should fail when npm registry not pingable', createFixture, [{
	command: 'npm ping',
	exitCode: 1,
	exitCodeName: 'EPERM',
	stdout: '',
	stderr: 'failed',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('1.0.0', {name: 'test'}, {}, npmConfig)),
		{message: 'Connection to npm registry failed'},
	);

	assertTaskFailed(t, 'Ping npm registry');
});

test.serial('private package: should disable task pinging npm registry', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {}, npmConfig)));

	assertTaskDisabled(t, 'Ping npm registry');
});

test.serial('external registry: should disable task pinging npm registry', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {}, npmConfig)));

	assertTaskDisabled(t, 'Ping npm registry');
});

test.serial('should fail when npm version does not match range in `package.json`', createFixture, [
	{
		command: 'npm --version',
		stdout: '6.0.0',
	},
	{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	const depRange = npPackage.engines.npm;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: `\`np\` requires npm ${depRange}`},
	);

	assertTaskFailed(t, 'Check npm version');
});

test.serial('should fail when yarn version does not match range in `package.json`', createFixture, [
	{
		command: 'yarn --version',
		stdout: '1.0.0',
	},
	{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	const depRange = npPackage.engines.yarn;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, yarnConfig)),
		{message: `\`np\` requires yarn ${depRange}`},
	);

	assertTaskFailed(t, 'Check yarn version');
});

test.serial('should fail when user is not authenticated at npm registry', createFixture, [
	{
		command: 'npm whoami',
		stdout: 'sindresorhus',
	},
	{
		command: 'npm access list collaborators test --json',
		stdout: '{"sindresorhus": "read"}',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(t, 'Verify user is authenticated');
});

test.serial('should fail when user is not authenticated at external registry', createFixture, [
	{
		command: 'npm whoami --registry http://my.io',
		stdout: 'sindresorhus',
	},
	{
		command: 'npm access list collaborators test --json --registry http://my.io',
		stdout: '{"sindresorhus": "read"}',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {}, npmConfig)),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(t, 'Verify user is authenticated');
});

test.serial('should use publishConfig.registry even when set to official npm registry', createFixture, [
	{
		command: 'npm whoami --registry https://registry.npmjs.org/',
		stdout: 'sindresorhus',
	},
	{
		command: 'npm access list collaborators test --json --registry https://registry.npmjs.org/',
		stdout: '{"sindresorhus": "read"}',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'https://registry.npmjs.org/'}}, {}, npmConfig)),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(t, 'Verify user is authenticated');
});

test.serial.todo('should not fail if no collaborators'); // Verify user is authenticated

test.serial('private package: should disable task `verify user is authenticated`', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';

	await t.notThrowsAsync(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {}, npmConfig)));

	process.env.NODE_ENV = 'test';

	assertTaskDisabled(t, 'Verify user is authenticated');
});

test.serial('should fail when git version does not match range in `package.json`', createFixture, [{
	command: 'git version',
	stdout: 'git version 1.0.0',
}], async ({t, testedModule: prerequisiteTasks}) => {
	const depRange = npPackage.engines.git;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: `\`np\` requires git ${depRange}`},
	);

	assertTaskFailed(t, 'Check git version');
});

test.serial('should fail when git user.name is not set', createFixture, [{
	command: 'git config user.name',
	exitCode: 1,
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: /Git user configuration is not set/},
	);

	assertTaskFailed(t, 'Check git user configuration');
});

test.serial('should fail when git user.email is not set', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	exitCode: 1,
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: /Git user configuration is not set/},
	);

	assertTaskFailed(t, 'Check git user configuration');
});

test.serial('should fail when git remote does not exist', createFixture, [{
	command: 'git ls-remote origin HEAD',
	exitCode: 1,
	exitCodeName: 'EPERM',
	stderr: 'not found',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: 'not found'},
	);

	assertTaskFailed(t, 'Check git remote');
});

test.serial('should fail when version is invalid', createFixture, [], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('DDD', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: 'New version DDD should either be one of patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid SemVer version.'},
	);

	assertTaskFailed(t, 'Validate version');
});

test.serial('should fail when version is lower than latest version', createFixture, [], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('0.1.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: 'New version 0.1.0 should be higher than current version 1.0.0.'},
	);

	assertTaskFailed(t, 'Validate version');
});

test.serial('should fail when prerelease version of public package without dist tag given', createFixture, [], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag'},
	);

	assertTaskFailed(t, 'Check for pre-release version');
});

test.serial('should not fail when prerelease version of public package with dist tag given', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {tag: 'pre'}, npmConfig)));
});

test.serial('should not fail when prerelease version of private package without dist tag given', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0', private: true}, {}, npmConfig)));
});

test.serial('should fail when git tag already exists', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: 'vvb',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)),
		{message: 'Git tag `v2.0.0` already exists.'},
	);

	assertTaskFailed(t, 'Check git tag existence');
});

test.serial('checks should pass', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)));
});

test.serial('should skip authentication check when OIDC is detected', createFixture, [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';
	process.env.GITHUB_ACTIONS = 'true';
	process.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'url';
	process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'token';

	t.teardown(() => {
		delete process.env.GITHUB_ACTIONS;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
		process.env.NODE_ENV = 'test';
	});

	await t.notThrowsAsync(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, npmConfig)));

	assertTaskSkipped(t, 'Verify user is authenticated');
});
