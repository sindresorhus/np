import {expectType} from 'tsd';
import {foo, bar} from '.';

expectType<string>(foo());
expectType<string>(bar());
