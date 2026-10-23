import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import test from 'node:test';
import {npmConfig, pnpmConfig, yarnConfig} from '../../source/package-manager/configs.js';
import {npPackage} from '../../source/util.js';
import {_createFixture} from '../_helpers/stub-execa.js';
import {
	run,
	assertTaskFailed,
	assertTaskDisabled,
	assertTaskSkipped,
} from '../_helpers/task-list.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/prerequisite-tasks.js')>>}
*/
const createStubFixture = _createFixture('../../source/prerequisite-tasks.js', import.meta.url);
// Command fixtures should not inherit the checkout's real tracking branch.
const createFixture = (title, commands, assertions) => createStubFixture(title, [{
	command: 'git rev-parse @{u}',
	exitCode: 1,
	stderr: 'fatal: no upstream configured',
}, ...commands], assertions);
const generatedEntryPointFixture = path.resolve('test', 'fixtures', 'files', 'prepack-generated-entry-point');

test.beforeEach(() => {
	process.env.NODE_ENV = 'test';
});

test.afterEach(() => {
	process.env.NODE_ENV = 'test';
});

createFixture(
	'public-package published on npm registry: should fail when npm registry not pingable',
	[{
		command: 'npm ping',
		exitCode: 1,
		exitCodeName: 'EPERM',
		stdout: '',
		stderr: 'failed',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
		await assert.rejects(
			run(tasks),
			{message: 'Connection to npm registry failed'},
		);

		assertTaskFailed(tasks, 'Ping npm registry');
	},
);

createFixture('private package: should disable task pinging npm registry', [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));

	assertTaskDisabled(tasks, 'Ping npm registry');
});

createFixture('external registry: should disable task pinging npm registry', [{
	command: 'npm view --json test@1.0.0 engines --registry http://my.io',
	stdout: '',
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));

	assertTaskDisabled(tasks, 'Ping npm registry');
});

createFixture('should fail when npm version does not match range in `package.json`', [
	{
		command: 'npm --version',
		stdout: '6.0.0',
	},
	{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	},
], async ({
	testedModule: prerequisiteTasks,
}) => {
	const depRange = npPackage.engines.npm;

	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: `\`np\` requires npm ${depRange}`},
	);

	assertTaskFailed(tasks, 'Check npm version');
});

createFixture('should fail when yarn version does not match range in `package.json`', [
	{
		command: 'yarn --version',
		stdout: '1.0.0',
	},
	{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	},
], async ({
	testedModule: prerequisiteTasks,
}) => {
	const depRange = npPackage.engines.yarn;

	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: yarnConfig});
	await assert.rejects(
		run(tasks),
		{message: `\`np\` requires yarn ${depRange}`},
	);

	assertTaskFailed(tasks, 'Check yarn version');
});

createFixture('should fail when user is not authenticated at npm registry', [
	{
		command: 'npm whoami',
		stdout: 'sindresorhus',
	},
	{
		command: 'npm access list collaborators test --json',
		stdout: '{"sindresorhus": "read"}',
	},
], async ({
	testedModule: prerequisiteTasks,
}) => {
	process.env.NODE_ENV = 'P';

	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(tasks, 'Verify user is authenticated');
});

createFixture('a dry run does not require npm authentication', [{
	command: 'npm whoami',
	exitCode: 1,
	stderr: 'npm error code ENEEDAUTH',
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'npm config get tag-version-prefix --workspaces=false',
	stdout: 'v',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'production';

	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {dryRun: true, yolo: true}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
	assertTaskDisabled(tasks, 'Verify user is authenticated');
});

createFixture('should fail when user is not authenticated at external registry', [
	{
		command: 'npm whoami --registry http://my.io',
		stdout: 'sindresorhus',
	},
	{
		command: 'npm access list collaborators test --json --registry http://my.io',
		stdout: '{"sindresorhus": "read"}',
	},
], async ({
	testedModule: prerequisiteTasks,
}) => {
	process.env.NODE_ENV = 'P';

	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(tasks, 'Verify user is authenticated');
});

createFixture(
	'should use publishConfig.registry even when set to official npm registry',
	[
		{
			command: 'npm whoami --registry https://registry.npmjs.org/',
			stdout: 'sindresorhus',
		},
		{
			command: 'npm access list collaborators test --json --registry https://registry.npmjs.org/',
			stdout: '{"sindresorhus": "read"}',
		},
	],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		process.env.NODE_ENV = 'P';

		const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'https://registry.npmjs.org/'}}, {}, {packageManager: npmConfig});
		await assert.rejects(
			run(tasks),
			{message: 'You do not have write permissions required to publish this package.'},
		);

		process.env.NODE_ENV = 'test';

		assertTaskFailed(tasks, 'Verify user is authenticated');
	},
);

test.todo('should not fail if no collaborators'); // Verify user is authenticated

createFixture('private package: should disable task `verify user is authenticated`', [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';

	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));

	process.env.NODE_ENV = 'test';

	assertTaskDisabled(tasks, 'Verify user is authenticated');
});

createFixture('should fail when git version does not match range in `package.json`', [{
	command: 'git version',
	stdout: 'git version 1.0.0',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const depRange = npPackage.engines.git;

	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: `\`np\` requires git ${depRange}`},
	);

	assertTaskFailed(tasks, 'Check git version');
});

createFixture('should fail when git user.name is not set', [{
	command: 'git config user.name',
	exitCode: 1,
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: /Git user configuration is not set/v},
	);

	assertTaskFailed(tasks, 'Check git user configuration');
});

createFixture('should fail when git user.email is not set', [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	exitCode: 1,
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: /Git user configuration is not set/v},
	);

	assertTaskFailed(tasks, 'Check git user configuration');
});

createFixture('should fail when git remote does not exist', [{
	command: 'git ls-remote origin HEAD',
	exitCode: 1,
	exitCodeName: 'EPERM',
	stderr: 'not found',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: 'not found'},
	);

	assertTaskFailed(tasks, 'Check git remote and tag existence');
});

createFixture(
	'should fail when version is invalid',
	[],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('DDD', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
		await assert.rejects(
			run(tasks),
			{message: 'New version DDD should either be one of patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid SemVer version.'},
		);

		assertTaskFailed(tasks, 'Validate version');
	},
);

createFixture(
	'should fail when version is lower than latest version',
	[],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('0.1.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
		await assert.rejects(
			run(tasks),
			{message: 'New version 0.1.0 should be higher than current version 1.0.0.'},
		);

		assertTaskFailed(tasks, 'Validate version');
	},
);

createFixture(
	'should fail when prerelease version of public package without dist tag given',
	[],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
		await assert.rejects(
			run(tasks),
			{message: 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag'},
		);

		assertTaskFailed(tasks, 'Check for pre-release version');
	},
);

createFixture(
	'should not fail when prerelease version of public package with dist tag given',
	[{
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {tag: 'pre'}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));
	},
);

createFixture(
	'should not fail when prerelease version of private package without dist tag given',
	[{
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0', private: true}, {}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));
	},
);

createFixture('should fail when git tag already exists', [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: 'vvb',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: 'Git tag `v2.0.0` already exists.'},
	);

	assertTaskFailed(tasks, 'Check git remote and tag existence');
});

createFixture('checks should pass', [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture('fetches tags from the selected release remote', [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git ls-remote release HEAD',
	stdout: 'abc123\tHEAD',
}, {
	command: 'git fetch',
	exitCode: 1,
	stderr: 'The default remote is unavailable',
}, {
	command: 'git fetch release',
	stdout: '',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({testedModule: prerequisiteTasks}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {remote: 'release', yolo: true}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture('rejects when fetching from the selected release remote fails', [{
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git ls-remote release HEAD',
	stdout: 'abc123\tHEAD',
}, {
	command: 'git fetch release',
	exitCode: 1,
	stderr: 'The selected remote could not be fetched',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({testedModule: prerequisiteTasks}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {remote: 'release', yolo: true}, {packageManager: npmConfig});
	await assert.rejects(run(tasks), {stderr: 'The selected remote could not be fetched'});
	assertTaskFailed(tasks, 'Check git remote and tag existence');
});

createFixture(
	'should fail when pnpm ignore-scripts prevents the build script from running',
	[{
		command: 'pnpm --version',
		stdout: '11.13.0',
	}, {
		command: 'pnpm config get ignore-scripts',
		stdout: 'true',
	}, {
		// Keep this expected command in sync with the `devEngines.packageManager` bypass.
		command: 'npm pack --dry-run --json --silent --ignore-scripts --force --foreground-scripts=false',
		stdout: '[{"files":[]}]',
	}, {
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'npm config get tag-version-prefix --workspaces=false',
		stdout: 'v',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v1.0.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('1.0.0', {
			name: 'test',
			version: '0.0.0',
			private: true,
			main: 'dist/index.js',
			scripts: {
				prepack: 'build',
			},
		}, {}, {packageManager: pnpmConfig, rootDirectory: generatedEntryPointFixture});
		await assert.rejects(
			run(tasks),
			{message: /ignore-scripts.*package manager config.*\.npmrc/sv},
		);

		assertTaskFailed(tasks, 'Verify package entry points');
	},
);

createFixture(
	'should fail when Yarn ignore-scripts prevents the build script from running',
	[{
		command: 'yarn --version',
		stdout: '1.22.22',
	}, {
		command: 'yarn config get ignore-scripts',
		stdout: 'true',
	}, {
		// Keep this expected command in sync with the `devEngines.packageManager` bypass.
		command: 'npm pack --dry-run --json --silent --ignore-scripts --force --foreground-scripts=false',
		stdout: '[{"files":[]}]',
	}, {
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'yarn config get version-tag-prefix',
		stdout: 'v',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v1.0.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('1.0.0', {
			name: 'test',
			version: '0.0.0',
			private: true,
			main: 'dist/index.js',
			scripts: {
				prepack: 'build',
			},
		}, {}, {packageManager: yarnConfig, rootDirectory: generatedEntryPointFixture});
		await assert.rejects(
			run(tasks),
			{message: /ignore-scripts.*package manager config.*\.yarnrc/sv},
		);

		assertTaskFailed(tasks, 'Verify package entry points');
	},
);

for (const [provider, env] of [
	['GitHub Actions', {GITHUB_ACTIONS: 'true', ACTIONS_ID_TOKEN_REQUEST_URL: 'url', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token'}],
	['CircleCI', {CIRCLECI: 'true', NPM_ID_TOKEN: 'token'}],
]) {
	createFixture(`should skip authentication check when ${provider} OIDC is detected`, [{
		command: 'npm whoami',
		exitCode: 1,
		stderr: 'ENEEDAUTH This command requires you to be logged in.',
	}, {
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	}], async ({t, testedModule: prerequisiteTasks}) => {
		t.mock.property(process, 'env', {
			...process.env, NODE_ENV: 'production', GITHUB_ACTIONS: '', GITLAB_CI: '', CIRCLECI: '', ...env,
		});

		const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));

		assertTaskSkipped(tasks, 'Verify user is authenticated');
	});
}

createFixture('should fail when dropping Node.js support in a minor release', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=16'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a minor bump.'},
	);

	assertTaskFailed(tasks, 'Check for Node.js engine support drop');
});

createFixture(
	'should fail when dropping Node.js support with array-wrapped engines (npm 12)',
	[{
		command: 'npm view --json test@1.0.0 engines',
		stdout: JSON.stringify([{node: '>=16'}]),
	}, {
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig});
		await assert.rejects(
			run(tasks),
			{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a minor bump.'},
		);

		assertTaskFailed(tasks, 'Check for Node.js engine support drop');
	},
);

createFixture('should fail when dropping Node.js support in a patch release', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=16'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.0.1',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.0.1', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a patch bump.'},
	);

	assertTaskFailed(tasks, 'Check for Node.js engine support drop');
});

createFixture('should not fail when dropping Node.js support in a major release', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=16'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture('should not fail when dropping Node.js support in a premajor release', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=16'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0-0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('2.0.0-0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture(
	'should not fail when dropping Node.js support in a pre-1.0.0 minor release',
	[{
		command: 'npm view --json test@0.1.0 engines',
		stdout: JSON.stringify({node: '>=16'}),
	}, {
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v0.2.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('0.2.0', {name: 'test', version: '0.1.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));
	},
);

createFixture('should not fail when engines.node was not previously set', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture('should not fail when first publishing a package', [{
	command: 'npm view --json test@0.0.0 engines',
	exitCode: 1,
	stderr: 'E404 Not Found',
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.0.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.0.0', {name: 'test', version: '0.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture('should not fail when local package has no engines.node', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=16'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture(
	'private package: should disable task checking for Node.js engine support drop',
	[{
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const package_ = {
			name: 'test',
			version: '1.0.0',
			private: true,
			engines: {node: '>=18'},
		};

		const tasks = prerequisiteTasks('1.1.0', package_, {}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));

		assertTaskDisabled(tasks, 'Check for Node.js engine support drop');
	},
);

createFixture('should not fail when Node.js minimum version stays the same', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=18'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture('should not fail when Node.js minimum version is lowered', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=18'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=16'}}, {}, {packageManager: npmConfig});
	await assert.doesNotReject(run(tasks));
});

createFixture('should fail when dropping Node.js support in a preminor release', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=16'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.1.0-0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.1.0-0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a preminor bump.'},
	);

	assertTaskFailed(tasks, 'Check for Node.js engine support drop');
});

createFixture('should fail when dropping Node.js support in a prepatch release', [{
	command: 'npm view --json test@1.0.0 engines',
	stdout: JSON.stringify({node: '>=16'}),
}, {
	command: 'git config user.name',
	stdout: 'Test User',
}, {
	command: 'git config user.email',
	stdout: 'test@example.com',
}, {
	command: 'git rev-parse --quiet --verify refs/tags/v1.0.1-0',
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const tasks = prerequisiteTasks('1.0.1-0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig});
	await assert.rejects(
		run(tasks),
		{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a prepatch bump.'},
	);

	assertTaskFailed(tasks, 'Check for Node.js engine support drop');
});

createFixture(
	'should not fail when dropping Node.js support in a prerelease release',
	[{
		command: 'npm view --json test engines',
		stdout: JSON.stringify({node: '>=16'}),
	}, {
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v1.0.0-1',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const tasks = prerequisiteTasks('1.0.0-1', {name: 'test', version: '1.0.0-0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));
	},
);

createFixture(
	'yolo mode: should disable task checking for Node.js engine support drop',
	[{
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const package_ = {
			name: 'test',
			version: '1.0.0',
			engines: {node: '>=18'},
		};

		// Should not throw even though we're dropping Node.js support in a minor release,
		// because yolo mode skips this check
		const tasks = prerequisiteTasks('1.1.0', package_, {yolo: true}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));

		assertTaskDisabled(tasks, 'Check for Node.js engine support drop');
	},
);

createFixture(
	'external registry: should skip engine check when registry returns error',
	[{
		command: 'npm view --json test@1.0.0 engines --registry http://my.io',
		exitCode: 1,
		stderr: 'E405 Method Not Allowed',
	}, {
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: 'git rev-parse --quiet --verify refs/tags/v1.1.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		const package_ = {
			name: 'test',
			version: '1.0.0',
			engines: {node: '>=18'},
			publishConfig: {registry: 'http://my.io'},
		};

		// Should not throw even though we're dropping Node.js support in a minor release,
		// because the external registry doesn't support the npm view endpoint
		const tasks = prerequisiteTasks('1.1.0', package_, {}, {packageManager: npmConfig});
		await assert.doesNotReject(run(tasks));
	},
);

for (const [version, bump, shouldReject] of [['0.1.1', 'patch', true], ['0.1.1-0', 'prepatch', true], ['0.2.0-0', 'preminor', false]]) {
	createFixture(`Node.js support drop in a pre-1.0.0 ${bump} release ${shouldReject ? 'fails' : 'passes'}`, [{
		command: 'npm view --json test@0.1.0 engines',
		stdout: JSON.stringify({node: '>=16'}),
	}, {
		command: 'git config user.name',
		stdout: 'Test User',
	}, {
		command: 'git config user.email',
		stdout: 'test@example.com',
	}, {
		command: `git rev-parse --quiet --verify refs/tags/v${version}`,
		stdout: '',
	}], async ({testedModule: prerequisiteTasks}) => {
		const tasks = prerequisiteTasks(version, {name: 'test', version: '0.1.0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig});
		if (shouldReject) {
			await assert.rejects(run(tasks), {message: `Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a ${bump} bump.`});
			assertTaskFailed(tasks, 'Check for Node.js engine support drop');
		} else {
			await assert.doesNotReject(run(tasks));
		}
	});
}
