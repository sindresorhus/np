import os from 'node:os';
import isInstalledGlobally from 'is-installed-globally';
import {packageDirectory} from 'pkg-dir';
import {cosmiconfig} from 'cosmiconfig';

const getConfig = async () => {
	const searchDir = isInstalledGlobally ? os.homedir() : await packageDirectory();
	const searchPlaces = ['.np-config.json', '.np-config.js', '.np-config.cjs'];
	if (!isInstalledGlobally) {
		searchPlaces.push('package.json');
	}

	const explorer = cosmiconfig('np', {
		searchPlaces,
		stopDir: searchDir
	});
	const {config} = (await explorer.search(searchDir)) || {};

	return config;
};

export default getConfig;
