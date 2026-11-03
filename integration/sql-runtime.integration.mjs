import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot} from '../pilot-local/database.mjs';
import {runtimeGrantsSql} from '../src/sql-runtime.js';

test('SQL runtime: DML/SP permitidos, DDL/owner/backup e tabelas externas negados',{
 skip:process.env.SQL_RUNTIME_TESTS!=='YES',timeout:120000
},async t=>{
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const principal='RuntimeProof_'+crypto.randomBytes(6).toString('hex');
 const master=await connectPilot('master');let db,impersonated=false;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database);
  for(const schema of ['Cadastro','Seguranca','Operacao','Financeiro']){
   await db.query(`CREATE SCHEMA [${schema}] AUTHORIZATION dbo`);
   await db.query(`CREATE TABLE [${schema}].RuntimeProbe(Id int PRIMARY KEY,Value int NOT NULL)`);
   await db.query(`CREATE PROCEDURE [${schema}].RuntimeProbeRead AS SELECT COUNT(*) N FROM [${schema}].RuntimeProbe`);
  }
  await db.query('CREATE TABLE dbo.AdminOnly(Id int PRIMARY KEY)');
  await db.beginTransaction();try{await db.query(runtimeGrantsSql(principal,{withoutLogin:true}));await db.commit();}catch(e){await db.rollback();throw e;}
  await db.query(`EXECUTE AS USER=N'${principal}'`);impersonated=true;
  for(const schema of ['Cadastro','Seguranca','Operacao','Financeiro']){
   await db.query(`INSERT [${schema}].RuntimeProbe(Id,Value) VALUES(1,10)`);
   await db.query(`UPDATE [${schema}].RuntimeProbe SET Value=20 WHERE Id=1`);
   assert.equal(Number((await db.query(`SELECT Value FROM [${schema}].RuntimeProbe WHERE Id=1`))[0].Value),20);
   assert.equal(Number((await db.query(`EXEC [${schema}].RuntimeProbeRead`))[0].N),1);
   await db.query(`DELETE [${schema}].RuntimeProbe WHERE Id=1`);
  }
  const permissions=(await db.query("SELECT IS_MEMBER('db_owner') Owner,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') ControlDatabase,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','BACKUP DATABASE') BackupDatabase,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER ANY USER') AlterAnyUser,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') CreateTable"))[0];
  for(const value of Object.values(permissions))assert.equal(Number(value),0);
  await assert.rejects(()=>db.query('CREATE TABLE Cadastro.Unauthorized(Id int)'));
  await assert.rejects(()=>db.query('DROP TABLE Cadastro.RuntimeProbe'));
  await assert.rejects(()=>db.query('SELECT * FROM dbo.AdminOnly'));
  await assert.rejects(()=>db.query(`ALTER ROLE db_owner ADD MEMBER [${principal}]`));
  await db.query('REVERT');impersonated=false;
  assert.equal((await db.query("SELECT OBJECT_ID('Cadastro.Unauthorized') Id"))[0].Id,null);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Cadastro.RuntimeProbe'))[0].N),0);
  t.diagnostic('Prova dos grants com usuário WITHOUT LOGIN; autenticação Windows real depende da etapa elevada.');
 }finally{
  if(db){if(impersonated)try{await db.query('REVERT');}catch{}await db.close();}
  try{if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);t.diagnostic('Banco descartável removido: '+database);}finally{await master.close();}
 }
});
