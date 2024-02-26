import type {Macro, ExecutionContext} from 'ava';
import type {ExecaReturnValue} from 'execa';

type AssertionsFunctionParameters<MockType> = [{
	t: ExecutionContext;
	testedModule: MockType;
}];

export type CreateFixtureMacro<MockType> = Macro<[
	commands: ExecaReturnValue[],
	assertions: (...arguments_: AssertionsFunctionParameters<MockType>) => Promise<void>,
]>;

export function _createFixture<MockType>(source: string, importMeta: string): CreateFixtureMacro<MockType>;
