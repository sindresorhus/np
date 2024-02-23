export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
CLI and arguments, which can be passed to `execa`.
*/
export type Command = [cli: string, args: string[]];

export type PackageManagerConfig = {
	/**
 	The main CLI, e.g. the `npm` in `npm install`, `npm test`, etc.
  	*/
	cli: PackageManager;

	/**
 	How the package manager should be referred to in user-facing messages (since there are two different configs for some, e.g. yarn and yarn-berry).
  	*/
	id: string;

	/**
 	How to install packages when there is a lockfile, e.g. `["npm", ["install"]]`.
  	*/
	installCommand: Command;

	/**
	How to install packages when there is no lockfile, e.g. `["npm", ["install"]]`.
	*/
	installCommandNoLockfile: Command;

	/**
 	Given a version string, return a version command e.g. `version => ["npm", ["version", version]]`.
  	*/
	versionCommand: (version: string) => [command: string, args: string[]];

	/**
 	Use a different CLI (and prefix args) to do the actual publish. Defaults to [`cli`].
  	*/
	publishCli?: [command: string, prefixArgs?: string[]];

	/**
 	CLI command which is expected to output the npm registry to use, e.g. `['npm', ['config', 'get', 'registry']]`.
  	*/
	getRegistryCommand: Command;

	/**  */
	tagVersionPrefixCommand: Command;

	/**
 	Set to true if the package manager doesn't support external registries. `np` will throw if one is detected and this is set.
  	*/
	throwOnExternalRegistry?: boolean;

	/**
 	List of lockfile names expected for this package manager, relative to CWD. e.g. `['package-lock.json', 'npm-shrinkwrap.json']`.
  	*/
	lockfiles: string[];
};
