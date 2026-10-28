import fs from 'node:fs';
import crypto from 'node:crypto';
import {b42Fixture} from './b4-2-fixture.mjs';
import {reviewDetail,confer} from '../src/b4-2.js';
export async function b43Fixture(){const f=await b42Fixture();try{
 const {lab,q,g,g2}=f;lab.cfg.b43=true;
 await lab.db.beginTransaction();try{for(const batch of fs.readFileSync(new URL('b4-3-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await q(batch);await lab.db.commit();}catch(e){await lab.db.rollback();throw e;}
 for(const key of ['operacao.fechamento.visualizar','operacao.fechamento.encerrar','operacao.comprovante.visualizar','operacao.ocorrencia.registrar'])await q(`INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('${key}','OPERACAO',N'Laboratorio B4.3',${key.endsWith('encerrar')?1:0});INSERT Seguranca.PerfilPermissao(PerfilId,PermissaoId) SELECT up.PerfilId,p.PermissaoId FROM Seguranca.UsuarioPerfil up CROSS JOIN Seguranca.Permissao p WHERE up.UsuarioId IN (${g.id},${g2.id}) AND p.Chave='${key}';`);
 f.review=async(x,decision='CONFERIDO')=>{const d=await reviewDetail(lab.cfg,g.id,x.p);await confer(lab.cfg,g.id,x.p,{decisao:decision,motivo:decision==='DIVERGENCIA'?'Divergencia sintetica':'',contextoHash:d.contextoHash,requisicaoId:crypto.randomUUID()});return x;};
 f.ready=async()=>f.review(await f.finished());return f;
 }catch(e){await f.lab.close();throw e;}}
