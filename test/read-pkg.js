import * as fs from 'fs';

import test from 'ava';
import {withinTmpdir} from 'with-tmp';

import {readPkg} from '../source/util';

test.serial('readPkg throws error when no package.json is found', t => {
	t.plan(1);

	return withinTmpdir('readPkg-no-pkg', () => {
		t.throws(() => readPkg());
	});
});

test.serial('readPkg gets package.json', t => {
	t.plan(1);

	const manifest = {
		version: '0.0.1',
		name: 'test-package',
		license: 'MIT'
	};
	return withinTmpdir('readPkg-valid-pkg', () => {
		fs.writeFileSync('package.json', JSON.stringify(manifest));
		const pkg = readPkg();
		t.deepEqual(pkg, {
			...manifest,
			_id: 'test-package@0.0.1',
			readme: 'ERROR: No README data found!'
		});
	});
});
