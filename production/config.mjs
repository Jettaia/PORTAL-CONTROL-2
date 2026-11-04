import net from 'node:net';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';

export function productionConfig(value){
 const proxy=value?.trustedProxy;
 const proxyIp=typeof proxy==='string'?proxy.replace(/\/32$/,''):'';
 const privateProxy=net.isIP(proxyIp)===4&&(/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(proxyIp));
 if(value?.server!=='chapa-db'||value.database!=='JETTA_CONTROL_PILOTO_LOCAL'||value.publicOrigin!=='https://app.jettatransportes.com.br'||value.basePath!=='/chapa'||!privateProxy||value.sqlAuth?.user!=='JettaChapaRuntime'||typeof value.sqlAuth.password!=='string'||value.sqlAuth.password.length<24||/[\r\n\0]/.test(value.sqlAuth.password))throw Error('Configuração de produção inválida');
 const cfg=pilotConfig({...value,host:'127.0.0.1',finance:'REGISTRO_EXTERNO',pc01:true,pc02:true,pc03:true,pc04:true,pc05:true});
 return {...cfg,production:true,publicOrigin:value.publicOrigin,basePath:value.basePath,trustedProxy:proxy,trust:false,sqlAuth:{...value.sqlAuth},sqlRuntimePrincipal:'JettaChapaRuntime',cookieName:'__Secure-jetta_chapa_session',cookiePath:'/chapa',cookieSecure:true};
}
