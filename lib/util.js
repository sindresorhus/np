'use strict';
const readPkgUp = require('read-pkg-up');
const execa = require('execa');

exports.readPkg = () => {
	const pkg = readPkgUp.sync().pkg;

	if (!pkg) {
		throw new Error(`No package.json found. Make sure you're in the correct project.`);
	}

	return pkg;
};

exports.getPackageScope = pkg => {
	if (!pkg.name) {
		return null;
	}

	const scopeMatch = pkg.name.match(/(^@.+)\/.+/);
	return scopeMatch ? scopeMatch[1] : null;
};

exports.usingCustomRegistry = pkg => {
	if (pkg.publishConfig && pkg.publishConfig.registry) {
		Promise.resolve(true);
	}

	return execa.stdout('npm', ['config', 'list', '--json']).then(stdout => {
		const config = JSON.parse(stdout);

		const scope = exports.getPackageScope(pkg);
		const key = scope ? scope + ':registry' : 'registry';

		return config[key] && config[key].indexOf('registry.npmjs.org') === -1;
	});
};
