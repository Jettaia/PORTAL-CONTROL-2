import fs from 'node:fs';
// Reuses audited definitions, with bounded insertions; no second limits engine.
const old=fs.readFileSync('integration/b3-2-patch.sql','utf8');
const batches=old.split(/^\s*GO\s*$/im);
const fn=batches.find(s=>s.includes('CREATE OR ALTER FUNCTION')).replace("'limites.excecao.aprovar'","'limites.excecao.aprovar','limites.configurar'");
const proof=old.slice(old.indexOf('  IF NOT EXISTS(SELECT 1 FROM Seguranca.SessaoWeb'),old.indexOf("  IF EXISTS(SELECT 1 FROM Operacao.Participacao p JOIN Operacao.Atividade a"));
if(!proof.includes('THROW 54203'))throw Error('MFA contract changed');
let policy=fs.readFileSync('integration/b3-operation.sql','utf8').split(/^\s*GO\s*$/im).find(s=>s.includes('CREATE OR ALTER PROCEDURE Operacao.sp_CadastrarPoliticaLimite'));
policy=policy.replace('@VigenteAte date=NULL','@VigenteAte date=NULL,@SessaoHash char(64)=NULL');
policy=policy.replace('  BEGIN TRAN;',`  BEGIN TRAN;
  DECLARE @lr int;
  EXEC @lr=sys.sp_getapplock @Resource=N'JettaControl.Politicas',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
  IF @lr<0 THROW 54151,N'Politicas ocupadas',1;
  IF Seguranca.fn_Pode(@AdminId,'limites.configurar')<>1 THROW 54201,N'Permissao negada',1;
${proof.replaceAll('@GestorId','@AdminId')}
  IF @Modo IS NULL OR @Modo<>'DIAS_CONTRATADOS' THROW 54301,N'Modo indisponivel',1;
  IF EXISTS(SELECT 1 FROM Operacao.Participacao p WITH(UPDLOCK,HOLDLOCK) JOIN Operacao.Atividade a WITH(UPDLOCK,HOLDLOCK) ON a.AtividadeId=p.AtividadeId
   WHERE p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA') AND a.Status<>'CANCELADA' AND a.DataServico>=@VigenteDesde AND (@VigenteAte IS NULL OR a.DataServico<=@VigenteAte))
   THROW 54302,N'Impacto historico exige decisao formal',1;`);
policy=policy.replace('@JanelaDias<@LimiteDias','@JanelaDias<@LimiteDias OR @JanelaDias>36500');
policy=policy.replace('@JanelaDias janelaDias FOR JSON','@JanelaDias janelaDias,@VigenteDesde vigenteDesde,@VigenteAte vigenteAte FOR JSON');
let confirm=batches.find(s=>s.includes('CREATE OR ALTER PROCEDURE Operacao.sp_ConfirmarParticipacao'));
confirm=confirm.replace('  DECLARE @e TABLE',`  IF NOT EXISTS(SELECT 1 FROM Operacao.DisponibilidadePrestador WITH(UPDLOCK,HOLDLOCK)
   WHERE PrestadorId=@Prestador AND DepositoId=@Deposito AND Estado='DISPONIVEL' AND Inicio<=@Inicio AND Fim>=@Fim)
   THROW 54303,N'Disponibilidade integral nao informada',1;
  DECLARE @e TABLE`);
fs.writeFileSync('integration/b3-3-patch.sql',[fn,policy,confirm].join('\nGO\n')+'\nGO\n');
