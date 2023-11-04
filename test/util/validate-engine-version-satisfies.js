import test from 'ava';
import {validateEngineVersionSatisfies, npPkg} from '../../source/util.js';

const testEngineRanges = test.macro((t, engine, {above, below}) => {
	const range = npPkg.engines[engine];

	t.notThrows(
		() => validateEngineVersionSatisfies(engine, above), // Above minimum
	);

	t.throws(
		() => validateEngineVersionSatisfies(engine, below), // Below minimum
		{message: `\`np\` requires ${engine} ${range}`},
	);
});

test('node', testEngineRanges, 'node', {above: '99.7.0', below: '16.5.0'});

test('npm', testEngineRanges, 'npm', {above: '99.20.0', below: '7.18.0'});

test('git', testEngineRanges, 'git', {above: '99.12.0', below: '2.10.0'});

test('yarn', testEngineRanges, 'yarn', {above: '99.8.0', below: '1.6.0'});

