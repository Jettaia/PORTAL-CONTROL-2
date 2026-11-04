import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot} from '../pilot-local/database.mjs';
import {seedNewChapa} from '../production/bootstrap.mjs';
import {hashPassword,passwordValid} from '../src/security.js';
test('Chapa: banco novo mantém apenas ADMIN/credencial e recusa sobrescrita',{timeout:180000},async()=>{
 assert.equal(process.env.CHAPA_SQL_TESTS,'YES','Execute explicitamente em SQL descartável');
 const name='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex'),server='localhost\\SQLEXPRESS';
 const master=await connectPilot('master',server);let db;
 try{
  await master.query(`CREATE DATABASE [${name}]`);db=await connectPilot(name,server);
  const salt=crypto.randomBytes(16).toString('hex'),password='Synthetic-Chapa-Only-29!a';
  const admin={id:'1',name:'Administrador sintético',email:'admin@chapa.invalid',saltHex:salt,passwordHashHex:hashPassword(password,salt)};
  await assert.rejects(()=>seedNewChapa(db,{pilotInstance:crypto.randomBytes(32).toString('hex'),admin:{...admin,passwordHashHex:'invalid'},test:true}),/Credencial/);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM sys.tables WHERE is_ms_shipped=0'))[0].N),0);
  const result=await seedNewChapa(db,{pilotInstance:crypto.randomBytes(32).toString('hex'),admin,test:true});
  assert.deepEqual(result,{migrations:38,adminCount:1,operationalRows:0,credentialPreserved:true});
  const row=(await db.query('SELECT c.SaltHex,c.SenhaHashHex,u.Email FROM Seguranca.Credencial c JOIN Seguranca.Usuario u ON u.UsuarioId=c.UsuarioId'))[0];
  assert.equal(row.Email,admin.email);assert.equal(passwordValid(password,row.SaltHex,row.SenhaHashHex),true);assert.equal(passwordValid('wrong',row.SaltHex,row.SenhaHashHex),false);
  await assert.rejects(()=>seedNewChapa(db,{pilotInstance:crypto.randomBytes(32).toString('hex'),admin,test:true}),/banco vazio/);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Usuario'))[0].N),1);
 }finally{
  if(db)await db.close();await master.query(`ALTER DATABASE [${name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${name}]`);
  assert.equal((await master.query(`SELECT DB_ID('${name}') D`))[0].D,null);await master.close();
 }
});
