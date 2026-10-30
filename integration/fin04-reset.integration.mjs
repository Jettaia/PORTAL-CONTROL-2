import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {hashToken} from '../src/security.js';
import {resetFin04,fin04RetiredTables} from '../pilot-local/fin04-reset.mjs';
import {list as financeList} from '../src/fin01.js';

test('FIN04 SQL reset clears only legacy finance, preserves new FIN02/03 and operations, reconciles marker',{skip:process.env.FIN04_SQL_TESTS!=='YES'?'Requer FIN04_SQL_TESTS=YES e SQL Server local explícito.':false,timeout:240000},async()=>{
 const sqlServer=process.env.FIN04_SQL_SERVER||'localhost\\SQLEXPRESS';
 assert.match(sqlServer,/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância SQL local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const master=await connectPilot('master',sqlServer);let db,created=false;
 try{
  await master.query(`CREATE DATABASE [${database}]`);created=true;
  db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}',N'admin@example.test',N'Admin teste')`);
  const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false};
  await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','CC-A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Serviço teste');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','00000000001');");
  const ids=(await db.query(`INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem,ConferidoPor,LiberadoEmUtc,ValorLiberado,PagoEmUtc)
   OUTPUT inserted.ContratacaoId,inserted.DepositoId,inserted.PrestadorId,inserted.TipoServicoId
   VALUES(1,1,1,1,1,'2026-10-29','2026-10-29T08:00:00','2026-10-29T10:00:00',125.00,1,'LIBERADA','2026-10-29T08:00:00','2026-10-29T10:00:00','MANUAL','MANUAL',1,SYSUTCDATETIME(),125.00,'2026-10-28T10:00:00')`))[0];
  const contract=Number(ids.ContratacaoId);
  const legacyOnly=Number((await db.query(`INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem,ConferidoPor,LiberadoEmUtc,ValorLiberado,PagoEmUtc) OUTPUT inserted.ContratacaoId VALUES((SELECT COALESCE(MAX(Numero),0)+1 FROM Operacao.Contratacao),1,1,1,1,'2026-10-27','2026-10-27T08:00:00','2026-10-27T10:00:00',80.00,1,'LIBERADA','2026-10-27T08:00:00','2026-10-27T10:00:00','MANUAL','MANUAL',1,SYSUTCDATETIME(),80.00,'2026-10-28T10:00:00')`))[0].ContratacaoId);
  const openContract=Number((await db.query(`INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status) OUTPUT inserted.ContratacaoId VALUES((SELECT COALESCE(MAX(Numero),0)+1 FROM Operacao.Contratacao),1,1,1,1,'2026-10-26','2026-10-26T08:00:00','2026-10-26T10:00:00',70.00,1,'ABERTA')`))[0].ContratacaoId);
  const cancelled=Number((await db.query(`INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,PagoEmUtc) OUTPUT inserted.ContratacaoId VALUES((SELECT COALESCE(MAX(Numero),0)+1 FROM Operacao.Contratacao),1,1,1,1,'2026-10-25','2026-10-25T08:00:00','2026-10-25T10:00:00',60.00,1,'CANCELADA','2026-10-28T10:00:00')`))[0].ContratacaoId);
  await db.query(`SET XACT_ABORT ON;
   DECLARE @p bigint,@audit bigint,@close bigint,@proof uniqueidentifier=NEWID(),@evaluation bigint,@request bigint,@decision bigint,@version bigint,@exception bigint,@process bigint,@receipt bigint,@payment bigint,@attachment bigint;
   INSERT Operacao.Atividade(DepositoId,TipoServicoId,GestorUsuarioId,DataServico,InicioPrevisto,FimPrevisto,Status) VALUES(1,1,1,'2026-10-29','2026-10-29T08:00:00','2026-10-29T10:00:00','CONFIRMADA');
   INSERT Operacao.Participacao(AtividadeId,PrestadorId,ValorContratado,Status) VALUES(SCOPE_IDENTITY(),1,125.00,'CONFIRMADA');SET @p=SCOPE_IDENTITY();
   INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'FIN04',@p,N'SEED',1,N'{}');SET @audit=SCOPE_IDENTITY();
   INSERT Operacao.FechamentoParticipacao(ParticipacaoId,GestorId,Resultado,VersaoDados,RequisicaoId,ComandoHash,AuditoriaId) VALUES(@p,1,'FECHADO_REGULAR',REPLICATE('a',64),NEWID(),REPLICATE('b',64),@audit);SET @close=SCOPE_IDENTITY();
   INSERT Operacao.ComprovanteServico(ComprovanteId,FechamentoId,VersaoContrato,ConteudoJson,ConteudoHash,AuditoriaId) VALUES(@proof,@close,'1.0.0',N'{}',REPLICATE('c',64),@audit);
   INSERT Financeiro.ReferenciaCarteira(ParticipacaoId,Referencia,CriadoPor) VALUES(@p,'FIN04-LEGACY',1);
   INSERT Financeiro.AvaliacaoCarteira(ParticipacaoId,AtorId,RequisicaoId,ComandoHash,Resultado,RegrasVersao,VersaoDados,VersaoConsulta,FechamentoId,ComprovanteId,VersaoComprovante,MotivosJson,AuditoriaId) VALUES(@p,1,NEWID(),REPLICATE('d',64),'BLOQUEADA','B5.1-1.0.0',REPLICATE('e',64),REPLICATE('f',64),@close,@proof,REPLICATE('c',64),N'[]',@audit);SET @evaluation=SCOPE_IDENTITY();
   INSERT Financeiro.SolicitacaoAutorizacao(ParticipacaoId,AvaliacaoId,SolicitanteId,RequisicaoId,ComandoHash,VersaoConsulta,ValorHistorico,FechamentoId,ComprovanteId,VersaoComprovante,SnapshotJson,Justificativa,AuditoriaId) VALUES(@p,@evaluation,1,NEWID(),REPLICATE('a',64),REPLICATE('f',64),125.00,@close,@proof,REPLICATE('c',64),N'{}',N'Seed FIN04',@audit);SET @request=SCOPE_IDENTITY();
   DISABLE TRIGGER Financeiro.B52_DecisaoProtegida ON Financeiro.DecisaoAutorizacao;
   INSERT Financeiro.DecisaoAutorizacao(SolicitacaoId,AprovadorId,Resultado,Motivo,RequisicaoId,ComandoHash,AuditoriaId) VALUES(@request,1,'RECUSADA',N'Seed FIN04',NEWID(),REPLICATE('a',64),@audit);SET @decision=SCOPE_IDENTITY();ENABLE TRIGGER Financeiro.B52_DecisaoProtegida ON Financeiro.DecisaoAutorizacao;
   DISABLE TRIGGER Financeiro.B52_ObrigacaoBloqueada ON Financeiro.ObrigacaoPreparada;
   INSERT Financeiro.ObrigacaoPreparada(ObrigacaoId,ParticipacaoId,DecisaoId,PrestadorId,DepositoId,TipoServicoId,ValorAprovado,ReferenciaHistorica,Competencia,Vencimento,PoliticaVersao,Status,AuditoriaId) VALUES(NEWID(),@p,@decision,1,1,1,125.00,REPLICATE('b',64),'2026-10-01','2026-10-31','FIN04-LEGACY','CONSTITUIDA',@audit);ENABLE TRIGGER Financeiro.B52_ObrigacaoBloqueada ON Financeiro.ObrigacaoPreparada;
   INSERT Financeiro.ProntidaoVersao(ParticipacaoId,Tipo,Numero,AutorId,ContextoHash,ConteudoHash,RequisicaoId,ComandoHash,AuditoriaId,DadosJson) VALUES(@p,'BENEFICIARIO',1,1,REPLICATE('a',64),REPLICATE('b',64),NEWID(),REPLICATE('c',64),@audit,N'{}');SET @version=SCOPE_IDENTITY();
   DISABLE TRIGGER Financeiro.B52B_Independencia ON Financeiro.ProntidaoDecisao;
   INSERT Financeiro.ProntidaoDecisao(VersaoId,AprovadorId,Resultado,Motivo,ReferenciaFormal,AuditoriaId) VALUES(@version,1,'RECUSADA',N'Seed',N'Seed',@audit);ENABLE TRIGGER Financeiro.B52B_Independencia ON Financeiro.ProntidaoDecisao;
   DISABLE TRIGGER Financeiro.B52C_FontePolitica ON Financeiro.EncaminhamentoPolitica;
   INSERT Financeiro.EncaminhamentoPolitica(VersaoId,Estado,AtorId,ContextoHash,ConteudoHash,RequisicaoId,ComandoHash,Motivo,AuditoriaId) VALUES(@version,'PENDENTE_APROVACAO',1,REPLICATE('a',64),REPLICATE('b',64),NEWID(),REPLICATE('c',64),N'Seed',@audit);ENABLE TRIGGER Financeiro.B52C_FontePolitica ON Financeiro.EncaminhamentoPolitica;
   INSERT Financeiro.RegraFuncional(PoliticaId,Numero,Tipo,DepositoId,AutorId,ConteudoHash,DadosJson,RequisicaoId,ComandoHash,AuditoriaId) VALUES(NEWID(),1,'ALCADA',1,1,REPLICATE('a',64),N'{}',NEWID(),REPLICATE('b',64),@audit);DECLARE @rule bigint=SCOPE_IDENTITY();
   INSERT Financeiro.EventoRegraFuncional(VersaoId,Estado,AtorId,Motivo,Referencia,AuditoriaId) VALUES(@rule,'ENCAMINHADA',1,N'Seed',N'Seed',@audit);
   DISABLE TRIGGER Financeiro.F01_DecisorIndependente ON Financeiro.DecisaoExcecaoVencimentoLab;
   INSERT Financeiro.ExcecaoVencimentoLab(ParticipacaoId,VersaoId,DataMarco,ReferenciaMarco,DataOriginal,DataProposta,ContextoHash,SolicitanteId,Justificativa,RequisicaoId,ComandoHash,AuditoriaId) VALUES(@p,@rule,'2026-10-01',N'Seed','2026-10-01','2026-10-02',REPLICATE('a',64),1,N'Seed',NEWID(),REPLICATE('b',64),@audit);SET @exception=SCOPE_IDENTITY();
   INSERT Financeiro.DecisaoExcecaoVencimentoLab(ExcecaoId,AprovadorId,Resultado,Motivo,AuditoriaId) VALUES(@exception,1,'RECUSADA_LAB',N'Seed',@audit);ENABLE TRIGGER Financeiro.F01_DecisorIndependente ON Financeiro.DecisaoExcecaoVencimentoLab;
   DISABLE TRIGGER ALL ON Financeiro.EtapaAlcadaLab;
   INSERT Financeiro.EtapaAlcadaLab(ParticipacaoId,VersaoId,Ordem,AtorId,ContextoHash,AcessoHash,SnapshotJson,AuditoriaId) VALUES(@p,@rule,1,1,REPLICATE('a',64),REPLICATE('b',64),N'{}',@audit);ENABLE TRIGGER ALL ON Financeiro.EtapaAlcadaLab;
   INSERT Simulacao.Processo(ParticipacaoId,DepositoId,CriadorId,Simulado) VALUES(@p,1,1,1);SET @process=SCOPE_IDENTITY();
   INSERT Simulacao.Evento(ProcessoId,Numero,Acao,Estado,AtorId,RequisicaoId,ComandoHash,ConteudoJson,ConteudoHash,AuditoriaId,Simulado) VALUES(@process,1,'REGISTRAR_PAGAMENTO','PAGAMENTO_SIMULADO',1,NEWID(),REPLICATE('a',64),N'{"dados":{"referencia":"LAB"}}',REPLICATE('b',64),@audit,1);
   INSERT Simulacao.ReciboVersao(ProcessoId,Numero,Tipo,ConteudoJson,ConteudoHash,AutorId,AuditoriaId,Simulado) VALUES(@process,1,'EMITIDO_APOS_PAGAMENTO',N'{}',REPLICATE('c',64),1,@audit,1);SET @receipt=SCOPE_IDENTITY();
   INSERT Simulacao.Anexo(ProcessoId,ReciboId,Finalidade,Nome,Mime,Conteudo,ConteudoHash,AutorId,AuditoriaId,Simulado) VALUES(@process,@receipt,'EVIDENCIA_PAGAMENTO_SIMULADO',N'seed.pdf','application/pdf',0x255044462D312E340A30313233343536373839,LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',0x255044462D312E340A30313233343536373839),2)),1,@audit,1);
   INSERT Financeiro.PC08Pagamento(PrestadorId,DataPagamento,RegistradoPor,ValorTotal) VALUES(1,'2026-10-28',1,125.00);SET @payment=SCOPE_IDENTITY();
   INSERT Financeiro.PC08Item(PagamentoId,ContratacaoId,VersaoLiberada,Valor) VALUES(@payment,${contract},1,125.00);
   INSERT Financeiro.PC08Anexo(ContratacaoId,Nome,Conteudo) VALUES(${contract},N'old.pdf',0x25504446);
   INSERT Financeiro.PC10Movimento(ContratacaoId,Chave,Tipo,Valor,DataEfetiva,Versao,AtorUsuarioId,PagamentoId) VALUES(${contract},N'FIN04:OLD','PAGAMENTO',-125.00,'2026-10-28',1,1,@payment);
   INSERT Financeiro.PC10Estorno(PagamentoId,AtorUsuarioId,Motivo) VALUES(@payment,1,N'Seed');
   INSERT Financeiro.PC10DocumentoEstado(ContratacaoId,Versao,Estado,ExigeNovaAssinatura,Motivo,AtorUsuarioId) VALUES(${contract},1,'SUBSTITUIDO',1,N'Seed',1);
   INSERT Financeiro.ContratacaoRecibo(ContratacaoId,VersaoOrigem,DepositoId,PrestadorId,TipoServicoId,DataServico,ValorLiberado,LiberadoEmUtc,DataEmissao,EmitidoEmUtc,EmitidoPor,SnapshotJson,DocumentoHtml) VALUES(${contract},1,1,1,1,'2026-10-29',125.00,SYSUTCDATETIME(),'2026-10-29',SYSUTCDATETIME(),1,N'{}',N'<html>receipt</html>');
   INSERT Financeiro.ContratacaoAnexo(ContratacaoId,ReciboId,Nome,Tipo,Tamanho,Sha256,CriadoPor,Conteudo) SELECT ${contract},ReciboId,N'signed.pdf','application/pdf',DATALENGTH(0x255044462D312E340A30313233343536373839),LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',0x255044462D312E340A30313233343536373839),2)),1,0x255044462D312E340A30313233343536373839 FROM Financeiro.ContratacaoRecibo WHERE ContratacaoId=${contract};SET @attachment=SCOPE_IDENTITY();
   INSERT Financeiro.ContratacaoBaixa(ContratacaoId,ReciboId,AnexoId,Valor,DataPagamento,ConfirmadoPor) SELECT ${contract},ReciboId,@attachment,125.00,'2026-10-29',1 FROM Financeiro.ContratacaoRecibo WHERE ContratacaoId=${contract};
   UPDATE Operacao.Contratacao SET PagoEmUtc='2026-10-28T10:00:00' WHERE ContratacaoId=${contract};
   EXEC sys.sp_dropextendedproperty @name=N'JETTA_FIN04_RESET';`);
  // Unexpected FK references must fail closed and preserve all seeded legacy rows.
  await db.query('CREATE TABLE Financeiro.FIN04UnexpectedRef(Id bigint PRIMARY KEY,PagamentoId bigint NOT NULL REFERENCES Financeiro.PC08Pagamento(PagamentoId));INSERT Financeiro.FIN04UnexpectedRef(Id,PagamentoId) SELECT 1,PagamentoId FROM Financeiro.PC08Pagamento;');
  await db.beginTransaction();try{await assert.rejects(()=>resetFin04(db));await db.rollback();}catch(error){try{await db.rollback();}catch{}throw error;}
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC08Pagamento')).at(0).N),1);
  await db.query('DROP TABLE Financeiro.FIN04UnexpectedRef');
  // An error after cleanup (marker reconciliation) must roll the entire reset back.
  await db.query("CREATE TRIGGER Operacao.FIN04InjectedFailure ON Operacao.Contratacao AFTER UPDATE AS THROW 55988,N'FIN04 rollback injection',1;");
  await db.beginTransaction();try{await assert.rejects(()=>resetFin04(db));await db.rollback();}catch(error){try{await db.rollback();}catch{}throw error;}
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC08Pagamento')).at(0).N),1);
  assert.equal((await db.query("SELECT value V FROM sys.extended_properties WHERE class=0 AND name='JETTA_FIN04_RESET'")).length,0);
  await db.query('DROP TRIGGER Operacao.FIN04InjectedFailure');
  await db.query('DISABLE TRIGGER Financeiro.tr_B51_Referencia ON Financeiro.ReferenciaCarteira');
  await db.beginTransaction();try{const result=await resetFin04(db);assert.equal(result.legacyTablesCleared,fin04RetiredTables.length);await db.commit();}catch(error){try{await db.rollback();}catch{}throw error;}
  await db.query(`IF EXISTS(SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID('Financeiro.tr_B51_Avaliacao') AND is_disabled=1) THROW 55810,N'Gatilho FIN04 nao foi restaurado',1;IF NOT EXISTS(SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID('Financeiro.tr_B51_Referencia') AND is_disabled=1) THROW 55811,N'Estado desabilitado original nao foi preservado',1;`);
  const paid=(await db.query(`SELECT c.PagoEmUtc,b.ConfirmadoEmUtc FROM Operacao.Contratacao c JOIN Financeiro.ContratacaoBaixa b ON b.ContratacaoId=c.ContratacaoId AND b.DesfeitoEmUtc IS NULL WHERE c.ContratacaoId=${contract}`))[0];assert.equal(new Date(paid.PagoEmUtc).toISOString(),new Date(paid.ConfirmadoEmUtc).toISOString());
  const resetLegacyMarker=(await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${legacyOnly}`))[0];assert.equal(resetLegacyMarker.PagoEmUtc,null);
  assert.equal((await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${cancelled}`))[0].PagoEmUtc,null);
  const cfgForQueue={...cfg,pc04:true,fin01:true};
  const queue=await financeList(cfgForQueue,1,{});
  assert.deepEqual(queue.registros.map(row=>Number(row.ContratacaoId)).sort((a,b)=>a-b),[contract,legacyOnly].sort((a,b)=>a-b));
  assert.equal(queue.registros.find(row=>Number(row.ContratacaoId)===legacyOnly).Situacao,'AGUARDANDO_PAGAMENTO');
  assert.equal(queue.registros.find(row=>Number(row.ContratacaoId)===contract).Situacao,'PAGO');
  assert.ok(!queue.registros.some(row=>Number(row.ContratacaoId)===openContract||Number(row.ContratacaoId)===cancelled));
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade=N\'FIN04\' AND Acao=N\'SEED\'')).at(0).N),1);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoRecibo')).at(0).N),1);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoAnexo')).at(0).N),1);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa WHERE DesfeitoEmUtc IS NULL')).at(0).N),1);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Operacao.ContratacaoEvento')).at(0).N),0);
  const marker=(await db.query("SELECT CONVERT(varchar(10),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_FIN04_RESET'"))[0]?.V;assert.equal(marker,'1');
  await db.beginTransaction();try{const result=await resetFin04(db);assert.equal(result.marker,'1');await db.commit();}catch(error){try{await db.rollback();}catch{}throw error;}
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa WHERE DesfeitoEmUtc IS NULL')).at(0).N),1);
 }finally{
  if(db)await db.close();
  if(created)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);
  await master.close();
 }
});
