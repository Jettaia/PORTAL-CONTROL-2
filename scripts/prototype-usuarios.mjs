// THROWAWAY: existing portal shell, synthetic users, no API or production scripts.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
if(process.env.NODE_ENV==='production')throw Error('Protótipo disponível somente em desenvolvimento.');
const root=path.resolve('public');
const mime={'.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.html':'text/html'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{
  let body=await readFile(file);
  if(file===path.join(root,'index.html'))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</body>','<link rel="stylesheet" href="/usuarios.prototype.css"><script type="module" src="/usuarios.prototype.js"></script></body>');
  res.writeHead(200,{'Content-Type':(mime[path.extname(file)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('Não encontrado');}
}).listen(4321,'127.0.0.1',()=>console.log('Protótipo de usuários: http://localhost:4321/?variant=A'));
