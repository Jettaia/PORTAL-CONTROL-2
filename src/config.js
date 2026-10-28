import 'dotenv/config';
export function configFromEnv(env=process.env) {
 const host=env.HOST||'127.0.0.1';
 if (!['127.0.0.1','::1','localhost'].includes(host)) throw new Error('B2.1 permite apenas host local.');
 const port=Number(env.PORT||3210);
 if (!Number.isInteger(port)||port<1024||port>65535) throw new Error('PORT invalida');
 const token=env.ADMIN_DIAGNOSTIC_TOKEN||'';
 if (token.length<40 || token==='COLOQUE_AQUI_TOKEN_ALEATORIO') throw new Error('Defina ADMIN_DIAGNOSTIC_TOKEN aleatorio de pelo menos 40 caracteres.');
 const server=env.SQL_SERVER;
 if (!server|| !/^[-A-Za-z0-9_.\\]+$/.test(server)) throw new Error('SQL_SERVER invalido.');
 const database=env.SQL_DATABASE||'JETTA_CONTROL';
 if(database!=='JETTA_CONTROL') throw new Error('Banco diferente de JETTA_CONTROL bloqueado.');
 const driver=env.ODBC_DRIVER||'ODBC Driver 18 for SQL Server';
 if(!['ODBC Driver 17 for SQL Server','ODBC Driver 18 for SQL Server'].includes(driver)) throw new Error('ODBC driver nao permitido.');
 return {host,port,token,server,database,driver,trust:env.SQL_TRUST_SERVER_CERTIFICATE==='true'};
}
