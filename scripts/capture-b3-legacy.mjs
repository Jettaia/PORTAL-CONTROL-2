import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import crypto from 'node:crypto';
const gitDir='C:/Users/ferre/OneDrive/Documents/SQL Server Management Studio 22/jetta-b3/.git';
const asset=execFileSync('git',['--git-dir='+gitDir,'show','74de755:public/b3.js']);
fs.writeFileSync('integration/fixtures/b3-3-legacy.js',asset);
fs.writeFileSync('integration/fixtures/b3-3-legacy.provenance.json',JSON.stringify({commit:'74de755',path:'public/b3.js',sha256:crypto.createHash('sha256').update(asset).digest('hex'),purpose:'Reproduzir perda do resultado apos commit na regressao B3.4, sem depender do repositorio Git de origem'},null,2)+'\n');
