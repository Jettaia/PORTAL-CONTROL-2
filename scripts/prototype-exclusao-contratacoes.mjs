// Preview isolado: reaproveita o portal real; nenhum acesso a banco ou gravação.
import {createPreviewApp} from './preview-ui.mjs';
import express from 'express';
if(process.env.NODE_ENV==='production')throw Error('Preview disponível somente em desenvolvimento.');
const app=express();
app.use((req,res,next)=>{
 if(req.path==='/'||req.path==='/index.html'){
  const send=res.send.bind(res);
  res.send=body=>send(typeof body==='string'?body.replace('</head>','<script src="/contratacoes-exclusao.prototype.js"></script><link rel="stylesheet" href="/contratacoes-exclusao.prototype.css"></head>'):body);
 }
 next();
});
app.use(createPreviewApp());
app.listen(4323,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4323/?page=contratacoes'));
