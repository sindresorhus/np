/** @type {import('./types.d.ts').PackageManagerConfig} */
export const npmConfig = {
	cli: 'npm',
	id: 'npm',
	installCommand: ['npm', ['ci', '--engine-strict']],
	installCommandNoLockfile: ['npm', ['install', '--no-package-lock', '--no-production', '--engine-strict']],
	versionCommand: version => ['npm', ['version', version]],
	getRegistryCommand: ['npm', ['config', 'get', 'registry']],
	tagVersionPrefixCommand: ['npm', ['config', 'get', 'tag-version-prefix']],
	lockfiles: ['package-lock.json', 'npm-shrinkwrap.json'],
};

/** @type {import('./types.d.ts').PackageManagerConfig} */
export const pnpmConfig = {
	cli: 'pnpm',
	id: 'pnpm',
	installCommand: ['pnpm', ['install']],
	installCommandNoLockfile: ['pnpm', ['install']],
	versionCommand: version => ['pnpm', ['version', version]],
	tagVersionPrefixCommand: ['pnpm', ['config', 'get', 'tag-version-prefix']],
	publishCli: ['npm'], // Pnpm does git cleanliness checks, which np already did, and which fail because when publishing package.json has been updated
	getRegistryCommand: ['pnpm', ['config', 'get', 'registry']],
	lockfiles: ['pnpm-lock.yaml'],
};

/** @type {import('./types.d.ts').PackageManagerConfig} */
export const yarnConfig = {
	cli: 'yarn',
	id: 'yarn',
	installCommand: ['yarn', ['install', '--frozen-lockfile', '--production=false']],
	installCommandNoLockfile: ['yarn', ['install', '--production=false']],
	getRegistryCommand: ['yarn', ['config', 'get', 'registry']],
	tagVersionPrefixCommand: ['yarn', ['config', 'get', 'version-tag-prefix']],
	versionCommand: version => ['yarn', ['version', '--new-version', version]],
	lockfiles: ['yarn.lock'],
};

/** @type {import('./types.d.ts').PackageManagerConfig} */
export const yarnBerryConfig = {
	cli: 'yarn',
	id: 'yarn-berry',
	installCommand: ['yarn', ['install', '--immutable']],
	installCommandNoLockfile: ['yarn', ['install']],
	// Yarn berry doesn't support git committing/tagging, so we use npm instead
	versionCommand: version => ['npm', ['version', version]],
	tagVersionPrefixCommand: ['yarn', ['config', 'get', 'version-tag-prefix']],
	// Yarn berry offloads publishing to npm, e.g. `yarn npm publish x.y.z`
	publishCli: ['yarn', ['npm']],
	getRegistryCommand: ['yarn', ['config', 'get', 'npmRegistryServer']],
	throwOnExternalRegistry: true,
	lockfiles: ['yarn.lock'],
};
