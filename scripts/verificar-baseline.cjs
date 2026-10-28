const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/governanca/baseline-inventory.json'),'utf8'));
const expectedGovernanceChanges=new Set(['.gitignore','README.md','docs/GATES.md']);
const failures=[];let preserved=0;let publicFiles=0;
for(const file of inventory.files.filter(f=>!f.excluded)){
 if(expectedGovernanceChanges.has(file.path))continue;
 const target=path.join(root,file.path);
 if(!fs.existsSync(target)){failures.push({path:file.path,reason:'Ausente'});continue;}
 const hash=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
 if(hash!==file.sha256)failures.push({path:file.path,reason:'SHA-256 divergente da baseline'});
 else{preserved++;if(file.path.startsWith('public/'))publicFiles++;}
}
console.log(JSON.stringify({baseline:inventory.commit,preserved,publicFiles,expectedGovernanceChanges:[...expectedGovernanceChanges],failures},null,2));
process.exitCode=failures.length?1:0;
