'use strict';
const os = require('os');
const isInstalledGlobally = require('is-installed-globally');
const cosmiconfig = require('cosmiconfig');

module.exports = async () => {
	const searchDir = isInstalledGlobally ? os.homedir() : process.cwd();
	const searchPlaces = ['.np-config.json'];
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
