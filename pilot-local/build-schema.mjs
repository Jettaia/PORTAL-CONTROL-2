import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export const sources=['b3-common.sql','b3-rbac.sql','b3-operation.sql','b3-mfa.sql','b3-2-patch.sql','b3-3-availability.sql','b3-3-patch.sql','b4-1-schema.sql','b4-2-schema.sql','b4-3-schema.sql','b5-1-schema.sql','b5-2-schema.sql','b5-2a-schema.sql','b5-2b-schema.sql','b5-2c-schema.sql','b5-3-f01-schema.sql','b5-3-f03-schema.sql','final-lab-schema.sql','b6-1-uat-cadastro.sql','final-lab-admin.sql'];
export const targetGuard="(DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)";
export function buildSchema(){
 const output=path.join(here,'sql');fs.mkdirSync(output,{recursive:true});const files=[];
 for(const [index,source] of sources.entries()){
  const bytes=fs.readFileSync(path.join(here,'../integration',source));let text=bytes.toString('utf8');
  text=text.replace(/IF [^\r\n]*DB_NAME\(\)[^\r\n]*?THROW/g,`IF NOT (${targetGuard}) THROW`);
  text=text.replaceAll('FIXTURE_UAT_B61','PILOTO_LOCAL_V1').replaceAll('"dadosSinteticos":true','"pilotoLocal":true').replaceAll('sp_LabAdminGuard','sp_PilotAdminGuard').replaceAll('Administrador sintetico obrigatorio','Administrador do piloto obrigatorio').replaceAll('ConviteAtivacaoLab','ConviteAtivacaoPiloto').replaceAll("N'CONVITE_LAB'","N'CONVITE_PILOTO'").replaceAll("N'ATIVAR_LAB'","N'ATIVAR_PILOTO'");
  // Directorate activation is followed by the mandatory privileged MFA gate.
  // Additional ADMIN accounts remain outside this invitation flow.
  text=text.replaceAll("Perfil NOT IN('ADMIN','DIRETORIA')","Perfil<>'ADMIN'");
  text=text.replace(/^--.*(?:fixture|FIXTURE|SOMENTE banco|Never an installer|Legacy B2B definitions).*$/gm,'-- Schema do piloto local derivado da base testada; sem registros operacionais.');
  const file=String(index+1).padStart(2,'0')+'-'+source;fs.writeFileSync(path.join(output,file),text);
  files.push({file,source,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sha256:crypto.createHash('sha256').update(text).digest('hex')});
 }
 const custom=fs.readFileSync(path.join(here,'operational.sql'),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino do piloto recusado',1;`),file='21-pilot-operational.sql';fs.writeFileSync(path.join(output,file),custom);files.push({file,source:'pilot-local/operational.sql',sha256:crypto.createHash('sha256').update(custom).digest('hex')});
 const metadata={version:'1.0.0-pilot.rc1',purpose:'PILOTO_LOCAL_FINANCEIRO_SIMULADO',files};fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(metadata,null,2)+'\n');return metadata;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({files:buildSchema().files.length}));
