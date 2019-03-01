'use strict';
const npmName = require('npm-name');

module.exports = async pkg => {
	const isExternalRegistry = module.exports.isExternalRegistry(pkg);
	if (isExternalRegistry) {
		return true;
	}

	return npmName(pkg.name);
};

module.exports.isExternalRegistry = pkg => typeof pkg.publishConfig === 'object' && typeof pkg.publishConfig.registry === 'string';
