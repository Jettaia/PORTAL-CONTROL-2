import {spawnSync} from 'node:child_process';
const python=process.env.JETTA_PYTHON||'C:/Users/ferre/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const r=spawnSync(python,['scripts/verify-final-artifacts.py'],{encoding:'utf8',windowsHide:true});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.error)throw r.error;process.exitCode=r.status??1;
