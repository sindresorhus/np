import os from 'node:os';
import isInstalledGlobally from 'is-installed-globally';
import {cosmiconfig} from 'cosmiconfig';

// TODO: remove when cosmiconfig/cosmiconfig#283 lands
const loadESM = async filepath => {
	const module = await import(filepath);
	return module.default ?? module;
};

const getConfig = async rootDir => {
	const searchDir = isInstalledGlobally ? os.homedir() : rootDir;
	const searchPlaces = ['.np-config.json', '.np-config.js', '.np-config.cjs', '.np-config.mjs'];
	if (!isInstalledGlobally) {
		searchPlaces.push('package.json');
	}

	const explorer = cosmiconfig('np', {
		searchPlaces,
		stopDir: searchDir,
		loaders: {
			'.js': loadESM,
			'.mjs': loadESM,
		},
	});
	const {config} = (await explorer.search(searchDir)) || {};

	return config;
};

export default getConfig;
