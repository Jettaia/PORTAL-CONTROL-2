import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const roots=['src','public','integration','scripts','tests','sql'];
const files=['package.json','package-lock.json'];
function walk(root){for(const item of fs.readdirSync(root,{withFileTypes:true})){const file=path.posix.join(root,item.name);if(item.isDirectory())walk(file);else if(item.isFile())files.push(file);}}
for(const root of roots)walk(root);
const manifest={utc:new Date().toISOString(),version:'4.0.0-b4.2.lab.1',branch:'codex/b4-2-conferencia',base:'ced75be',files:files.sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/b4-2/source-integrity.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sealedFiles:manifest.files.length}));
