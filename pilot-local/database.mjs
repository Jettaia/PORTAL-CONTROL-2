import odbc from 'odbc';import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';import {targetGuard} from './build-schema.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export async function connectPilot(database,server='localhost\\SQLEXPRESS'){
 if(database!=='master'&&database!=='JETTA_CONTROL_PILOTO_LOCAL'&&!/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(database))throw Error('Destino de instalacao recusado');
 if(!/^[-A-Za-z0-9_.\\]+$/.test(server))throw Error('Servidor invalido');
 const db=await odbc.connect(`Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=Yes;Connection Timeout=8;`);await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;');return db;
}
export async function installSchema(db,instance,{test=false}={}){
 if(!/^[a-f0-9]{64}$/.test(instance))throw Error('Instancia invalida');
 const name=(await db.query('SELECT DB_NAME() D'))[0].D;if(test?!/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(name):name!=='JETTA_CONTROL_PILOTO_LOCAL')throw Error('Instalacao no destino recusada');
 if(Number((await db.query('SELECT COUNT(*) N FROM sys.tables WHERE is_ms_shipped=0'))[0].N)!==0)throw Error('Instalacao exige banco vazio; nunca sobrepor dados');
 const manifest=JSON.parse(fs.readFileSync(path.join(here,'sql/manifest.json'),'utf8'));
 // Database-level CHANGE_TRACKING cannot run inside the schema transaction.
 // The validated destination is a new, empty database owned by this installer.
 await db.query(`ALTER DATABASE [${name}] SET CHANGE_TRACKING=ON(CHANGE_RETENTION=2 DAYS,AUTO_CLEANUP=ON)`);
 await db.beginTransaction();try{
  await db.query(`EXEC sys.sp_addextendedproperty @name=N'JETTA_PILOT_INSTANCE',@value=N'${instance}';EXEC sys.sp_addextendedproperty @name=N'JETTA_PILOT_STATE',@value=N'INSTALLING';${test?"EXEC sys.sp_addextendedproperty @name=N'JETTA_PILOT_TEST',@value=N'1';":''}`);
  for(const item of manifest.files){const sql=fs.readFileSync(path.join(here,'sql',item.file),'utf8');if(crypto.createHash('sha256').update(sql).digest('hex')!==item.sha256)throw Error('Integridade de migracao divergente');for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim())){await db.query(`IF NOT (${targetGuard}) THROW 55900,N'Destino do piloto divergente',1;`);await db.query(batch);}}
  await db.query("CREATE TABLE Seguranca.PilotoInicializacao(Id tinyint PRIMARY KEY CHECK(Id=1),TokenHash char(64) NOT NULL,AdminEmail nvarchar(256) NOT NULL,AdminNome nvarchar(150) NOT NULL,ConsumidoUtc datetime2 NULL);CREATE TABLE Seguranca.PilotoInstalacao(Versao varchar(40) PRIMARY KEY,InstaladoUtc datetime2 NOT NULL DEFAULT SYSUTCDATETIME());INSERT Seguranca.PilotoInstalacao(Versao) VALUES('1.0.0-pilot.rc1');EXEC sys.sp_updateextendedproperty @name=N'JETTA_PILOT_STATE',@value=N'READY';");
  await db.commit();
 }catch(error){try{await db.rollback();}catch{}throw error;}
 return {database:name,migrations:manifest.files.length};
}
