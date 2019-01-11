'use strict';
const execa = require('execa');

exports.hasUpstream = async () => {
	const {stdout} = await execa('git', ['status', '--short', '--branch', '--porcelain=2']);
	return /^# branch\.upstream [\w\-/]+$/.test(stdout);
};
