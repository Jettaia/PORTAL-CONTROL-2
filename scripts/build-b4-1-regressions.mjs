import fs from 'node:fs';
const sources=['b3-4-planning.integration.mjs','b3-4-contracts.integration.mjs','b3-4-migration.integration.mjs','b3-4.integration.mjs','b3-3.integration.mjs','b3-4-planning.visual.mjs','b3-4-contracts.visual.mjs','b3-3.visual.mjs','b3-4.visual.mjs'];
for(const name of sources){let code=fs.readFileSync('integration/'+name,'utf8').replaceAll('docs/b3-4','docs/b4-1/regression/b3-4').replaceAll("'docs/b3-3'","'docs/b4-1/regression/b3-3'");
 if(name==='b3-4-planning.integration.mjs')code=code.replace('cinco tabelas e oito procedures','nove tabelas (cinco B3 + quatro B4) e oito procedures').replace("rows.find(r=>r.type.trim()==='U').N),5)","rows.find(r=>r.type.trim()==='U').N),9)");
 code=code.replaceAll(`sys.tables WHERE schema_id=SCHEMA_ID('Operacao')"))[0].N),5)`,`sys.tables WHERE schema_id=SCHEMA_ID('Operacao')"))[0].N),9)`).replaceAll('oito procedures, cinco tabelas','oito procedures, nove tabelas no overlay B4').replaceAll('acrescenta somente persistencia de disponibilidade','preserva motor com disponibilidade e overlay B4');
 fs.writeFileSync('integration/b4-1-regression-'+name,code);
}
