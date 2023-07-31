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

type CommandsFnParameters = [{
	t: ExecutionContext<Context>;
	$$: Execa$<string>;
	temporaryDir: string;
}];

type AssertionsFnParameters<MockType> = [{
	t: ExecutionContext<Context>;
	testedModule: MockType;
	$$: Execa$<string>;
	temporaryDir: string;
}];

export type CreateFixtureMacro<MockType> = Macro<[
	commands: (...arguments_: CommandsFnParameters) => Promise<void>,
	assertions: (...arguments_: AssertionsFnParameters<MockType>) => Promise<void>,
], Context>;

export function _createFixture<MockType>(source: string): CreateFixtureMacro<MockType>;
