import type {Macro, ExecutionContext} from 'ava';
import type {PackageJson} from 'read-pkg';

type Context = {
	createFile: (file: string, content?: string) => Promise<void>;
};

type CommandsFnParameters = [{
	t: ExecutionContext<Context>;
	$$: Execa$<string>;
	temporaryDir: string;
}];

type Expected = {
	unpublished: Array<`- ${string}`>;
	firstTime: Array<`- ${string}`>;
	dependencies: Array<`- ${string}`>;
};

type AssertionsFnParameters = [{
	t: ExecutionContext<Context>;
	$$: Execa$<string>;
	temporaryDir: string;
	logs: string[];
}];

export type CreateFixtureMacro = Macro<[
	pkg: PackageJson,
	commands: (...arguments_: CommandsFnParameters) => Promise<void>,
	expected: Expected,
	assertions: (...arguments_: AssertionsFnParameters) => Promise<void>,
], Context>;
