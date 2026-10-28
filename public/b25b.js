(()=>{
 const $=id=>document.getElementById(id);
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
