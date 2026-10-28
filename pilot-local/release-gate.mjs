import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export function runtimeInputs(){const root=path.resolve(here,'..'),files=[];function walk(relative){for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const name=relative+'/'+entry.name;if(entry.isDirectory())walk(name);else files.push(name);}}walk('src');walk('public');files.push(...fs.readdirSync(here).filter(n=>/\.(mjs|js|css|html|ps1)$/.test(n)).map(n=>'pilot-local/'+n),'pilot-local/sql/manifest.json');return files.sort().map(relative=>({path:relative,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex')}));}
export function assertReleaseReady(){
 const release=JSON.parse(fs.readFileSync(path.join(here,'release.json'),'utf8')),integration=JSON.parse(fs.readFileSync(path.join(here,'integration-evidence.json'),'utf8'));
 if(release.status!=='READY_FOR_INITIAL_SETUP'||integration.status!=='PASS'||!integration.cleanupVerified||JSON.stringify(integration.inputs)!==JSON.stringify(runtimeInputs()))throw Error('Candidata ainda nao liberada: verificacoes ou integridade pendentes. Nao instalar dados reais.');
 const regression=JSON.parse(fs.readFileSync(release.regressionReport,'utf8'));if(regression.status!=='REGRESSIONS_PASS'||regression.steps.some(s=>s.exitCode!==0))throw Error('Regressao integral ainda pendente');
}
