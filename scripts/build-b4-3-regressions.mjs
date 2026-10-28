import fs from 'node:fs';
import './build-b4-2-regressions.mjs';
const files=['b4-2.integration.mjs','b4-2-migration.integration.mjs','b4-2.visual.mjs',...fs.readdirSync('integration').filter(n=>n.startsWith('b4-2-regression-')&&n.endsWith('.mjs'))];
for(const file of files){let code=fs.readFileSync('integration/'+file,'utf8').replaceAll('docs/b4-2','docs/b4-3/regression/b4-2');
 code=code.replaceAll(`sys.tables WHERE schema_id=SCHEMA_ID('Operacao')"))[0].N),13)`,`sys.tables WHERE schema_id=SCHEMA_ID('Operacao')"))[0].N),17)`).replaceAll(`rows.find(r=>r.type.trim()==='U').N),13)`,`rows.find(r=>r.type.trim()==='U').N),17)`).replaceAll('treze tabelas (cinco B3 + oito B4)','dezessete tabelas (cinco B3 + doze B4)').replaceAll('treze tabelas no overlay B4.2','dezessete tabelas no overlay B4.3');
 fs.writeFileSync('integration/b4-3-regression-'+file,code);
}
for(const dir of ['planning','contracts','operations','ddl','contracts-ui','operations-ui'])fs.mkdirSync('docs/b4-3/regression/b4-2/regression/b4-1/regression/b3-4/consolidated/'+dir,{recursive:true});
