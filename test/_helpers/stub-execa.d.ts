import type {TestContext} from 'node:test';
import type {ExecaReturnValue} from 'execa';

type AssertionsFunctionParameters<MockType> = [{
	t: TestContext;
	testedModule: MockType;
}];

export type CreateFixture<MockType> = (
	title: string,
	commands: ExecaReturnValue[],
	assertions: (...arguments_: AssertionsFunctionParameters<MockType>) => Promise<void>,
) => void;

export function _createFixture<MockType>(source: string, importMeta: string): CreateFixture<MockType>;
