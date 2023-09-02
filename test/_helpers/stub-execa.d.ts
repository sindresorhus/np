import type {Macro, ExecutionContext} from 'ava';
import type {ExecaReturnValue} from 'execa';

type AssertionsFnParameters<MockType> = [{
	t: ExecutionContext;
	testedModule: MockType;
}];

export type CreateFixtureMacro<MockType> = Macro<[
	commands: ExecaReturnValue[],
	assertions: (...arguments_: AssertionsFnParameters<MockType>) => Promise<void>,
]>;

export function _createFixture<MockType>(source: string, importMeta: string): CreateFixtureMacro<MockType>;
