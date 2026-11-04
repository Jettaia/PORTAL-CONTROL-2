const schemas=['Cadastro','Seguranca','Operacao','Financeiro'];
export const runtimeRole='JettaPortalRuntime';
export function windowsPrincipal(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_.-]+\\[A-Za-z0-9_.-]+$/.test(value))throw Error('Principal Windows inválido');
 return value;
}
const literal=value=>"N'"+value.replaceAll("'","''")+"'";
const identifier=value=>'['+value.replaceAll(']',']]')+']';
export function runtimeGrantsSql(principal,{withoutLogin=false}={}){
 if(withoutLogin){if(!/^RuntimeProof_[a-f0-9]{12}$/.test(principal))throw Error('Principal sintético inválido');}else windowsPrincipal(principal);
 const user=identifier(principal),role=identifier(runtimeRole);
 return `IF DATABASE_PRINCIPAL_ID(${literal(runtimeRole)}) IS NOT NULL THROW 55990,N'Role runtime já existe; revisão manual obrigatória',1;
IF DATABASE_PRINCIPAL_ID(${literal(principal)}) IS NOT NULL THROW 55990,N'Usuário runtime já existe; revisão manual obrigatória',1;
CREATE ROLE ${role} AUTHORIZATION dbo;
CREATE USER ${user} ${withoutLogin?'WITHOUT LOGIN':'FOR LOGIN '+user};
GRANT CONNECT TO ${user};
${schemas.map(schema=>`GRANT SELECT,INSERT,UPDATE,DELETE,EXECUTE ON SCHEMA::${identifier(schema)} TO ${role};`).join('\n')}
ALTER ROLE ${role} ADD MEMBER ${user};`;
}
export async function assertRuntimeIdentity(cfg,db){
 if(!cfg.sqlRuntimePrincipal)return;
 if(cfg.production){if(cfg.sqlRuntimePrincipal!=='JettaChapaRuntime'||cfg.sqlAuth?.user!==cfg.sqlRuntimePrincipal)throw Error('Principal SQL de produção inválido');}
 else windowsPrincipal(cfg.sqlRuntimePrincipal);
 const checks={Sysadmin:"IS_SRVROLEMEMBER('sysadmin')",DbOwner:"IS_MEMBER('db_owner')",ControlServer:"HAS_PERMS_BY_NAME(NULL,NULL,'CONTROL SERVER')",AlterAnyLogin:"HAS_PERMS_BY_NAME(NULL,NULL,'ALTER ANY LOGIN')",ControlDatabase:"HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL')",AlterAnySchema:"HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER ANY SCHEMA')",CreateTable:"HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE')",AlterAnyUser:"HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER ANY USER')",BackupDatabase:"HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','BACKUP DATABASE')",AlterAnyRole:"HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER ANY ROLE')",AlterSettings:"HAS_PERMS_BY_NAME(NULL,NULL,'ALTER SETTINGS')",AlterAnyDatabase:"HAS_PERMS_BY_NAME(NULL,NULL,'ALTER ANY DATABASE')",ImpersonateAnyLogin:"HAS_PERMS_BY_NAME(NULL,NULL,'IMPERSONATE ANY LOGIN')",AlterAnyConnection:"HAS_PERMS_BY_NAME(NULL,NULL,'ALTER ANY CONNECTION')",AlterAnyLinkedServer:"HAS_PERMS_BY_NAME(NULL,NULL,'ALTER ANY LINKED SERVER')",BulkOperations:"HAS_PERMS_BY_NAME(NULL,NULL,'ADMINISTER BULK OPERATIONS')"};
 for(const schema of schemas)checks['Alter'+schema]=`HAS_PERMS_BY_NAME(N'${schema}','SCHEMA','ALTER')`;
 const row=(await db.query('SELECT ORIGINAL_LOGIN() LoginName,'+Object.entries(checks).map(([name,sql])=>sql+' '+name).join(',')))[0];
 if(!row||String(row.LoginName).toLowerCase()!==cfg.sqlRuntimePrincipal.toLowerCase()||Object.keys(checks).some(name=>![0,0n,'0'].includes(row[name])))throw Error('Identidade SQL restrita inválida: conta ou privilégios divergentes');
}
