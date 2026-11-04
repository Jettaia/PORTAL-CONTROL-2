import {spawnSync} from 'node:child_process';
import {regressionTests} from '../pilot-local/release-regression.mjs';
const files=regressionTests();
if(!files.length)throw Error('Nenhum teste descoberto');
const r=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;
