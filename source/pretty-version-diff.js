import chalk from 'chalk';
import Version from './version.js';

const prettyVersionDiff = (oldVersion, inc) => {
	const newVersion = new Version(oldVersion).getNewVersionFrom(inc).split('.');
	oldVersion = oldVersion.split('.');
	let firstVersionChange = false;
	const output = [];

	for (const [i, element] of newVersion.entries()) {
		if ((element !== oldVersion[i] && !firstVersionChange)) {
			output.push(`${chalk.dim.cyan(element)}`);
			firstVersionChange = true;
		} else if (element.indexOf('-') >= 1) {
			let preVersion = [];
			preVersion = element.split('-');
			output.push(`${chalk.dim.cyan(`${preVersion[0]}-${preVersion[1]}`)}`);
		} else {
			output.push(chalk.reset.dim(element));
		}
	}

	return output.join(chalk.reset.dim('.'));
};

export default prettyVersionDiff;
