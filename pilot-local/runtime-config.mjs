import {pilotDatabase} from '../src/pilot-target.js';
export function pilotConfig(privateConfig){
 if(privateConfig.database!==pilotDatabase||privateConfig.host!=='127.0.0.1'||privateConfig.finance!=='SIMULADO'||!/^[-A-Za-z0-9_.\\]+$/.test(privateConfig.server||'')||!Number.isInteger(privateConfig.port)||privateConfig.port<1024||privateConfig.port>65535||!['pilotInstance','mfaKey','token'].every(k=>/^[a-f0-9]{64}$/.test(privateConfig[k]||'')))throw Error('Configuracao privada do piloto invalida');
 return {server:privateConfig.server,database:pilotDatabase,host:'127.0.0.1',port:privateConfig.port,driver:'ODBC Driver 18 for SQL Server',trust:true,token:privateConfig.token,pilotInstance:privateConfig.pilotInstance,runtimeMode:'LOCAL_PILOT_V1',b32:true,b33:true,b34:true,b41:true,b42:true,b43:true,b51:true,b52:true,b52a:true,b52b:true,b52c:true,b53f01:true,b53f03:true,b61:true,finalLab:true,finalLabToolsRoot:privateConfig.toolsRoot};
}
