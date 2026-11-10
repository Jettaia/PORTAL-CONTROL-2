// Standalone visual viewer. Never mounts the product API or connects to SQL.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const screens=['inicio','usuarios','depositos','servicos','chapas','contratacoes','pagamentos','extratoprestador'];
const context={id:0,nome:'Prévia visual',perfil:'ADMIN',funcoes:['ADMIN','GESTOR','FINANCEIRO'],pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true,pc08:false,pc10:false,pc11:false};
const banner='<aside id="previewNotice" style="position:sticky;top:0;z-index:9999;padding:12px 20px;background:#fff2d9;color:#583800;border-bottom:2px solid #ec8500;font:14px Arial,sans-serif"><strong>Prévia visual · sem banco e sem autenticação real.</strong> Listas vazias; operações não são gravadas. <a href="/tablet.html">Ver tela do tablet</a> · <a href="/?page=contratacoes">Ver portal</a><span id="previewFeedback" role="status"></span></aside>';
const client=`
const allowed=${JSON.stringify(screens)};
function preparePreview(){
 document.querySelectorAll('#mainNav [data-page]').forEach(n=>{if(!allowed.includes(n.dataset.page))n.remove();else if(n.dataset.page==='pagamentos')n.textContent='Pagamentos';});
 document.querySelectorAll('#mainNav details').forEach(n=>{if(!n.querySelector('[data-page]'))n.remove();});
 const mfa=document.getElementById('mfaB2B');if(mfa)mfa.hidden=true;
 const diag=document.getElementById('showDiag');if(diag)diag.hidden=true;
 const page=new URLSearchParams(location.search).get('page');
 window.dispatchEvent(new CustomEvent('jetta:go',{detail:allowed.includes(page)?page:'contratacoes'}));
}
window.addEventListener('jetta:auth',e=>{if(e.detail)setTimeout(preparePreview,0);});
document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();document.getElementById('previewFeedback').textContent=' Apenas visualização: nenhum dado foi enviado.';},true);
document.addEventListener('click',e=>{const b=e.target.closest('#mainNav [data-page]');if(b)history.replaceState(null,'','/?page='+encodeURIComponent(b.dataset.page));});
if(window.jettaAccount)preparePreview();
`;
export function createPreviewApp(){
 const app=express();app.disable('x-powered-by');
 app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/api',(req,res,next)=>['GET','HEAD'].includes(req.method)?next():res.status(405).json({erro:'PREVIA_SOMENTE_LEITURA'}));
 app.get('/api/auth/me',(_req,res)=>res.json({preview:true,usuario:context}));
 app.get('/api/pc01/usuarios',(_req,res)=>res.json({usuarios:[],depositos:[]}));
 app.get('/api/pc01/solicitacoes',(_req,res)=>res.json({solicitacoes:[]}));
 app.get(['/api/b24c/usuarios','/api/b25/usuarios-pendentes'],(_req,res)=>res.json({registros:[]}));
 app.get(['/api/b24a/depositos','/api/b24a/servicos','/api/b24a/chapas'],(_req,res)=>res.json({registros:[],depositos:[],vinculos:[],adm:true,pc02:true,pc03:true,podeEditar:true}));
 app.get('/api/pc04/catalogo',(_req,res)=>res.json({podeOperar:true,depositos:[],tipos:[],prestadores:[],gestores:[]}));
 app.get('/api/pc05/status',(_req,res)=>res.json({pc05:true}));
 app.get(['/api/pc04/contratacoes','/api/pc05/tablets','/api/financeiro/contratacoes'],(_req,res)=>res.json({registros:[],proximaPagina:null,podeOperar:true}));
 app.get(['/api/financeiro/catalogo','/api/financeiro/extrato/catalogo'],(_req,res)=>res.json({depositos:[],prestadores:[]}));
 app.get('/api/financeiro/extrato',(_req,res)=>res.json({prestadores:[],contratacoes:[],depositos:[],totalRegistros:0,proximaPagina:null,totais:{ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'}}));
 app.use('/api',(_req,res)=>res.status(503).json({erro:'PREVIA_SEM_BANCO: consulta indisponível'}));
 app.get('/preview-ui.js',(_req,res)=>res.type('js').send(client));
 app.get(['/', '/index.html','/tablet.html'],(req,res)=>{
  const tablet=req.path==='/tablet.html';
  let html=fs.readFileSync(path.join(root,tablet?'tablet-pc05.html':'index.html'),'utf8');
  html=html.replace(/<body([^>]*)>/i,(_match,attrs)=>'<body'+attrs+'>'+banner);
  if(!tablet){html=html.replace('<script defer src="/mfa-b2b.js"></script>','');html=html.replace('</body>','<script src="/preview-ui.js" defer></script></body>');}
  else{
   // Show both existing tablet layouts without issuing an authorization or token.
   html=html.replace('<script src="/tablet-pc05.js" defer></script>','');
   html=html.replace('<form id="pairForm" hidden>','<div style="padding:16px"><button type="button" onclick="document.getElementById(\'pairForm\').hidden=false;document.getElementById(\'operation\').hidden=true">Ver autorização</button> <button type="button" onclick="document.getElementById(\'pairForm\').hidden=true;document.getElementById(\'operation\').hidden=false">Ver teclado</button></div><form id="pairForm">');
   html=html.replace('Verificando autorização do tablet...','Prévia visual: nenhuma autorização ou token será processado.');
   html=html.replace('</body>','<script>document.addEventListener("submit",e=>{e.preventDefault();e.stopImmediatePropagation();document.getElementById("previewFeedback").textContent=" Apenas visualização: nenhum dado foi enviado.";},true);</script></body>');
  }
  res.type('html').send(html);
 });
 app.use(express.static(root,{dotfiles:'deny',index:false}));
 return app;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 createPreviewApp().listen(3212,'127.0.0.1',()=>console.log('Prévia visual: http://127.0.0.1:3212/?page=contratacoes — sem banco, listas vazias, gravações bloqueadas.'));
}
