export function normalizeUser(body){
 const nome=String(body?.nome??'').trim();const email=String(body?.email??'').trim().toLowerCase();const perfil=String(body?.perfil??'').trim().toUpperCase();
 if(nome.length<3||nome.length>150)throw Error('Nome invalido');
 if(email.length>256||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Email invalido');
 if(!['GESTOR','FINANCEIRO','DIRETORIA','ADMIN'].includes(perfil))throw Error('Perfil base invalido');
 return{nome,email,perfil};
}
