import {expectType} from 'tsd';
import foo from './index.js';

expectType<string>(foo());
