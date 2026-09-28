import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readPackageUp} from 'read-package-up';
import semver from 'semver';
import {validateEngineVersionSatisfies, npPackage} from '../../source/util.js';

const testEngineRanges = (title, engine, {above, below}) => {
	test(title, () => {
		const range = npPackage.engines[engine];

		// Above minimum
		assert.doesNotThrow(() => validateEngineVersionSatisfies(engine, above));

		assert.throws(
			() => validateEngineVersionSatisfies(engine, below), // Below minimum
			{message: `\`np\` requires ${engine} ${range}`},
		);
	});
};

testEngineRanges('node', 'node', {above: '99.7.0', below: '16.5.0'});

testEngineRanges('Node.js 22 minimum patch version', 'node', {above: '22.22.2', below: '22.22.1'});

testEngineRanges('Node.js 24 minimum patch version', 'node', {above: '24.15.0', below: '24.14.9'});

testEngineRanges('Node.js 26 and unsupported odd release line', 'node', {above: '26.0.0', below: '23.5.0'});

testEngineRanges('future Node.js releases and unsupported Node.js 25', 'node', {above: '27.0.0', below: '25.99.0'});

test('declared Node.js support satisfies every runtime dependency engine requirement', async () => {
	await Promise.all(Object.keys(npPackage.dependencies).map(async name => {
		const directory = path.dirname(fileURLToPath(import.meta.resolve(name)));
		const {packageJson} = await readPackageUp({cwd: directory});
		assert.ok(semver.subset(npPackage.engines.node, packageJson.engines?.node ?? '*'), `${name} requires Node.js ${packageJson.engines?.node}`);
	}));
});

testEngineRanges('npm', 'npm', {above: '99.20.0', below: '7.18.0'});

testEngineRanges('git', 'git', {above: '99.12.0', below: '2.10.0'});

testEngineRanges('yarn', 'yarn', {above: '99.8.0', below: '1.6.0'});
