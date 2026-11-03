(()=>{
 const $=id=>document.getElementById(id),panel=$('pc01PasswordPanel'),form=$('pc01PasswordForm');
 if(!panel||!form)return;
 let account=null,target=null,busy=false,epoch=0;
 const messages={SENHA_ATUAL_INVALIDA:'A senha atual está incorreta.',SENHA_ATUAL_INCORRETA:'A senha atual está incorreta.',SENHA_ATUAL_BLOQUEADA:'Muitas tentativas incorretas. Aguarde 15 minutos e tente novamente.',CONFIRMACAO_SENHA_INVALIDA:'As senhas não conferem.',SENHA_INVALIDA:'Use de 6 a 128 caracteres, com maiúscula, minúscula, número e símbolo.',MFA_RECENTE_OBRIGATORIO:'Valide o MFA de ação no painel de segurança e tente novamente.',CONTA_SEM_CREDENCIAL:'A conta precisa concluir a ativação pelo convite existente.',SESSAO_INVALIDA:'Entre novamente para alterar a senha.'};
 function clear(){
  target=null;form.reset();$('pc01CurrentPasswordRow').hidden=false;$('pc01CurrentPassword').required=true;
  $('pc01PasswordTitle').textContent='Alterar minha senha';$('pc01PasswordMsg').textContent='';
  panel.hidden=!account?.pc01||account.perfil==='ADMIN';
 }
 function wipe(){for(const input of form.querySelectorAll('input'))input.value='';}
 function disable(){for(const control of form.querySelectorAll('input,button'))control.disabled=busy;}
 window.addEventListener('jetta:password-reset',e=>{
  if(busy||!account?.pc01||account.perfil!=='ADMIN')return;
  clear();target=String(e.detail.id);$('pc01CurrentPasswordRow').hidden=true;$('pc01CurrentPassword').required=false;
  panel.hidden=false;
  $('pc01PasswordTitle').textContent='Alterar senha de '+e.detail.nome;
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!account?.pc01)return;
  if($('pc01NewPassword').value!==$('pc01ConfirmPassword').value){$('pc01PasswordMsg').textContent='As senhas não conferem.';$('pc01ConfirmPassword').focus();return;}
  const revision=epoch,id=target,self=!id||id===String(account.id);
  const body={senha:$('pc01NewPassword').value,confirmacao:$('pc01ConfirmPassword').value,...(!id?{senhaAtual:$('pc01CurrentPassword').value}:{})};
  busy=true;window.dispatchEvent(new CustomEvent('jetta:password-busy',{detail:true}));disable();$('pc01PasswordMsg').textContent='Alterando senha…';
  try{
   const response=await (window.jettaProtectedFetch||fetch)(id?'/api/pc01/usuarios/'+encodeURIComponent(id)+'/senha':'/api/pc01/minha-senha',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)});
   const data=await response.json();if(!response.ok)throw Error(messages[data.erro]||data.erro||'Não foi possível alterar a senha.');
   if(revision!==epoch)return;
   wipe();
   if(self){window.dispatchEvent(new Event('jetta:pc01-session-revoked'));$('loginMsg').textContent='Senha alterada. Entre novamente com a nova senha.';}
   else $('pc01PasswordMsg').textContent='Senha alterada. As sessões anteriores dessa conta foram encerradas.';
  }catch(error){if(revision===epoch)$('pc01PasswordMsg').textContent=error.message;}
  finally{if(revision===epoch)wipe();busy=false;window.dispatchEvent(new CustomEvent('jetta:password-busy',{detail:false}));disable();}
 });
 $('pc01PasswordCancel').onclick=()=>{if(!busy){wipe();$('pc01PasswordMsg').textContent='';}};
 window.addEventListener('jetta:account-edit-cleared',()=>{if(!busy)clear();});
 document.getElementById('mainNav')?.addEventListener('click',e=>{if(e.target.closest('[data-page]')&&!busy)clear();});
 window.addEventListener('jetta:auth',e=>{epoch++;account=e.detail;const admin=account?.perfil==='ADMIN';(admin?$('pc01AccountEditor'):$('pc01SelfPasswordHost')).append(panel);panel.classList.toggle('panel',!admin);clear();});
})();
