import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const files=fs.readdirSync('tests').filter(f=>/\.test\.(js|mjs)$/.test(f)).sort().map(f=>'tests/'+f);
if(!files.length)throw Error('Nenhum teste descoberto');
const r=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;
