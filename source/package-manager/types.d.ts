export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export type Command = [cli: string, args: string[]];

export type PackageManagerConfig = {
	cli: PackageManager;
	nickname: string;
	installCommand: Command;
	versionCommand: (version: string) => [cli: string, args: string[]];
	publishCli?: string;
	getRegistryCommand: Command;
	tagVersionPrefixCommand: Command;
	throwOnExternalRegistry?: boolean;
	lockfiles: string[];
};
