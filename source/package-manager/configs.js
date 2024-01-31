/** @type {import('./types.d.ts').PackageManagerConfig} */

export const npmConfig = {
	cli: 'npm',
	nickname: 'npm',
	installCommand: ['npm', ['install', '--engine-strict']],
	versionCommand: version => ['npm', ['version', version]],
	getRegistryCommand: ['npm', ['config', 'get', 'registry']],
	tagVersionPrefixCommand: ['npm', ['config', 'get', 'tag-version-prefix']],
	lockfiles: ['package-lock.json', 'npm-shrinkwrap.json'],
};
/** @type {import('./types.d.ts').PackageManagerConfig} */

export const pnpmConfig = {
	cli: 'pnpm',
	nickname: 'pnpm',
	installCommand: ['pnpm', ['install']],
	versionCommand: version => ['pnpm', ['version', version]],
	tagVersionPrefixCommand: ['pnpm', ['config', 'get', 'tag-version-prefix']],
	publishCli: 'npm', // pnpm does git cleanliness checks, which np already did, and which fail because when publishing package.json has been updated
	getRegistryCommand: ['pnpm', ['config', 'get', 'registry']],
	lockfiles: ['pnpm-lock.yaml'],
};
/** @type {import('./types.d.ts').PackageManagerConfig} */

export const yarnConfig = {
	cli: 'yarn',
	nickname: 'yarn',
	installCommand: ['yarn', ['install', '--frozen-lockfile', '--production=false']],
	getRegistryCommand: ['yarn', ['config', 'get', 'registry']],
	tagVersionPrefixCommand: ['yarn', ['config', 'get', 'version-tag-prefix']],
	versionCommand: version => ['yarn', ['version', '--new-version', version]],
	lockfiles: ['yarn.lock'],
};
/** @type {import('./types.d.ts').PackageManagerConfig} */

export const yarnBerryConfig = {
	cli: 'yarn',
	nickname: 'yarn-berry',
	installCommand: ['yarn', ['install', '--immutable']],
	versionCommand: version => ['yarn', ['version', '--new-version', version]],
	tagVersionPrefixCommand: ['yarn', ['config', 'get', 'version-tag-prefix']],
	publishCli: 'npm', // Yarn berry doesn't support git committing/tagging, so use npm
	getRegistryCommand: ['yarn', ['config', 'get', 'npmRegistryServer']],
	throwOnExternalRegistry: true,
	lockfiles: ['yarn.lock'],
};
