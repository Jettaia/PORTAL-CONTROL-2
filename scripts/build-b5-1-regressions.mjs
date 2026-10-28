import fs from 'node:fs';
import './build-b4-3-regressions.mjs';
const files=['b4-3.integration.mjs','b4-3-migration.integration.mjs','b4-3.visual.mjs',...fs.readdirSync('integration').filter(n=>n.startsWith('b4-3-regression-')&&n.endsWith('.mjs'))];
for(const file of files){let code=fs.readFileSync('integration/'+file,'utf8').replaceAll('docs/b4-3','docs/b5-1/regression/b4-3');
 if(file==='b4-3.integration.mjs')code=code.replace(`sys.tables WHERE schema_id=SCHEMA_ID('Financeiro')"))[0].N),0)`,`sys.tables WHERE schema_id=SCHEMA_ID('Financeiro')"))[0].N),2)`).replace('não cria objetos financeiros','preserva somente referencia e avaliacao pre-financeiras');
 fs.writeFileSync('integration/b5-1-regression-'+file,code.trimEnd()+'\n');
}
for(const dir of ['planning','contracts','operations','ddl','contracts-ui','operations-ui'])fs.mkdirSync('docs/b5-1/regression/b4-3/regression/b4-2/regression/b4-1/regression/b3-4/consolidated/'+dir,{recursive:true});
