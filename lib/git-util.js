'use strict';
const execa = require('execa');

exports.hasUpstream = async () => {
	const {stdout} = await execa('git', ['status', '--short', '--branch', '--porcelain=2']);
	return stdout.split('\n').some(line => /^#\sbranch\.upstream\s[a-zA-Z0-9_\-/]+$/.test(line));
};
