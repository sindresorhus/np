import {expectType} from 'tsd';
import {foo, bar} from './index.js';

expectType<string>(foo());
expectType<string>(bar());
