import test from 'ava';
import {execa} from 'execa';

test.after.always(async () => {
	await execa('git', ['submodule', 'update', '--remote']);
});

test.failing('Integration tests', async t => {
	await execa('npx', ['ava'], {cwd: 'integration-test'});
	t.pass();
});
