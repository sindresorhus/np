import type {TestContext} from 'node:test';
import type {Execa$} from 'execa';

export type Context = {
	firstCommitMessage: string;
	getCommitMessage: (sha: string) => Promise<string>;
	createFile: (file: string, content?: string) => Promise<void>;
	commitNewFile: () => Promise<{
		sha: string;
		commitMessage: string;
	}>;
};

type CommandsFunctionParameters = [{
	context: Context;
	$$: Execa$<string>;
	temporaryDirectory: string;
}];

type AssertionsFunctionParameters<MockType> = [{
	context: Context;
	testedModule: MockType;
	$$: Execa$<string>;
	temporaryDirectory: string;
}];

export type CreateFixture<MockType> = (
	title: string,
	commands: (...arguments_: CommandsFunctionParameters) => Promise<void>,
	assertions: (...arguments_: AssertionsFunctionParameters<MockType>) => Promise<void>,
) => void;

export function createIntegrationTest(
	t: TestContext,
	assertions: (...arguments_: [CommandsFunctionParameters[0] & {testedModule?: unknown}]) => Promise<void>,
): Promise<void>;

export function _createFixture<MockType>(source: string): CreateFixture<MockType>;
