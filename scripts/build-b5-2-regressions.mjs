import fs from 'node:fs';
const preserved=fs.readdirSync('integration').filter(n=>n.startsWith('b5-1-regression-')).map(n=>[n,fs.readFileSync('integration/'+n)]);
await import('./build-b5-1-regressions.mjs');
const files=['b5-1.integration.mjs','b5-1-migration.integration.mjs','b5-1.visual.mjs',...fs.readdirSync('integration').filter(n=>n.startsWith('b5-1-regression-')&&n.endsWith('.mjs'))];
for(const file of files){let c=fs.readFileSync('integration/'+file,'utf8').replaceAll('docs/b5-1','docs/b5-2/regression/b5-1');if(!file.includes('b5-1-migration'))c=c.replaceAll(`sys.tables WHERE schema_id=SCHEMA_ID('Financeiro')"))[0].N),2)`,`sys.tables WHERE schema_id=SCHEMA_ID('Financeiro')"))[0].N),5)`);fs.writeFileSync('integration/b5-2-regression-'+file,c.trimEnd()+'\n');}
for(const dir of ['planning','contracts','operations','ddl','contracts-ui','operations-ui'])fs.mkdirSync('docs/b5-2/regression/b5-1/regression/b4-3/regression/b4-2/regression/b4-1/regression/b3-4/consolidated/'+dir,{recursive:true});

for(const [n,bytes] of preserved)fs.writeFileSync('integration/'+n,bytes);
