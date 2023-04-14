import test from 'ava';
import enable2fa, {getEnable2faArgs} from '../../source/npm/enable-2fa.js';
import handleNpmError from '../../source/npm/handle-npm-error.js';

test('getEnable2faArgs - no options', t => {
	t.deepEqual(getEnable2faArgs('np'), ['access', '2fa-required', 'np']);
});

test('getEnable2faArgs - options, no otp', t => {
	t.deepEqual(getEnable2faArgs('np', {confirm: true}), ['access', '2fa-required', 'np']);
});

test('getEnable2faArgs - options w/ otp', t => {
	t.deepEqual(getEnable2faArgs('np', {otp: '123456'}), ['access', '2fa-required', 'np', '--otp', '123456']);
});
