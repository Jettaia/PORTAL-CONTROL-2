import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../public/',import.meta.url));
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function buildAssets(destination){
 fs.mkdirSync(destination,{recursive:true});
 const entries=fs.readdirSync(source,{withFileTypes:true});
 const names=entries.filter(e=>e.isFile()).map(e=>escape(e.name)).join('|');
 const absolute=new RegExp('([\'"`])/(api(?=/|[\'"`])|(?:'+names+')(?=[?#\'"`]))','g');
 for(const entry of entries){
  if(!entry.isFile())throw Error('Asset público em diretório exige revisão de prefixo');
  const from=path.join(source,entry.name),to=path.join(destination,entry.name);
  if(!/\.(?:js|css|html)$/.test(entry.name)){fs.copyFileSync(from,to);continue;}
  let text=fs.readFileSync(from,'utf8').replace(absolute,(_match,quote,resource)=>quote+'/chapa/'+resource);
  if(entry.name.endsWith('.html'))text=text.replace(/((?:href|src|action)=["'])\/(?!\/|chapa(?:\/|["']))/g,'$1/chapa/');
  if(entry.name.endsWith('.css'))text=text.replace(/(url\(\s*["']?)\/(?!\/|chapa\/)/g,'$1/chapa/');
  if(entry.name==='index.html')text=text.replaceAll('Ambiente local · Homologação','Produção · Portal Control').replaceAll('● Homologação','● Produção').replaceAll('Acesso local','Acesso seguro').replace('UX-01 Refinado v1.1.0 · Não liberado para produção','Gestão de serviços e prestadores').replace('</head>','<link rel="stylesheet" href="/chapa/production.css"></head>');
  fs.writeFileSync(to,text);
 }
 fs.writeFileSync(path.join(destination,'production.css'),'#showDiag,#diagBox{display:none!important}\n');
 return destination;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Informe o diretório de assets gerados');
 buildAssets(path.resolve(process.argv[2]));
}
