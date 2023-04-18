import type {Macro, ExecutionContext} from 'ava';

type VerifyCliMacro = Macro<[
	binPath: string,
	args: string | string[],
	expectedLines: string[],
], Record<string, never>>;

export const cliPasses: VerifyCliMacro;
export const cliFails: VerifyCliMacro;
