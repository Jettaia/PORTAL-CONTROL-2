import express from 'express';
import rateLimit from 'express-rate-limit';
// Bound large body allocations across application instances in this process.
let busy=false;
export function receiptUploadBody({sameOrigin,session,authorize}){
 return [rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-7',legacyHeaders:false}),
  (req,res,next)=>sameOrigin(req,res,()=>session(req,res,async()=>{
   try{
    await authorize(req);
    if(req.destroyed||res.destroyed)return;
    if(busy)return res.status(409).json({erro:'IMPORTACAO_OCUPADA'});
    busy=true;let released=false;
    const release=()=>{if(!released){released=true;busy=false;}};
    res.once('finish',release);res.once('close',release);req.once('aborted',release);
    next();
   }catch(error){res.status(error.status||503).json({erro:error.status?error.message:'PAGAMENTO_INDISPONIVEL'});}
  })),express.json({limit:'70mb'})];
}
