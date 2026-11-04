(()=>{
 const panel=document.getElementById('pc03Panel');if(!panel)return;
 let enabled=false,current=false,epoch=0,busy=false,data=null,editing=null;
 const make=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;};
 const active=v=>v===true||v===1||v==='1';
 const formatDocument=value=>{
  const digits=String(value||'').replace(/\D/g,'').slice(0,14);
  const groups=digits.length<=11?[3,3,3,2]:[2,3,3,4,2],separators=digits.length<=11?['.','.','-']:['.','.','/','-'];
  let result='',offset=0;
  for(let i=0;i<groups.length&&offset<digits.length;i++){if(i)result+=separators[i-1];result+=digits.slice(offset,offset+groups[i]);offset+=groups[i];}
  return result;
 };
 function maskDocument(input){
  const value=input.value,caret=input.selectionStart,digitsBefore=value.slice(0,caret).replace(/\D/g,'').length;
  input.value=formatDocument(value);
  let position=0,count=0;while(position<input.value.length&&count<digitsBefore){if(/\d/.test(input.value[position]))count++;position++;}
  input.setSelectionRange(position,position);input.setCustomValidity('');
 }
 const message=make('p');message.role='status';
 const button=(label,action)=>{const b=make('button',label);b.type='button';if(action)b.addEventListener('click',action);return b;};
 const search=make('div');search.className='b24a-form';
 const searchLabel=make('label','Buscar por nome, CPF ou CNPJ'),textFilter=make('input');textFilter.type='search';searchLabel.append(textFilter);
 const situationLabel=make('label','Filtrar situação'),situationFilter=make('select');for(const [value,label]of [['','Todas as situações'],['1','Ativo'],['0','Inativo']]){const o=make('option',label);o.value=value;situationFilter.append(o);}situationLabel.append(situationFilter);
 const branchLabel=make('label','Filtrar depósito'),branchFilter=make('select');branchLabel.append(branchFilter);search.append(searchLabel,situationLabel,branchLabel);
 const count=make('p');count.role='status';
 const form=make('form');form.className='b24a-form';const fields={};
 for(const [key,label,max]of [['nome','Nome completo',160],['documento','CPF ou CNPJ',18],['telefone','Telefone (opcional)',25]]){const l=make('label',label),input=make('input');input.maxLength=max;input.required=['nome','documento'].includes(key);input.name=key;input.id='pc03_'+key;if(key!=='nome')input.inputMode=key==='documento'?'numeric':'tel';if(key==='documento'){input.pattern='[0-9.\\/\\-\\s]+';input.placeholder='11 dígitos para CPF ou 14 para CNPJ';input.addEventListener('input',()=>maskDocument(input));}l.append(input);fields[key]=input;form.append(l);}
 const statusLabel=make('label','Situação'),status=make('select');for(const [v,label]of [['1','Ativo'],['0','Inativo']]){const o=make('option',label);o.value=v;status.append(o);}statusLabel.append(status);statusLabel.hidden=true;form.append(statusLabel);
 const branchControl=make('div');branchControl.className='pc03-branch-control';
 const branchTitle=make('span','Depósitos do cadastro inicial');branchTitle.id='pc03_depositos_label';
 const branchTrigger=button('Selecione os depósitos');branchTrigger.className='pc03-branch-trigger secondary';branchTrigger.setAttribute('aria-labelledby',branchTitle.id);branchTrigger.setAttribute('aria-expanded','false');branchTrigger.setAttribute('popovertarget','pc03_depositos');
 const branches=make('fieldset'),legend=make('legend','Depósitos do cadastro inicial');branches.id='pc03_depositos';branches.append(legend);branchControl.append(branchTitle,branchTrigger,branches);form.append(branchControl);
 branches.addEventListener('beforetoggle',e=>{if(e.newState==='open')positionBranches();branchTrigger.setAttribute('aria-expanded',String(e.newState==='open'));});
 branches.addEventListener('change',updateBranchSummary);
 window.addEventListener('resize',()=>{if(branches.matches(':popover-open'))positionBranches();});
 window.addEventListener('scroll',()=>{if(branches.matches(':popover-open'))positionBranches();},true);
 const submit=button('Cadastrar prestador');submit.type='submit';const cancel=button('Cancelar edição',()=>reset());cancel.hidden=true;form.append(submit,cancel);
 const rows=make('div');rows.className='b24a-table';panel.append(form,message,search,count,rows);
 const errors={CPF_DUPLICADO:'CPF ou CNPJ já cadastrado. Use a busca para localizar o cadastro existente.',SOMENTE_ADM:'Somente ADM pode corrigir CPF/CNPJ ou alterar a situação.',PRESTADOR_FORA_ESCOPO:'Vincule o prestador a um depósito autorizado antes de editar.',DEPOSITOS_INVALIDAS:'Selecione ao menos um depósito.',NOME_COMPLETO_OBRIGATORIO:'Informe o nome completo.',REGISTRO_ALTERADO_ATUALIZE:'Outra pessoa alterou o cadastro. Atualize a busca antes de editar.',DEPOSITO_NAO_AUTORIZADA:'Depósito inativo ou fora do seu acesso.',MFA_RECENTE_OBRIGATORIO:'Confirme o MFA e tente novamente.',DOCUMENTO_INVALIDO:'Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos.',DOCUMENTO_UNICO_OBRIGATORIO:'Informe somente um CPF ou CNPJ.',CPF_INVALIDO:'Informe um CPF com 11 dígitos.',CNPJ_INVALIDO:'Informe um CNPJ com 14 dígitos.',PRESTADOR_INATIVO:'O prestador está inativo.',PRESTADORES_INDISPONIVEIS:'Não foi possível consultar ou salvar os prestadores.'};
 async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options}),b=await r.json().catch(()=>({}));if(!r.ok)throw Error(errors[b.erro]||b.erro||'Operação indisponível.');return b;}
 function closeBranches(){if(branches.matches(':popover-open'))branches.hidePopover();branchTrigger.setAttribute('aria-expanded','false');}
 function positionBranches(){
  const rect=branchTrigger.getBoundingClientRect(),gap=6,edge=8,below=window.innerHeight-rect.bottom-gap-edge,above=rect.top-gap-edge,useBelow=below>=160||below>=above;
  branches.style.width=Math.min(rect.width,window.innerWidth-2*edge)+'px';branches.style.left=Math.max(edge,Math.min(rect.left,window.innerWidth-rect.width-edge))+'px';
  branches.style.top=useBelow?rect.bottom+gap+'px':'auto';branches.style.bottom=useBelow?'auto':window.innerHeight-rect.top+gap+'px';branches.style.maxHeight=Math.max(0,Math.min(300,useBelow?below:above))+'px';
 }
 function updateBranchSummary(){
  const names=[...branches.querySelectorAll('input:checked')].map(c=>c.parentElement.textContent);
  branchTrigger.textContent=names.join(', ')||(branches.querySelector('input')?'Selecione os depósitos':'Nenhum depósito disponível');branchTrigger.title=names.join(', ');
 }
 function reset(){closeBranches();editing=null;form.reset();fields.documento.readOnly=false;fields.documento.setCustomValidity('');statusLabel.hidden=true;branches.hidden=false;cancel.hidden=true;submit.textContent='Cadastrar prestador';if(data)renderBranches();else{branches.replaceChildren(legend);updateBranchSummary();}}
 function renderBranches(){
  closeBranches();branchTitle.hidden=!!editing;branchTrigger.hidden=!!editing;
  if(editing){branches.removeAttribute('popover');branches.removeAttribute('style');}else branches.setAttribute('popover','auto');
  legend.textContent=editing?'Depósitos autorizados':'Depósitos do cadastro inicial';legend.hidden=!editing;branches.setAttribute('aria-label',legend.textContent);branches.replaceChildren(legend);
  for(const f of data.depositos){const linked=!!editing&&data.vinculos.some(v=>String(v.PrestadorId)===String(editing.PrestadorId)&&String(v.DepositoId)===String(f.DepositoId));if(!active(f.Ativo)&&!linked)continue;
   const l=make('label',f.Nome+(active(f.Ativo)?'':' (inativo)')),c=make('input');c.type='checkbox';c.name='deposito';c.value=String(f.DepositoId);c.checked=linked;l.prepend(c);branches.append(l);
  }
  branchTrigger.dataset.unavailable=String(!branches.querySelector('input'));branchTrigger.disabled=busy||branchTrigger.dataset.unavailable==='true';updateBranchSummary();
 }
 function lock(value){if(value)closeBranches();busy=value;panel.querySelectorAll('button,input,select').forEach(e=>e.disabled=value||e.dataset.unavailable==='true');}
 function render(rebuild=false){
  const selectedBranch=branchFilter.value;branchFilter.replaceChildren();const allBranches=make('option','Todos os depósitos');allBranches.value='';branchFilter.append(allBranches);for(const f of data.depositos){const o=make('option',f.Nome);o.value=String(f.DepositoId);branchFilter.append(o);}branchFilter.value=selectedBranch;

  if(rebuild)renderBranches();
  rows.replaceChildren();const table=make('table'),head=make('tr');for(const name of ['Nome','CPF ou CNPJ','Telefone','Situação','Depósitos autorizados','Ações'])head.append(make('th',name));table.append(head);
  const query=textFilter.value.trim().toLocaleLowerCase('pt-BR'),digits=query.replace(/\D/g,'');
  const filtered=data.registros.filter(row=>(!query||row.Nome.toLocaleLowerCase('pt-BR').includes(query)||(digits&&String(row.CPF).replace(/\D/g,'').includes(digits)))&&(!situationFilter.value||active(row.Ativo)===(situationFilter.value==='1'))&&(!branchFilter.value||data.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId)&&String(v.DepositoId)===branchFilter.value)));
  count.textContent=filtered.length?`${filtered.length} de ${data.registros.length} prestadores exibidos.`:'Nenhum prestador encontrado com os filtros selecionados.';
  for(const row of filtered){
   const tr=make('tr');for(const v of [row.Nome,formatDocument(row.CPF),row.Telefone||'—',active(row.Ativo)?'Ativo':'Inativo'])tr.append(make('td',String(v)));
   const linkedBranches=data.depositos.filter(f=>data.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId)&&String(v.DepositoId)===String(f.DepositoId)));
   const links=make('td',linkedBranches.map(f=>f.Nome).join(', ')||'Nenhum depósito vinculado');
   tr.append(links);const actions=make('td'),canEdit=data.adm||data.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId));
   if(canEdit)actions.append(button('Editar',()=>{if(busy)return;reset();editing=row;for(const k of ['nome','documento','telefone'])fields[k].value=row[({nome:'Nome',documento:'CPF',telefone:'Telefone'})[k]]||'';fields.documento.value=formatDocument(fields.documento.value);fields.documento.readOnly=!data.adm;status.value=active(row.Ativo)?'1':'0';statusLabel.hidden=!data.adm;renderBranches();cancel.hidden=false;submit.textContent='Salvar alterações';message.textContent='Edite os dados e selecione os depósitos autorizados. As alterações serão aplicadas ao salvar.';fields.nome.focus();}));tr.append(actions);table.append(tr);
  }rows.append(table);
 }
 async function load({after}={}){
  const revision=++epoch;lock(true);message.textContent='Consultando prestadores...';form.hidden=true;search.hidden=true;count.textContent='';rows.replaceChildren();
  try{const result=await api('/api/b24a/chapas');if(revision!==epoch||!current)return;data=result;reset();render(true);form.hidden=false;search.hidden=false;message.textContent=after||(!data.registros.length?'Nenhum prestador encontrado.':`${data.registros.length} prestadores encontrados.`);}
  catch(e){if(revision===epoch)message.textContent=e.message;}
  finally{if(revision===epoch)lock(false);}
 }
 async function write(url,body,method,success){
  if(busy)return;const revision=epoch;lock(true);message.textContent='Verificando autorização...';let saved=false;
  try{await window.jettaEnsureRecentMfa();if(revision!==epoch||!current)return;await api(url,{method,headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)});saved=true;if(revision!==epoch||!current)return;await load({after:success});}
  catch(e){if(revision===epoch)message.textContent=(saved?'Dados salvos, mas a lista não foi atualizada. ':'Operação recusada: ')+e.message;}
  finally{if(revision===epoch)lock(false);}
 }
 for(const input of [textFilter,situationFilter,branchFilter])input.addEventListener(input===textFilter?'input':'change',()=>{if(data&&!busy)render();});
 form.addEventListener('submit',e=>{e.preventDefault();const documentValue=fields.documento.value.trim(),digits=documentValue.replace(/\D/g,'');if(!/^[0-9.\/\-\s]+$/.test(documentValue)||![11,14].includes(digits.length)){fields.documento.setCustomValidity('Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos.');fields.documento.reportValidity();return;}fields.documento.setCustomValidity('');const body=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()]));body.depositos=[...branches.querySelectorAll('input:checked')].map(e=>Number(e.value));if(editing){body.ativo=status.value==='1';body.versao=Number(editing.Versao);}write('/api/b24a/chapas'+(editing?'/'+editing.PrestadorId:''),body,editing?'PUT':'POST',editing?'Alterações salvas. Histórico preservado.':'Prestador cadastrado.');});
 window.addEventListener('jetta:auth',e=>{enabled=e.detail?.pc03===true;epoch++;current=false;data=null;reset();textFilter.value='';situationFilter.value='';branchFilter.replaceChildren();count.textContent='';rows.replaceChildren();message.textContent='';panel.hidden=true;lock(false);});
 window.addEventListener('jetta:cadastro',e=>{
  const show=enabled&&e.detail==='chapas';current=show;panel.hidden=!show;
  if(show){document.getElementById('b24Title').textContent='Prestadores';document.getElementById('b24Message').textContent='';load();}
  else{epoch++;reset();rows.replaceChildren();data=null;lock(false);}
 });
})();
