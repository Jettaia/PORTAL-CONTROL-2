import odbc from 'odbc';
export async function diagnostic(cfg) {
 const cs=`Driver={${cfg.driver}};Server=${cfg.server};Database=${cfg.database};Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=${cfg.trust?'Yes':'No'};Connection Timeout=5;`;
 const conn=await odbc.connect(cs);
 try {
  const result=await conn.query(`SELECT DB_NAME() AS Banco, @@SERVERNAME AS Servidor, CAST(SYSUTCDATETIME() AS varchar(40)) AS DataHoraUtc`);
  if(result[0]?.Banco!=='JETTA_CONTROL') throw new Error('Conexao fora do banco esperado');
  const objs=await conn.query(`SELECT v.Nome, CASE WHEN OBJECT_ID(v.Nome,v.Tipo) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS Resultado FROM (VALUES ('Cadastro.Filial','U'),('Cadastro.Deposito','U'),('Seguranca.Usuario','U'),('Seguranca.GestorDeposito','U'),('Cadastro.Prestador','U'),('Operacao.Atividade','U'),('Operacao.Participacao','U'),('Operacao.PoliticaLimite','U'),('Operacao.sp_CadastrarPoliticaLimite','P'),('Operacao.sp_ConfirmarParticipacao','P')) v(Nome,Tipo) ORDER BY Nome`);
  return {banco:result[0].Banco,servidor:result[0].Servidor,utc:result[0].DataHoraUtc,objetos:objs.map(({Nome,Resultado})=>({nome:Nome,resultado:Resultado}))};
 } finally { await conn.close(); }
}
