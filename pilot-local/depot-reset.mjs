import {intLiteral,nvarcharLiteral} from '../src/auth-db.js';
import {targetGuard} from './build-schema.mjs';

// Explicit maintenance only. The caller owns the transaction and stops the app.
// Structural permission catalogs/installation metadata are software, not user data.
export async function resetPilotData(db,{preserveEmail,pilotInstance}){
 if(preserveEmail!=='guilherme.ribeiro@jettatransportes.com.br'||!/^[a-f0-9]{64}$/.test(pilotInstance||''))throw Error('Preservacao do administrador obrigatoria');
 await db.query(`IF @@TRANCOUNT=0 THROW 55940,N'Limpeza exige transacao externa',1;IF NOT (${targetGuard}) THROW 55940,N'Destino recusado',1;`);
 const marker=(await db.query("SELECT CONVERT(varchar(64),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE'"))[0]?.V;
 if(marker!==pilotInstance)throw Error('Identidade do banco divergente');
 const admins=await db.query(`SELECT u.UsuarioId,c.SaltHex,c.SenhaHashHex FROM Seguranca.Usuario u JOIN Seguranca.Credencial c ON c.UsuarioId=u.UsuarioId JOIN Seguranca.UsuarioRaiz r ON r.UsuarioId=u.UsuarioId WHERE LOWER(LTRIM(RTRIM(u.Email)))=${nvarcharLiteral(preserveEmail)} AND u.Perfil='ADMIN' AND u.Ativo=1`);
 if(admins.length!==1)throw Error('Administrador ativo com credencial e acesso raiz obrigatorio');
 const admin=admins[0],id=intLiteral(admin.UsuarioId);
 const tables=await db.query("SELECT s.name S,t.name T FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0 ORDER BY s.name,t.name");
 const triggers=await db.query("SELECT OBJECT_SCHEMA_NAME(object_id) S,name N,OBJECT_SCHEMA_NAME(parent_id) TS,OBJECT_NAME(parent_id) T FROM sys.triggers WHERE parent_class=1 AND is_disabled=0 AND is_ms_shipped=0");
 const quote=v=>{if(!/^[A-Za-z0-9_]+$/.test(v))throw Error('Objeto nao reconhecido');return '['+v+']';};
 for(const t of triggers)await db.query(`DISABLE TRIGGER ${quote(t.S)}.${quote(t.N)} ON ${quote(t.TS)}.${quote(t.T)}`);
 for(const t of tables)await db.query(`ALTER TABLE ${quote(t.S)}.${quote(t.T)} NOCHECK CONSTRAINT ALL`);
 const structural=new Set(['Seguranca.Permissao','Seguranca.PerfilAcesso','Seguranca.PerfilPermissao','Seguranca.PilotoInicializacao','Seguranca.PilotoInstalacao']);
 const accounts=new Set(['Seguranca.Usuario','Seguranca.UsuarioRaiz','Seguranca.UsuarioPerfil','Seguranca.Credencial']);
 for(const t of tables){const name=t.S+'.'+t.T;if(structural.has(name))continue;await db.query(`DELETE FROM ${quote(t.S)}.${quote(t.T)}${accounts.has(name)?` WHERE UsuarioId<>${id}`:''}`);}
 for(const t of tables)await db.query(`ALTER TABLE ${quote(t.S)}.${quote(t.T)} WITH CHECK CHECK CONSTRAINT ALL`);
 for(const t of triggers)await db.query(`ENABLE TRIGGER ${quote(t.S)}.${quote(t.N)} ON ${quote(t.TS)}.${quote(t.T)}`);
 const preserved=(await db.query(`SELECT SaltHex,SenhaHashHex FROM Seguranca.Credencial WHERE UsuarioId=${id}`))[0];
 if(!preserved||preserved.SaltHex!==admin.SaltHex||preserved.SenhaHashHex!==admin.SenhaHashHex||Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Usuario'))[0].N)!==1)throw Error('Preservacao da conta falhou');
 return {administratorPreserved:true,credentialsUnchanged:true,tablesCleared:tables.length-structural.size-accounts.size};
}
