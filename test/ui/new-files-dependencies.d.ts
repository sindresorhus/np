import type {Macro, ExecutionContext} from 'ava';
import type {PackageJson} from 'read-pkg';

type Context = {
	createFile: (file: string, content?: string) => Promise<void>;
};

type CommandsFunctionParameters = [{
	t: ExecutionContext<Context>;
	$$: Execa$<string>;
	temporaryDir: string;
}];

type ListItem = `- ${string}`;

type Expected = {
	unpublished: ListItem[];
	firstTime: ListItem[];
	dependencies: ListItem[];
};

type AssertionsFunctionParameters = [{
	t: ExecutionContext<Context>;
	$$: Execa$<string>;
	temporaryDir: string;
	logs: string[];
}];

export type CreateFixtureMacro = Macro<[
	package_: PackageJson,
	commands: (...arguments_: CommandsFunctionParameters) => Promise<void>,
	expected: Expected,
	assertions: (...arguments_: AssertionsFunctionParameters) => Promise<void>,
], Context>;
