import type {Macro, ExecutionContext} from 'ava';
import type {Execa$} from 'execa';

type Context = {
	firstCommitMessage: string;
	getCommitMessage: (sha: string) => Promise<string>;
	createFile: (file: string, content?: string) => Promise<void>;
	commitNewFile: () => Promise<{
		sha: string;
		commitMessage: string;
	}>;
};

type CommandsFunctionParameters = [{
	t: ExecutionContext<Context>;
	$$: Execa$<string>;
	temporaryDirectory: string;
}];

type AssertionsFunctionParameters<MockType> = [{
	t: ExecutionContext<Context>;
	testedModule: MockType;
	$$: Execa$<string>;
	temporaryDirectory: string;
}];

export type CreateFixtureMacro<MockType> = Macro<[
	commands: (...arguments_: CommandsFunctionParameters) => Promise<void>,
	assertions: (...arguments_: AssertionsFunctionParameters<MockType>) => Promise<void>,
], Context>;

export function _createFixture<MockType>(source: string): CreateFixtureMacro<MockType>;
