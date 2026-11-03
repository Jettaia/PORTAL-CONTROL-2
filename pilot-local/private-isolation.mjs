import fs from 'node:fs';
import path from 'node:path';

export function assertPrivateIsolation(privateDir){
 for(const file of ['launcher/credential.xml','administrator.json']){
  let readable=false,descriptor;
  try{descriptor=fs.openSync(path.join(privateDir,file),'r');readable=true;}catch(error){if(!['EACCES','EPERM','ENOENT'].includes(error.code))throw error;}finally{if(descriptor!==undefined)fs.closeSync(descriptor);}
  if(readable)throw Error('ACL privada inválida: runtime acessa material administrativo');
 }
 let backupReadable=false;
 try{fs.readdirSync(path.join(privateDir,'backups'));backupReadable=true;}catch(error){if(!['EACCES','EPERM','ENOENT'].includes(error.code))throw error;}
 if(backupReadable)throw Error('ACL privada inválida: runtime acessa o diretório de backups');
}
