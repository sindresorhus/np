import os from 'node:os';
import isInstalledGlobally from 'is-installed-globally';
import {cosmiconfig} from 'cosmiconfig';

export default async function getConfig(rootDirectory) {
	const searchDirectory = isInstalledGlobally ? os.homedir() : rootDirectory;

	const searchPlaces = [
		'.np-config.json',
		'.np-config.js',
		'.np-config.cjs',
		'.np-config.mjs',
	];

	if (!isInstalledGlobally) {
		searchPlaces.push('package.json');
	}

	const explorer = cosmiconfig('np', {
		searchPlaces,
		stopDir: searchDirectory,
	});

	const {config} = (await explorer.search(searchDirectory)) ?? {};

	return config;
}
