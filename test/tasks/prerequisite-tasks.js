import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import test from 'node:test';
import {npmConfig, pnpmConfig, yarnConfig} from '../../source/package-manager/configs.js';
import {npPackage} from '../../source/util.js';
import {SilentRenderer} from '../_helpers/listr-renderer.js';
import {_createFixture} from '../_helpers/stub-execa.js';
import {
	run,
	assertTaskFailed,
	assertTaskDisabled,
	assertTaskSkipped,
} from '../_helpers/listr.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/prerequisite-tasks.js')>>}
*/
const createFixture = _createFixture('../../source/prerequisite-tasks.js', import.meta.url);
const generatedEntryPointFixture = path.resolve('test', 'fixtures', 'files', 'prepack-generated-entry-point');

test.beforeEach(() => {
	process.env.NODE_ENV = 'test';
});

test.afterEach(() => {
	SilentRenderer.clearTasks();
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
		await assert.rejects(
			run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
			{message: 'Connection to npm registry failed'},
		);

		assertTaskFailed('Ping npm registry');
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
	await assert.doesNotReject(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {}, {packageManager: npmConfig})));

	assertTaskDisabled('Ping npm registry');
});

createFixture('external registry: should disable task pinging npm registry', [{
	command: 'npm view --json test engines --registry http://my.io',
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
	await assert.doesNotReject(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {}, {packageManager: npmConfig})));

	assertTaskDisabled('Ping npm registry');
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

	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
		{message: `\`np\` requires npm ${depRange}`},
	);

	assertTaskFailed('Check npm version');
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

	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: yarnConfig})),
		{message: `\`np\` requires yarn ${depRange}`},
	);

	assertTaskFailed('Check yarn version');
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

	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed('Verify user is authenticated');
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

	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {}, {packageManager: npmConfig})),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed('Verify user is authenticated');
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

		await assert.rejects(
			run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'https://registry.npmjs.org/'}}, {}, {packageManager: npmConfig})),
			{message: 'You do not have write permissions required to publish this package.'},
		);

		process.env.NODE_ENV = 'test';

		assertTaskFailed('Verify user is authenticated');
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

	await assert.doesNotReject(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {}, {packageManager: npmConfig})));

	process.env.NODE_ENV = 'test';

	assertTaskDisabled('Verify user is authenticated');
});

createFixture('should fail when git version does not match range in `package.json`', [{
	command: 'git version',
	stdout: 'git version 1.0.0',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	const depRange = npPackage.engines.git;

	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
		{message: `\`np\` requires git ${depRange}`},
	);

	assertTaskFailed('Check git version');
});

createFixture('should fail when git user.name is not set', [{
	command: 'git config user.name',
	exitCode: 1,
	stdout: '',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
		{message: /Git user configuration is not set/v},
	);

	assertTaskFailed('Check git user configuration');
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
	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
		{message: /Git user configuration is not set/v},
	);

	assertTaskFailed('Check git user configuration');
});

createFixture('should fail when git remote does not exist', [{
	command: 'git ls-remote origin HEAD',
	exitCode: 1,
	exitCodeName: 'EPERM',
	stderr: 'not found',
}], async ({
	testedModule: prerequisiteTasks,
}) => {
	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
		{message: 'not found'},
	);

	assertTaskFailed('Check git remote and tag existence');
});

createFixture(
	'should fail when version is invalid',
	[],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		await assert.rejects(
			run(prerequisiteTasks('DDD', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
			{message: 'New version DDD should either be one of patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid SemVer version.'},
		);

		assertTaskFailed('Validate version');
	},
);

createFixture(
	'should fail when version is lower than latest version',
	[],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		await assert.rejects(
			run(prerequisiteTasks('0.1.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
			{message: 'New version 0.1.0 should be higher than current version 1.0.0.'},
		);

		assertTaskFailed('Validate version');
	},
);

createFixture(
	'should fail when prerelease version of public package without dist tag given',
	[],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		await assert.rejects(
			run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
			{message: 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag'},
		);

		assertTaskFailed('Check for pre-release version');
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
		await assert.doesNotReject(run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {tag: 'pre'}, {packageManager: npmConfig})));
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
		await assert.doesNotReject(run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0', private: true}, {}, {packageManager: npmConfig})));
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
	await assert.rejects(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})),
		{message: 'Git tag `v2.0.0` already exists.'},
	);

	assertTaskFailed('Check git remote and tag existence');
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
	await assert.doesNotReject(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})));
});

createFixture(
	'should fail when pnpm ignore-scripts prevents the build script from running',
	[{
		command: 'pnpm --version',
		stdout: '11.0.0',
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
		await assert.rejects(
			run(prerequisiteTasks('1.0.0', {
				name: 'test',
				version: '0.0.0',
				private: true,
				main: 'dist/index.js',
				scripts: {
					prepack: 'build',
				},
			}, {}, {packageManager: pnpmConfig, rootDirectory: generatedEntryPointFixture})),
			{message: /ignore-scripts.*package manager config.*\.npmrc/sv},
		);

		assertTaskFailed('Verify package entry points');
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
		await assert.rejects(
			run(prerequisiteTasks('1.0.0', {
				name: 'test',
				version: '0.0.0',
				private: true,
				main: 'dist/index.js',
				scripts: {
					prepack: 'build',
				},
			}, {}, {packageManager: yarnConfig, rootDirectory: generatedEntryPointFixture})),
			{message: /ignore-scripts.*package manager config.*\.yarnrc/sv},
		);

		assertTaskFailed('Verify package entry points');
	},
);

createFixture('should skip authentication check when OIDC is detected', [{
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

	t.after(() => {
		delete process.env.GITHUB_ACTIONS;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
		process.env.NODE_ENV = 'test';
	});

	await assert.doesNotReject(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})));

	assertTaskSkipped('Verify user is authenticated');
});

createFixture('should fail when dropping Node.js support in a minor release', [{
	command: 'npm view --json test engines',
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
	await assert.rejects(
		run(prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig})),
		{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a minor bump.'},
	);

	assertTaskFailed('Check for Node.js engine support drop');
});

createFixture(
	'should fail when dropping Node.js support with array-wrapped engines (npm 12)',
	[{
		command: 'npm view --json test engines',
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
		await assert.rejects(
			run(prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig})),
			{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a minor bump.'},
		);

		assertTaskFailed('Check for Node.js engine support drop');
	},
);

createFixture('should fail when dropping Node.js support in a patch release', [{
	command: 'npm view --json test engines',
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
	await assert.rejects(
		run(prerequisiteTasks('1.0.1', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig})),
		{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a patch bump.'},
	);

	assertTaskFailed('Check for Node.js engine support drop');
});

createFixture('should not fail when dropping Node.js support in a major release', [{
	command: 'npm view --json test engines',
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
	await assert.doesNotReject(run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig})));
});

createFixture('should not fail when dropping Node.js support in a premajor release', [{
	command: 'npm view --json test engines',
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
	await assert.doesNotReject(run(prerequisiteTasks('2.0.0-0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig})));
});

createFixture(
	'should not fail when dropping Node.js support in a pre-1.0.0 minor release',
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
		command: 'git rev-parse --quiet --verify refs/tags/v0.2.0',
		stdout: '',
	}],
	async ({
		testedModule: prerequisiteTasks,
	}) => {
		await assert.doesNotReject(run(prerequisiteTasks('0.2.0', {name: 'test', version: '0.1.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig})));
	},
);

createFixture('should not fail when engines.node was not previously set', [{
	command: 'npm view --json test engines',
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
	await assert.doesNotReject(run(prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig})));
});

createFixture('should not fail when first publishing a package', [{
	command: 'npm view --json test engines',
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
	await assert.doesNotReject(run(prerequisiteTasks('1.0.0', {name: 'test', version: '0.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig})));
});

createFixture('should not fail when local package has no engines.node', [{
	command: 'npm view --json test engines',
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
	await assert.doesNotReject(run(prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0'}, {}, {packageManager: npmConfig})));
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

		await assert.doesNotReject(run(prerequisiteTasks('1.1.0', package_, {}, {packageManager: npmConfig})));

		assertTaskDisabled('Check for Node.js engine support drop');
	},
);

createFixture('should not fail when Node.js minimum version stays the same', [{
	command: 'npm view --json test engines',
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
	await assert.doesNotReject(run(prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {}, {packageManager: npmConfig})));
});

createFixture('should not fail when Node.js minimum version is lowered', [{
	command: 'npm view --json test engines',
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
	await assert.doesNotReject(run(prerequisiteTasks('1.1.0', {name: 'test', version: '1.0.0', engines: {node: '>=16'}}, {}, {packageManager: npmConfig})));
});

createFixture('should fail when dropping Node.js support in a preminor release', [{
	command: 'npm view --json test engines',
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
	await assert.rejects(
		run(prerequisiteTasks('1.1.0-0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig})),
		{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a preminor bump.'},
	);

	assertTaskFailed('Check for Node.js engine support drop');
});

createFixture('should fail when dropping Node.js support in a prepatch release', [{
	command: 'npm view --json test engines',
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
	await assert.rejects(
		run(prerequisiteTasks('1.0.1-0', {name: 'test', version: '1.0.0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig})),
		{message: 'Raising minimum Node.js version from 16.0.0 to 18.0.0 requires a major version bump. The current release is a prepatch bump.'},
	);

	assertTaskFailed('Check for Node.js engine support drop');
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
		await assert.doesNotReject(run(prerequisiteTasks('1.0.0-1', {name: 'test', version: '1.0.0-0', engines: {node: '>=18'}}, {tag: 'next'}, {packageManager: npmConfig})));
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
		await assert.doesNotReject(run(prerequisiteTasks('1.1.0', package_, {yolo: true}, {packageManager: npmConfig})));

		assertTaskDisabled('Check for Node.js engine support drop');
	},
);

createFixture(
	'external registry: should skip engine check when registry returns error',
	[{
		command: 'npm view --json test engines --registry http://my.io',
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
		await assert.doesNotReject(run(prerequisiteTasks('1.1.0', package_, {}, {packageManager: npmConfig})));
	},
);
