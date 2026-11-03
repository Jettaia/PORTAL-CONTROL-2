(async()=>{
 const readline=await import('node:readline/promises');const {stdin,stdout}=await import('node:process');
 const {configFromEnv}=await import('../src/config.js');const {bootstrapAdmin}=await import('../src/auth-db.js');
 const rl=readline.createInterface({input:stdin,output:stdout});
 try{
  console.log('Criacao inicial do ADMIN - apenas banco local autorizado.');
  const nome=(await rl.question('Nome completo: ')).trim();const email=(await rl.question('Email de login: ')).trim();
  // CLI readLine echoes password: recommend operator alone, then clear console history; no secrets in argv.
  const senha=await rl.question('Senha forte (sera exibida durante digitacao; execute em local privado): ');
  if(nome.length<3||!/^\S+@\S+\.\S+$/.test(email)||senha.length<6||senha.length>128)throw Error('Nome, email ou senha invalido: senha precisa ter 6-128 caracteres.');
  const id=await bootstrapAdmin(configFromEnv(),{name:nome,email,password:senha});console.log('ADMIN inicial criado. UsuarioId:',id);
 }catch(e){
  console.error('Nao criado:', e.message);
  if (Array.isArray(e.odbcErrors)) {
   for (const err of e.odbcErrors) {
    console.error('SQLSTATE:', err.state ?? 'N/D');
    console.error('Codigo:', err.code ?? 'N/D');
    console.error('Detalhe:', err.message ?? 'N/D');
   }
  }
  process.exitCode=1;
 }finally{rl.close();}
})();
