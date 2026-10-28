(()=>{
 const $=id=>document.getElementById(id);
 async function request(url,opts){const r=await (window.jettaProtectedFetch||fetch)(url,{credentials:'same-origin',...opts});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||`HTTP ${r.status}`);return j;}
 async function refresh(){try{const j=await request('/api/b25/usuarios-pendentes');const t=document.createElement('table');const h=document.createElement('tr');for(const x of ['ID','Nome','E-mail','Perfil-base','Estado']){const th=document.createElement('th');th.textContent=x;h.append(th);}t.append(h);for(const x of j.registros){const tr=document.createElement('tr');for(const v of [x.UsuarioId,x.Nome,x.Email,x.Perfil,'Pendente / Inativo']){const td=document.createElement('td');td.textContent=String(v??'');tr.append(td);}t.append(tr);}$('b25List').replaceChildren(t);$('b25Msg').textContent=`${j.registros.length} usuario(s) pendente(s)`;}catch(e){$('b25Msg').textContent=e.message;}}
 $('b25Form')?.addEventListener('submit',async e=>{e.preventDefault();try{await request('/api/b25/usuarios-pendentes',{method:'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify({nome:$('b25Nome').value,email:$('b25Email').value,perfil:$('b25Perfil').value})});$('b25Form').reset();await refresh();$('b25Msg').textContent='Usuario pendente cadastrado. Acesso ainda bloqueado.';}catch(x){$('b25Msg').textContent=x.message;}});
 $('b25Refresh')?.addEventListener('click',refresh);
 window.addEventListener('jetta:b24c',e=>{if(e.detail==='usuarios')refresh();});
})();
