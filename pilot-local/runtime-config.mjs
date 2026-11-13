import {pilotDatabase} from '../src/pilot-target.js';
export async function assertContractExclusionReady(cfg,db){
 if(!cfg.pc04)return;
 const row=(await db.query("SELECT CASE WHEN OBJECT_ID(N'Operacao.ContratacaoExclusaoSolicitacao',N'U') IS NOT NULL AND OBJECT_ID(N'Operacao.ContratacaoNumeroExcluido',N'U') IS NOT NULL THEN 1 ELSE 0 END Pronto"))[0];
 if(Number(row?.Pronto)!==1)throw Error('Exclusão de contratações pendente: aplique a migração 45 antes de iniciar o portal.');
}
export async function assertFinanceReady(cfg,db){
 if(!cfg.fin01)return;
 const row=(await db.query("SELECT CASE WHEN OBJECT_ID(N'Financeiro.ContratacaoRecibo',N'U') IS NOT NULL THEN 1 ELSE 0 END Recibo,CASE WHEN OBJECT_ID(N'Financeiro.ContratacaoBaixa',N'U') IS NOT NULL THEN 1 ELSE 0 END Baixa,CONVERT(varchar(10),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_FIN04_RESET')) Reset"))[0];
 if(Number(row?.Recibo)!==1||Number(row?.Baixa)!==1||row?.Reset!=='1')throw Error('Financeiro pendente: aplique as migrações 33, 34 e 35, nessa ordem, antes de iniciar o piloto.');
}
export function pilotConfig(privateConfig){
 if(privateConfig.database!==pilotDatabase||privateConfig.host!=='127.0.0.1'||!['SIMULADO','REGISTRO_EXTERNO'].includes(privateConfig.finance)||!/^[-A-Za-z0-9_.\\]+$/.test(privateConfig.server||'')||!Number.isInteger(privateConfig.port)||privateConfig.port<1024||privateConfig.port>65535||!['pilotInstance','mfaKey','token'].every(k=>/^[a-f0-9]{64}$/.test(privateConfig[k]||'')))throw Error('Configuracao privada do piloto invalida');
 return {fin01:privateConfig.pc04===true,mfaRequired:false,server:privateConfig.server,database:pilotDatabase,host:'127.0.0.1',port:privateConfig.port,driver:'ODBC Driver 18 for SQL Server',trust:true,token:privateConfig.token,pilotInstance:privateConfig.pilotInstance,runtimeMode:'LOCAL_PILOT_V1',pc01:privateConfig.pc01===true,pc02:privateConfig.pc02===true,pc03:privateConfig.pc03===true,pc04:privateConfig.pc04===true,pc05:privateConfig.pc05===true,pc08:false,pc10:false,pc11:false,b32:true,b33:true,b34:true,b41:true,b42:true,b43:true,b51:false,b52:false,b52a:false,b52b:false,b52c:false,b53f01:false,b53f03:false,b61:false,finalLab:false,finalLabToolsRoot:privateConfig.toolsRoot};
}
