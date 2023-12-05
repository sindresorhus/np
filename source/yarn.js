import semver from 'semver';

export function checkIfYarnBerry(pkg) {
	if (typeof pkg.packageManager !== 'string') {
		return false;
	}

	const match = pkg.packageManager.match(/^yarn@(.+)$/);
	if (!match) {
		return false;
	}

	const [, yarnVersion] = match;
	const versionParsed = semver.parse(yarnVersion);
	return (versionParsed.major >= 2);
}
