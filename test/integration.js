const test = require('ava');
const execa = require('execa');

test.before(async () => {
	await execa('npm', ['i'], {cwd: 'integration-test'});
});

test.after.always(async () => {
	await execa('git', ['submodule', 'update', '--remote']);
});

test('Integration tests', async t => {
	await execa('ava', {cwd: 'integration-test'});
	t.pass();
});
