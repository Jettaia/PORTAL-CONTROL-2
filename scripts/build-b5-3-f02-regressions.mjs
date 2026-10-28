import fs from 'node:fs';
const names=fs.readdirSync('integration').filter(n=>n.startsWith('b5-3-f01-reg-')&&n.endsWith('.integration.mjs')&&!n.includes('migration'));
for(const suffix of ['b5-2c.visual.mjs','b5-2c-regression-b5-2b-regression-b5-2a.visual.mjs'])names.push('b5-3-f01-reg-'+suffix);
for(const suffix of ['.integration.mjs','-additional.integration.mjs','-migration.integration.mjs','.visual.mjs','-performance.mjs','-locks.mjs'])names.push('b5-3-f01'+suffix);
const mappings=names.map((source,i)=>{const target='b5-3-f02-check-'+String(i+1).padStart(2,'0')+source.slice(source.indexOf('.integration')>=0?source.indexOf('.integration'):source.endsWith('.visual.mjs')?source.indexOf('.visual'):source.endsWith('-performance.mjs')?source.indexOf('-performance'):source.indexOf('-locks'));let s=fs.readFileSync('integration/'+source,'utf8').replaceAll('docs/b5-3-f01','docs/b5-3-f02/regression');fs.writeFileSync('integration/'+target,s);return {source,target};});
fs.writeFileSync('docs/b5-3-f02/regression-map.json',JSON.stringify(mappings,null,2)+'\n');
// Some historic UI runners expect screenshot directories from their original gate.
for(const d of ['planning','contracts','operations','ddl','contracts-ui','operations-ui'])fs.mkdirSync('docs/b5-3-f02/regression/regression/regression/regression/regression/b5-2/regression/b5-1/regression/b4-3/regression/b4-2/regression/b4-1/regression/b3-4/consolidated/'+d,{recursive:true});
console.log(mappings.length+' verificacoes geradas');
