(()=>{
 const $=id=>document.getElementById(id),active=v=>v===true||Number(v)===1;
 const fields=[['nome','Nome'],['centroCusto','CentroCusto'],['rua','Rua'],['numero','Numero'],['bairro','Bairro'],['cidade','Cidade'],['estado','Estado'],['cep','CEP']];
 const ids={nome:'Nome',centroCusto:'CentroCusto',rua:'Rua',numero:'Numero',bairro:'Bairro',cidade:'Cidade',estado:'Estado',cep:'Cep'};
 const formatCep=value=>String(value??'').replace(/\D/g,'').slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2');
 const root=$('depositsPage'),dialog=$('b24cDepDialog'),form=$('b24cDepForm');
 let deposits=[],editing=null,busy=false,canEdit=false,epoch=0,readRevision=0,filter='todos';
 const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=String(text??'');if(cls)e.className=cls;return e;};
 function message(text){$('b24cDepMsg').textContent=dialog.open?'':text;$('b24cDepDialogMsg').textContent=dialog.open?text:'';}
 async function api(url,method,body){const r=await(window.jettaProtectedFetch||fetch)(url,{credentials:'same-origin',cache:'no-store',...(method?{method,headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)}:{})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.erro||`HTTP ${r.status}`);return d;}
 function reset(){editing=null;form.reset();$('b24cDepTitle').textContent='Novo depósito';$('b24cDepSave').textContent='Cadastrar depósito';$('b24cDepDialogMsg').textContent='';}
 function lock(value){busy=value;root.querySelectorAll('button,input,select,fieldset').forEach(c=>c.disabled=value);}
 function close(){if(busy)return;dialog.close();reset();message('');}
 function original(row){return {...Object.fromEntries(fields.map(([key,col])=>[key,row[col]||''])),ativo:active(row.Ativo)};}
 function edit(row){
  if(busy||!canEdit||root.hidden)return;reset();
  if(row){editing={id:String(row.DepositoId),original:original(row)};for(const [key,col]of fields)$('b24c'+ids[key]).value=key==='cep'?formatCep(row[col]):row[col]||'';$('b24cAtivo').value=String(active(row.Ativo));$('b24cDepTitle').textContent='Editar depósito';$('b24cDepSave').textContent='Salvar alterações';}
  message('');dialog.showModal();$('b24cNome').focus();
 }
 function render(){
  const countActive=deposits.filter(r=>active(r.Ativo)).length;
  $('b24cDepActive').textContent=String(countActive).padStart(2,'0');$('b24cDepInactive').textContent=String(deposits.length-countActive).padStart(2,'0');
  $('b24cDepCountAll').textContent=String(deposits.length);$('b24cDepCountActive').textContent=String(countActive);$('b24cDepCountInactive').textContent=String(deposits.length-countActive);
  $('b24cDepNew').hidden=!canEdit;
  root.querySelectorAll('[data-depot-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.depotFilter===filter)));
  const query=$('b24cDepSearch').value.trim().toLocaleLowerCase('pt-BR'),cards=document.createDocumentFragment();let count=0;
  for(const row of deposits){
   if(filter!=='todos'&&active(row.Ativo)!==(filter==='ativos'))continue;
   if(![row.Nome,row.CentroCusto,row.Cidade,row.Estado].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(query)))continue;
   count++;
   const card=node('article','','depot-card'+(active(row.Ativo)?'':' inactive'));
   const head=node('div','','depot-card-head');head.append(node('span',row.CentroCusto,'depot-cc'),node('span',active(row.Ativo)?'● Ativo':'● Inativo','depot-badge '+(active(row.Ativo)?'on':'off')));
   card.append(head,node('h2',row.Nome),node('p',[row.Cidade,row.Estado].filter(Boolean).join(' · '),'depot-city'));
   const address=node('div','','depot-address');address.append(node('div',[row.Rua,row.Numero].filter(Boolean).join(', ')),node('div',[row.Bairro,formatCep(row.CEP)].filter(Boolean).join(' · ')));card.append(address);
   if(canEdit){const b=node('button','Editar depósito','depot-card-edit');b.type='button';b.disabled=busy;const arrow=node('span','→');arrow.setAttribute('aria-hidden','true');b.append(arrow);b.addEventListener('click',()=>edit(row));card.append(b);}
   cards.append(card);
  }
  if(!count)cards.append(node('p','Nenhum depósito encontrado.','depot-empty'));
  $('b24cDepTable').replaceChildren(cards);
 }
 async function loadDeposits(){
  const revision=++readRevision,session=epoch;
  canEdit=false;deposits=[];render();message('Consultando depósitos…');
  try{
   const d=await api('/api/b24a/depositos');if(revision!==readRevision||session!==epoch||root.hidden)return false;
   deposits=d.registros;canEdit=d.podeEditar===true;render();message('');return true;
  }catch(e){if(revision===readRevision&&session===epoch&&!root.hidden){$('b24cDepTable').replaceChildren(node('p','Consulta indisponível.','depot-empty'));message(e.message);}return false;}
 }
 async function loadUsers(){try{const d=await api('/api/b24c/usuarios');const t=node('table',''),head=node('tr','');for(const label of ['Nome','E-mail','Perfil','Situação'])head.append(node('th',label));t.append(head);for(const row of d.registros){const tr=node('tr','');for(const value of [row.Nome,row.Email,row.Perfil,active(row.Ativo)?'Ativo':'Inativo'])tr.append(node('td',value));t.append(tr);}$('b24cUserTable').replaceChildren(t);$('b24cUserMsg').textContent=`${d.registros.length} usuários consultados`;}catch(e){$('b24cUserMsg').textContent=e.message;}}
 $('b24cCep').addEventListener('input',e=>{const input=e.target,before=input.value.slice(0,input.selectionStart).replace(/\D/g,'').length,formatted=formatCep(input.value);if(input.value!==formatted){input.value=formatted;const cursor=Math.min(before+(before>5?1:0),formatted.length);input.setSelectionRange(cursor,cursor);}});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!canEdit||!dialog.open||root.hidden)return;
  const revision=epoch,target=editing,body=Object.fromEntries(fields.map(([key])=>[key,$('b24c'+ids[key]).value.trim()]));body.estado=body.estado.toUpperCase();body.ativo=$('b24cAtivo').value==='true';if(target)body.original=target.original;
  if(!body.nome){$('b24cNome').focus();return;}
  lock(true);message('Salvando…');
  try{
   await api('/api/b24a/depositos'+(target?'/'+encodeURIComponent(target.id):''),target?'PUT':'POST',body);
   if(revision!==epoch||root.hidden)return;
   dialog.close();reset();if(!target){filter='todos';$('b24cDepSearch').value='';}
   if(await loadDeposits())message(target?'Depósito atualizado.':'Depósito cadastrado.');
  }catch(error){if(revision===epoch&&!root.hidden)message(error.message);}
  finally{if(revision===epoch){lock(false);render();}}
 });
 $('b24cDepNew').addEventListener('click',()=>edit());
 $('b24cDepCancel').addEventListener('click',close);$('b24cDepClose').addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('b24cDepSearch').addEventListener('input',render);
 root.querySelectorAll('[data-depot-filter]').forEach(b=>b.addEventListener('click',()=>{if(!busy){filter=b.dataset.depotFilter;render();}}));
 $('b24cDepReload').addEventListener('click',()=>{if(!busy)loadDeposits();});
 $('b24cReloadUsers').addEventListener('click',loadUsers);
 window.addEventListener('jetta:b24c',e=>{if(e.detail==='depositos'&&!busy)loadDeposits();if(e.detail==='usuarios')loadUsers();});
 function clear(){epoch++;readRevision++;lock(false);dialog.close();deposits=[];canEdit=false;filter='todos';$('b24cDepSearch').value='';reset();render();message('');}
 window.addEventListener('jetta:auth',clear);
 new MutationObserver(()=>{if(root.hidden)clear();}).observe(root,{attributes:true,attributeFilter:['hidden']});
})();