import crypto from 'node:crypto';
import fs from 'node:fs';
import odbc from 'odbc';
import {hashPassword} from '../src/security.js';
import {nvarcharLiteral} from '../src/auth-db.js';
export const safeName = name => /^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(name);
function lifecycle(event,database){if(process.env.JETTA_B52A_EVIDENCE!=='YES')return;if(!safeName(database))throw Error('Registro de destino recusado');const out=process.env.JETTA_FINAL_RECORDS==='YES'?'docs/final-lab':process.env.JETTA_B61_UAT_RECORDS==='YES'?'docs/b6-1-uat':process.env.JETTA_B61_RECORDS==='YES'?'docs/b6-1':process.env.JETTA_F03_RECORDS==='YES'?'docs/b5-3-f03':process.env.JETTA_F02_RECORDS==='YES'?'docs/b5-3-f02':process.env.JETTA_F01_RECORDS==='YES'?'docs/b5-3-f01':(process.env.JETTA_B52C_RECORDS==='YES'||process.env.JETTA_B52C_EVIDENCE==='YES')?'docs/b5-2c':process.env.JETTA_B52B_EVIDENCE==='YES'?'docs/b5-2b':'docs/b5-2a';fs.mkdirSync(out,{recursive:true});fs.appendFileSync(out+'/laboratories.ndjson',JSON.stringify({utc:new Date().toISOString(),event,database})+'\n');}
export async function connect(database) {
  if (database !== 'master' && !safeName(database)) throw Error('Destino B3 recusado');
  const db = await odbc.connect(`Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=${database};Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=Yes;Connection Timeout=8;`);
  await db.query('SET NOCOUNT ON; SET XACT_ABORT ON; SET LOCK_TIMEOUT 5000;'); return db;
}
export async function makeB3Lab({b32=false,b33=false}={}) {
  b32=b32||b33;
  if (process.env.JETTA_B3_RUN_SQL_TESTS !== 'YES') throw Error('Habilitacao explicita de laboratorio B3 necessaria');
  const database = 'JETTA_CONTROL_B3_TEST_' + crypto.randomBytes(6).toString('hex');
  const master = await connect('master');
  try { await master.query(`CREATE DATABASE [${database}]`);lifecycle('created',database); } finally { await master.close(); }
  const db = await connect(database);
  const cfg = {server:'localhost\\SQLEXPRESS', database, driver:'ODBC Driver 18 for SQL Server', trust:true, host:'127.0.0.1', port:0, b32, b33, b41:b33&&process.env.JETTA_B41_EVIDENCE==='YES', b52a:b33&&process.env.JETTA_B52A_EVIDENCE==='YES', b52:b33&&process.env.JETTA_B52_EVIDENCE==='YES', b51:b33&&process.env.JETTA_B51_EVIDENCE==='YES', b43:b33&&process.env.JETTA_B43_EVIDENCE==='YES', b42:b33&&process.env.JETTA_B42_EVIDENCE==='YES', token:crypto.randomBytes(32).toString('hex')};
  const close = async () => {
    try { await db.close(); } finally {
      const admin = await connect('master');
      try { if (!safeName(database)) throw Error('DROP proibido'); await admin.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${database}];`); if ((await admin.query(`SELECT DB_ID('${database}') AS Id`))[0]?.Id != null) throw Error('Cleanup incompleto');lifecycle('removed',database); } finally { await admin.close(); }
    }
  };
  try {
    for (const file of ['b3-common.sql','b3-rbac.sql','b3-operation.sql']) for (const batch of fs.readFileSync(new URL(file,import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim())) await db.query(batch);
    if(b32){
      await db.beginTransaction();
      try{
        for(const file of ['b3-mfa.sql','b3-2-patch.sql',...(b33?['b3-3-availability.sql','b3-3-patch.sql',...(process.env.JETTA_B41_EVIDENCE==='YES'?['b4-1-schema.sql',...(process.env.JETTA_B42_EVIDENCE==='YES'?['b4-2-schema.sql',...(process.env.JETTA_B43_EVIDENCE==='YES'?['b4-3-schema.sql',...(process.env.JETTA_B51_EVIDENCE==='YES'?['b5-1-schema.sql',...(process.env.JETTA_B52_EVIDENCE==='YES'?['b5-2-schema.sql']:[])]:[])]:[])]:[])]:[])]:[])])for(const batch of fs.readFileSync(new URL(file,import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim())){
          if((await db.query('SELECT DB_NAME() AS D'))[0]?.D!==database||!safeName(database))throw Error('Destino do patch B3 divergente');
          await db.query(batch);
        }
        await db.commit();
      }catch(e){try{await db.rollback();}catch{}throw e;}
    }
  } catch (e) { await close(); throw e; }
  if(['JETTA_B52A_EVIDENCE','JETTA_B52_EVIDENCE','JETTA_B51_EVIDENCE','JETTA_B43_EVIDENCE','JETTA_B42_EVIDENCE','JETTA_B41_EVIDENCE'].every(k=>process.env[k]==='YES'))try{for(const batch of fs.readFileSync(new URL('b5-2a-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);}catch(e){await close();throw e;}
  if(process.env.JETTA_B52B_EVIDENCE==='YES'&&['JETTA_B52A_EVIDENCE','JETTA_B52_EVIDENCE','JETTA_B51_EVIDENCE','JETTA_B43_EVIDENCE','JETTA_B42_EVIDENCE','JETTA_B41_EVIDENCE'].every(k=>process.env[k]==='YES'))try{for(const batch of fs.readFileSync(new URL('b5-2b-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);cfg.b52b=true;}catch(e){await close();throw e;}
  if(process.env.JETTA_B52C_EVIDENCE==='YES'&&cfg.b52b)try{for(const batch of fs.readFileSync(new URL('b5-2c-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);cfg.b52c=true;}catch(e){await close();throw e;}
  if(process.env.JETTA_F01_EVIDENCE==='YES'&&cfg.b52c)try{for(const batch of fs.readFileSync(new URL('b5-3-f01-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);cfg.b53f01=true;}catch(e){await close();throw e;}
  if(process.env.JETTA_F03_EVIDENCE==='YES'&&cfg.b53f01)try{for(const batch of fs.readFileSync(new URL('b5-3-f03-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);cfg.b53f03=true;}catch(e){await close();throw e;}
  if(process.env.JETTA_FINAL_SCHEMA==='YES'&&cfg.b53f03)try{for(const batch of fs.readFileSync(new URL('final-lab-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);}catch(e){await close();throw e;}
  let sequence = 0;
  async function user(profile = 'GESTOR', permissions = ['atividades.visualizar','atividades.criar']) {
    const email = `b3-${++sequence}@example.invalid`, password = crypto.randomBytes(24).toString('base64') + 'aA!1', salt = crypto.randomBytes(16).toString('hex');
    const id = (await db.query(`INSERT Seguranca.Usuario(Nome,Email,Perfil) OUTPUT inserted.UsuarioId VALUES(N'Usuario sintetico B3',${nvarcharLiteral(email)},'${profile}')`))[0].UsuarioId;
    await db.query(`INSERT Seguranca.Credencial(UsuarioId,SaltHex,SenhaHashHex) VALUES(${id},'${salt}','${hashPassword(password,salt)}'); INSERT Seguranca.PerfilAcesso(Codigo,Nome,Ativo) VALUES('B3_${sequence}',N'Perfil sintetico',1); INSERT Seguranca.UsuarioPerfil(UsuarioId,PerfilId) VALUES(${id},SCOPE_IDENTITY());`);
    for (const key of permissions) {
      if (!['atividades.visualizar','atividades.criar','atividades.confirmar','limites.excecao.aprovar','limites.configurar'].includes(key)) throw Error('Permissao sintetica inesperada');
      const critical=['atividades.confirmar','limites.excecao.aprovar','limites.configurar'].includes(key)?1:0;
      await db.query(`IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='${key}') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('${key}','OPERACAO',N'Teste B3',${critical}); INSERT Seguranca.PerfilPermissao(PerfilId,PermissaoId) SELECT up.PerfilId,p.PermissaoId FROM Seguranca.UsuarioPerfil up CROSS JOIN Seguranca.Permissao p WHERE up.UsuarioId=${id} AND p.Chave='${key}';`);
    }
    return {id, email, password};
  }
  return {cfg, database, db, user, close};
}
