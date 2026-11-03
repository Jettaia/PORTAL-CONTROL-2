(()=>{
 const $=id=>document.getElementById(id);
 const dialog=$('accessRequestDialog'),form=$('accessRequestForm');
 let sending=false,sent=false;
 $('accessRequestOpen')?.addEventListener('click',()=>{sent=false;form.reset();$('accessRequestMessage').textContent='';$('accessRequestSend').hidden=false;$('accessRequestCancel').textContent='Cancelar';dialog.showModal();});
 $('accessRequestCancel')?.addEventListener('click',()=>{if(!sending)dialog.close();});
 dialog?.addEventListener('cancel',e=>{if(sending)e.preventDefault();});
 form?.addEventListener('submit',async e=>{
  e.preventDefault();if(sending||sent)return;sending=true;
  for(const c of form.elements)c.disabled=true;$('accessRequestMessage').textContent='Enviando solicitação…';
  try{
   const response=await fetch('/api/acesso/solicitacoes',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify({nome:$('accessRequestName').value.trim(),email:$('accessRequestEmail').value.trim()})});
   if(!response.ok)throw Error();sent=true;form.reset();$('accessRequestMessage').textContent='Solicitação enviada. Aguarde a análise do administrador. Se já houver um cadastro ou pedido para esse e-mail, ele será mantido.';$('accessRequestSend').hidden=true;$('accessRequestCancel').textContent='Fechar';
  }catch{$('accessRequestMessage').textContent='Não foi possível enviar. Tente novamente.';}
  finally{sending=false;for(const c of form.elements)c.disabled=false;}
 });
 async function request(url,body){
  const response=await (window.jettaProtectedFetch||fetch)(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.erro||`HTTP ${response.status}`);
  return result;
 }
 $('b25bIssueForm')?.addEventListener('submit',async(event)=>{
  event.preventDefault();$('b25bIssueMsg').textContent='Solicitando convite...';$('b25bOneTime').value='';
  try{const result=await request('/api/b25b/convites',{usuarioId:$('b25bUid').value});$('b25bOneTime').value=result.token;$('b25bIssueMsg').textContent='Convite emitido: validade de 30 minutos. Copie o codigo agora: ele nao sera mostrado novamente.';}
  catch(error){$('b25bIssueMsg').textContent=error.message;}
 });
 $('b25bActivateForm')?.addEventListener('submit',async(event)=>{
  event.preventDefault(); const p=$('b25bPwd').value,confirm=$('b25bPwd2').value;
  if(p!==confirm){$('b25bActivationMsg').textContent='Senhas diferentes';return;}
  try{await request('/api/b25b/ativar',{token:$('b25bToken').value.trim(),senha:p});$('b25bActivationMsg').textContent='Conta ativada. Agora entre com seu e-mail e senha.';$('b25bActivateForm').reset();}
  catch(error){$('b25bActivationMsg').textContent=error.message;}
 });
})();
