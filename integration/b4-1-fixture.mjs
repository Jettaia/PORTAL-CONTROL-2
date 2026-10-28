import fs from 'node:fs';
import {fixture} from './b3-3-fixture.mjs';
export async function b4Fixture(){
 const f=await fixture({b34:true});
 try{
  const d=(await f.q('SELECT DB_NAME() D'))[0].D;if(d!==f.lab.database||!/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(d))throw Error('Overlay recusado');
  await f.lab.db.beginTransaction();try{for(const batch of fs.readFileSync(new URL('b4-1-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(x=>x.trim()))await f.q(batch);await f.lab.db.commit();}catch(e){await f.lab.db.rollback();throw e;}
  for(const key of ['apontamentos.emitir','apontamentos.visualizar',...(f.lab.cfg.b42?['apontamentos.tablet.gerir']:[])])await f.q(`INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('${key}','OPERACAO',N'Laboratorio B4',${key.endsWith('emitir')?1:0});INSERT Seguranca.PerfilPermissao(PerfilId,PermissaoId) SELECT up.PerfilId,p.PermissaoId FROM Seguranca.UsuarioPerfil up CROSS JOIN Seguranca.Permissao p WHERE up.UsuarioId IN (${f.g.id},${f.g2.id}) AND p.Chave='${key}';`);
  f.lab.cfg.b41=true;
  f.contracted=async(options={})=>{const pr=await f.provider();await f.inform(pr,'2026-10-21',options);const x=await f.plan(pr,'2026-10-21',options);await f.confirm(x);return {...x,pr};};
  return f;
 }catch(e){await f.lab.close();throw e;}
}
