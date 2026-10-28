import {verifyPilotDatabase} from './pilot-target.js';
import odbc from 'odbc';
import {observeConnection,emit,safeSqlErrors} from './observability.js';
import crypto from 'node:crypto';
import {hashPassword,hashToken,newToken,passwordValid} from './security.js';
const sqlFlag=value=>value===true||value===1||value===1n||value==='1';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function connectionString(cfg){return `Driver={${cfg.driver}};Server=${cfg.server};Database=${cfg.database};Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=${cfg.trust?'Yes':'No'};Connection Timeout=5;`;}
export async function withDb(cfg,fn){
 const started=performance.now();let db,failure;
 try{db=await odbc.connect(connectionString(cfg));await verifyPilotDatabase(cfg,db);db=await observeConnection(cfg,db);emit(cfg,'sql.connected',{durationMs:Math.round(performance.now()-started)});return await fn(db);}
 catch(error){failure=error;emit(cfg,'sql.failure',{errors:safeSqlErrors(error)});throw error;}
 finally{if(db)try{await db.close();}catch(closeError){emit(cfg,'sql.close.failure',{errors:safeSqlErrors(closeError)});if(!failure)throw closeError;}}
}

const value=(row,name)=>row?.[name];
// SAFE SQL literals for ODBC configurations failing SQLDescribeParam.
// User-controlled text is represented only as UTF-16LE hexadecimal bytes, never SQL syntax.
export function nvarcharLiteral(input, max=256) {
 if (typeof input !== 'string' || input.length > max) throw Error('Texto invalido');
 return `CONVERT(nvarchar(${max}), 0x${Buffer.from(input,'utf16le').toString('hex')})`;
}
export function intLiteral(input) {
 const n = Number(input);
 if (!Number.isSafeInteger(n) || n < 1) throw Error('Identificador invalido');
 return String(n);
}
export function tokenHashLiteral(hash) {
 if (!/^[a-f0-9]{64}$/i.test(hash)) throw Error('Hash de sessao invalido');
 return `'${hash.toLowerCase()}'`;
}

export async function login(cfg,email,password){
 const normalized=email.trim().toLowerCase();
 return withDb(cfg,async db=>{
  // Lock user+credential during password attempt to serialize counters and avoid lost updates.
  await db.beginTransaction();
  try{
   const rows=await db.query(`SELECT TOP 1 u.UsuarioId,u.Nome,u.Email,u.Perfil,u.Ativo,c.SaltHex,c.SenhaHashHex,c.Falhas,c.BloqueadoAteUtc,
    CASE WHEN c.BloqueadoAteUtc>SYSUTCDATETIME() THEN 1 ELSE 0 END AS EmBloqueio
    FROM Seguranca.Usuario u WITH(UPDLOCK,ROWLOCK) JOIN Seguranca.Credencial c WITH(UPDLOCK,ROWLOCK) ON u.UsuarioId=c.UsuarioId
    WHERE LOWER(u.Email)=${nvarcharLiteral(normalized)}`);
   const row=rows[0];
   if(!row||!sqlFlag(row.Ativo)||sqlFlag(row.EmBloqueio)){await db.rollback(); await wait(300);return null;}
   const valid=passwordValid(password,row.SaltHex,row.SenhaHashHex);
   if(!valid){await db.query(`UPDATE Seguranca.Credencial SET Falhas=CASE WHEN Falhas>=99 THEN 100 ELSE Falhas+1 END,
    BloqueadoAteUtc=CASE WHEN Falhas>=4 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE NULL END WHERE UsuarioId=${intLiteral(row.UsuarioId)}`);
    await db.commit();return null;}
   await db.query(`UPDATE Seguranca.Credencial SET Falhas=0,BloqueadoAteUtc=NULL WHERE UsuarioId=${intLiteral(row.UsuarioId)}`);
   const token=newToken();
   await db.query(`INSERT Seguranca.SessaoWeb(UsuarioId,TokenHash,ExpiraEmUtc) VALUES(${intLiteral(row.UsuarioId)},${tokenHashLiteral(hashToken(token))},DATEADD(hour,8,SYSUTCDATETIME()))`);
   await db.commit();
   return {token,user:{id:row.UsuarioId,nome:row.Nome,email:row.Email,perfil:row.Perfil},mfa:false};
  }catch(e){try{await db.rollback();}catch{}throw e;}
 });
}
export async function findSession(cfg,token){
 if(cfg.b34)return findSessionConsistent(cfg,token);
 return withDb(cfg,async db=>{const rows=await db.query(`SELECT TOP 1 u.UsuarioId AS id,u.Nome AS nome,u.Email AS email,u.Perfil AS perfil
  FROM Seguranca.SessaoWeb s JOIN Seguranca.Usuario u ON u.UsuarioId=s.UsuarioId
  WHERE s.TokenHash=${tokenHashLiteral(hashToken(token))} AND s.RevogadoEmUtc IS NULL AND s.ExpiraEmUtc>SYSUTCDATETIME() AND u.Ativo=1`);return rows[0]||null;});
}
export async function logout(cfg,token){return withDb(cfg,db=>db.query(`UPDATE Seguranca.SessaoWeb SET RevogadoEmUtc=SYSUTCDATETIME() WHERE TokenHash=${tokenHashLiteral(hashToken(token))} AND RevogadoEmUtc IS NULL`));}
export async function depositsFor(cfg,user){return withDb(cfg,async db=>{
 const result=await db.query(`SELECT d.DepositoId,d.FilialId,d.Codigo,d.Nome
 FROM Cadastro.Deposito d WHERE d.Ativo=1 AND
 ((${nvarcharLiteral(user.perfil,20)}='ADMIN') OR (${nvarcharLiteral(user.perfil,20)}='GESTOR' AND EXISTS(
 SELECT 1 FROM Seguranca.GestorDeposito g WHERE g.DepositoId=d.DepositoId AND g.GestorUsuarioId=${intLiteral(user.id)} AND g.RevogadoEm IS NULL)))
 ORDER BY d.Nome`);return result;
});}
// Encode text as UTF-16LE hexadecimal rather than injecting user content into SQL.
// The SQL statement has no ODBC parameter markers: this avoids SQLDescribeParam
// for the one-time bootstrap in affected Windows ODBC installations.
export function bootstrapSql(name,email,salt,pwdHash){
 const nvhex = s => '0x' + Buffer.from(s, 'utf16le').toString('hex');
 if(!/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(pwdHash))
  throw Error('Hash/salt invalidos para bootstrap.');
 return `DECLARE @Nome nvarchar(150) = CONVERT(nvarchar(150), ${nvhex(name)});
`+
  `DECLARE @Email nvarchar(256) = CONVERT(nvarchar(256), ${nvhex(email)});
`+
  `DECLARE @SaltHex varchar(32) = '${salt}';
`+
  `DECLARE @SenhaHashHex varchar(128) = '${pwdHash}';
`+
  `EXEC Seguranca.sp_BootstrapAdmin @Nome=@Nome, @Email=@Email, @SaltHex=@SaltHex, @SenhaHashHex=@SenhaHashHex;`;
}
export async function bootstrapAdmin(cfg,{name,email,password}){
 if(!name||name.trim().length<3||name.trim().length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>256||!password||password.length<14||password.length>128)
  throw Error('Dados invalidos para Admin inicial.');
 const salt=crypto.randomBytes(16).toString('hex');
 const pwdHash=hashPassword(password,salt);
 const sql=bootstrapSql(name.trim(),email.trim().toLowerCase(),salt,pwdHash);
 return withDb(cfg,async db=>{
  const rows=await db.query(sql);
  const id=rows?.[0]?.UsuarioId;
  if(!id) throw Error('Bootstrap nao retornou UsuarioId; confira administradores existentes antes de repetir.');
  return id;
 });
}
async function findSessionConsistent(cfg,token){
 return withDb(cfg,async db=>{
  await db.query('SET NOCOUNT ON;SET LOCK_TIMEOUT 5000;');
  // Locate only. No authorization is granted from this preliminary autocommit read.
  emit(cfg,'auth.stage',{stage:'locate'});
  const candidate=(await db.query(`SELECT UsuarioId FROM Seguranca.SessaoWeb WHERE TokenHash=${tokenHashLiteral(hashToken(token))}`))[0];
  if(!candidate)return null;
  await db.beginTransaction();
  try{
   // Consistent order: User -> Session, avoiding Session S -> User S inversion.
   emit(cfg,'auth.stage',{stage:'user'});
   const user=(await db.query(`SELECT UsuarioId AS id,Nome AS nome,Email AS email,Perfil AS perfil FROM Seguranca.Usuario WITH(HOLDLOCK) WHERE UsuarioId=${intLiteral(candidate.UsuarioId)} AND Ativo=1`))[0];
   if(!user){await db.rollback();return null;}
   emit(cfg,'auth.stage',{stage:'session-revalidate'});
   const valid=(await db.query(`SELECT SessaoId FROM Seguranca.SessaoWeb WITH(HOLDLOCK) WHERE UsuarioId=${intLiteral(candidate.UsuarioId)} AND TokenHash=${tokenHashLiteral(hashToken(token))} AND RevogadoEmUtc IS NULL AND ExpiraEmUtc>SYSUTCDATETIME()`)).length>0;
   await db.commit();return valid?user:null;
  }catch(error){try{await db.rollback();}catch{}throw error;}
 });
}

// EXEC arguments must be variables/constants, not inline CONVERT expressions.
export function procedureSql(procedure,parameters){
 if(!/^[A-Za-z]+\.sp_[A-Za-z0-9_]+$/.test(procedure)||!parameters||Array.isArray(parameters))throw Error('Procedimento invalido');
 const declarations=[],argumentsList=[];let index=0;for(const [name,value]of Object.entries(parameters)){if(!/^[A-Za-z][A-Za-z0-9]*$/.test(name))throw Error('Parametro invalido');const variable='@JettaArg'+index++;let type,literal;if(value===null){type='nvarchar(max)';literal='NULL';}else if(typeof value==='boolean'){type='bit';literal=value?'1':'0';}else if(typeof value==='number'){type='bigint';literal=intLiteral(value);}else if(typeof value==='string'){type='nvarchar(max)';literal=nvarcharLiteral(value,'max');}else throw Error('Valor de parametro invalido');declarations.push('DECLARE '+variable+' '+type+'='+literal+';');argumentsList.push('@'+name+'='+variable);}
 return declarations.join('')+'EXEC '+procedure+' '+argumentsList.join(',')+';';
}
