import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {validateFullRegression,regressionInputs,regressionTests} from './release-regression.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export function runtimeInputs(){const root=path.resolve(here,'..'),files=[];function walk(relative){for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const name=relative+'/'+entry.name;if(entry.isDirectory())walk(name);else files.push(name);}}walk('src');walk('public');files.push(...fs.readdirSync(here).filter(n=>/\.(mjs|js|css|html|ps1)$/.test(n)).map(n=>'pilot-local/'+n),'pilot-local/sql/manifest.json');return files.sort().map(relative=>({path:relative,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex')}));}
export function assertReleaseReady(directory=here){
 const release=JSON.parse(fs.readFileSync(path.join(directory,'release.json'),'utf8')),integration=JSON.parse(fs.readFileSync(path.join(directory,'integration-evidence.json'),'utf8')),inputs=runtimeInputs();
 if(release.status!=='READY_FOR_INITIAL_SETUP'||release.scope!=='FULL'||integration.status!=='PASS'||integration.cleanupVerified!==true||JSON.stringify(integration.inputs)!==JSON.stringify(inputs))throw Error('Candidata ainda nao liberada: verificacoes ou integridade pendentes. Nao instalar dados reais.');
 const regression=JSON.parse(fs.readFileSync(path.resolve(directory,release.regressionReport),'utf8'));
 validateFullRegression(regression,regressionInputs(inputs),regressionTests());
}
