'use strict';
const execa = require('execa');

exports.hasUpstream = async () => {
	const {stdout} = await execa('git', ['status', '--short', '--branch', '--porcelain=2']);
	return stdout.split('\n').some(line => /^# branch\.upstream [\w\-/]+$/.test(line));
};
