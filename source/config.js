import os from 'node:os';
import isInstalledGlobally from 'is-installed-globally';
import {cosmiconfig} from 'cosmiconfig';

export default async function getConfig(rootDirectory) {
	const searchPlaces = [
		'.np-config.json',
		'.np-config.js',
		'.np-config.cjs',
		'.np-config.mjs',
		'package.json',
	];

	const explorer = cosmiconfig('np', {
		searchPlaces,
		stopDir: rootDirectory,
	});

	// Always read project config
	const {config: projectConfig} = (await explorer.search(rootDirectory)) ?? {};

	// When globally installed, also read global config and merge (project wins)
	if (isInstalledGlobally) {
		const globalExplorer = cosmiconfig('np', {
			searchPlaces: searchPlaces.filter(place => place !== 'package.json'),
			stopDir: os.homedir(),
		});

		const {config: globalConfig} = (await globalExplorer.search(os.homedir())) ?? {};

		return {
			...globalConfig,
			...projectConfig,
		};
	}

	return projectConfig;
}
