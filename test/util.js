import test from 'ava';
import util from '../lib/util';

test('util.getPackageScope', t => {
	t.is(util.getPackageScope({}), null);
	t.is(util.getPackageScope({name: 'pkgname'}), null);
	t.is(util.getPackageScope({name: 'badscope/pkgname'}), null);
	t.is(util.getPackageScope({name: '@badscope'}), null);
	t.is(util.getPackageScope({name: '@scope/pkgname'}), '@scope');
});
