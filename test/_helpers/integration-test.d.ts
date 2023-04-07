import type {Macro, ExecutionContext} from 'ava';
import type {Execa$} from 'execa';

type CommandsFnParameters = [{
	t: ExecutionContext;
	$$: Execa$<string>;
	temporaryDir: string;
}];

type AssertionsFnParameters<MockType> = [{
	t: ExecutionContext;
	testedModule: MockType;
	$$: Execa$<string>;
	temporaryDir: string;
}];

export type CreateFixtureMacro<MockType> = Macro<[
	commands: (...arguments_: CommandsFnParameters) => Promise<void>,
	assertions: (...arguments_: AssertionsFnParameters<MockType>) => Promise<void>,
], {
	createFile: (file: string, content?: string) => Promise<void>;
}>;

export function _createFixture<MockType>(source: string): CreateFixtureMacro<MockType>;
