import os from 'os';
import isInstalledGlobally from 'is-installed-globally';
import pkgDir from 'pkg-dir';
import cosmiconfig$0 from 'cosmiconfig';

const {cosmiconfig} = cosmiconfig$0;

const config = async () => {
	const searchDir = isInstalledGlobally ? os.homedir() : await pkgDir();
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

export default config;
