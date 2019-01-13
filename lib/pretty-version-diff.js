'use strict';
const chalk = require('chalk');
const version = require('./version');

module.exports = (oldVersion, inc) => {
	const newVersion = version.getNewVersion(oldVersion, inc).split('.');
	oldVersion = oldVersion.split('.');
	let firstVersionChange = false;
	const output = [];

	for (let i = 0; i < newVersion.length; i++) {
		if ((newVersion[i] !== oldVersion[i] && !firstVersionChange)) {
			output.push(`${chalk.dim.cyan(newVersion[i])}`);
			firstVersionChange = true;
		} else if (newVersion[i].indexOf('-') >= 1) {
			let preVersion = [];
			preVersion = newVersion[i].split('-');
			output.push(`${chalk.dim.cyan(`${preVersion[0]}-${preVersion[1]}`)}`);
		} else {
			output.push(chalk.reset.dim(newVersion[i]));
		}
	}

	return output.join(chalk.reset.dim('.'));
};
