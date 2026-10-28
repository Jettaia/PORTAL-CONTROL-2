import fs from 'node:fs';
const files=['b4-1.integration.mjs','b4-1.visual.mjs',...['b3-4-planning.integration.mjs','b3-4-contracts.integration.mjs','b3-4-migration.integration.mjs','b3-4.integration.mjs','b3-3.integration.mjs','b3-4-planning.visual.mjs','b3-4-contracts.visual.mjs','b3-3.visual.mjs','b3-4.visual.mjs'].map(n=>'b4-1-regression-'+n)];
for(const n of files){let code=fs.readFileSync('integration/'+n,'utf8').replaceAll('docs/b4-1','docs/b4-2/regression/b4-1');
 code=code.replaceAll(`sys.tables WHERE schema_id=SCHEMA_ID('Operacao')"))[0].N),9)`,`sys.tables WHERE schema_id=SCHEMA_ID('Operacao')"))[0].N),13)`).replaceAll(`rows.find(r=>r.type.trim()==='U').N),9)`,`rows.find(r=>r.type.trim()==='U').N),13)`).replaceAll('nove tabelas (cinco B3 + quatro B4)','treze tabelas (cinco B3 + oito B4)').replaceAll('nove tabelas no overlay B4','treze tabelas no overlay B4.2');
 if(n==='b4-1.visual.mjs')code=code.replace(`(await context.request.get(base+'/api/auth/me')).status(),401`,`(await context.request.get(base+'/api/auth/me')).status(),403`);
 // Preserve the exact historical asset without requiring foreign Git objects.
 code=code.replace("execFileSync('git',['show','74de755:public/b3.js'],{encoding:'utf8'})", "fs.readFileSync(new URL('fixtures/b3-3-legacy.js',import.meta.url),'utf8')");
 fs.writeFileSync('integration/b4-2-regression-'+n,code);
}
