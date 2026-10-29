(()=>{
 const panel=document.getElementById('pc03Panel');if(!panel)return;
 let enabled=false,current=false,epoch=0,busy=false,data=null,editing=null,filter='';
 const make=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;};
 const active=v=>v===true||v===1||v==='1';
 const message=make('p');message.role='status';
 const search=make('form');search.className='b24a-form';
 const searchLabel=make('label','Buscar CPF em toda a empresa'),cpfSearch=make('input');cpfSearch.inputMode='numeric';cpfSearch.maxLength=14;cpfSearch.required=true;searchLabel.append(cpfSearch);
 const button=(label,action)=>{const b=make('button',label);b.type='button';if(action)b.addEventListener('click',action);return b;};
 const find=button('Buscar CPF');find.type='submit';const all=button('Listar minhas filiais',()=>load(''));search.append(searchLabel,find,all);
 const form=make('form');form.className='b24a-form';const fields={};
 for(const [key,label,max]of [['nome','Nome completo',160],['cpf','CPF',14],['telefone','Telefone (opcional)',25],['cnpj','CNPJ (opcional)',18]]){const l=make('label',label),input=make('input');input.maxLength=max;input.required=['nome','cpf'].includes(key);input.name=key;input.id='pc03_'+key;if(key!=='nome')input.inputMode='tel';l.append(input);fields[key]=input;form.append(l);}
 const statusLabel=make('label','Situação'),status=make('select');for(const [v,label]of [['1','Ativo'],['0','Inativo']]){const o=make('option',label);o.value=v;status.append(o);}statusLabel.append(status);statusLabel.hidden=true;form.append(statusLabel);
 const branches=make('fieldset'),legend=make('legend','Filiais do cadastro inicial');branches.append(legend);form.append(branches);
 const submit=button('Cadastrar prestador');submit.type='submit';const cancel=button('Cancelar edição',()=>reset());cancel.hidden=true;form.append(submit,cancel);
 const rows=make('div');rows.className='b24a-table';panel.append(search,form,message,rows);
 const errors={CPF_DUPLICADO:'CPF já cadastrado. Busque o CPF para vincular o cadastro existente.',SOMENTE_ADM:'Somente ADM pode corrigir CPF ou alterar a situação.',PRESTADOR_FORA_ESCOPO:'Vincule o prestador a uma filial autorizada antes de editar.',FILIAIS_INVALIDAS:'Selecione ao menos uma filial.',NOME_COMPLETO_OBRIGATORIO:'Informe o nome completo.',REGISTRO_ALTERADO_ATUALIZE:'Outra pessoa alterou o cadastro. Atualize a busca antes de editar.',FILIAL_NAO_AUTORIZADA:'Filial inativa ou fora do seu acesso.',MFA_RECENTE_OBRIGATORIO:'Confirme o MFA e tente novamente.',CPF_INVALIDO:'Informe um CPF com 11 dígitos.',CNPJ_INVALIDO:'Informe um CNPJ com 14 dígitos.',PRESTADOR_INATIVO:'O prestador está inativo.',PRESTADORES_INDISPONIVEIS:'Não foi possível consultar ou salvar os prestadores.'};
 async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options}),b=await r.json().catch(()=>({}));if(!r.ok)throw Error(errors[b.erro]||b.erro||'Operação indisponível.');return b;}
 function reset(){editing=null;form.reset();fields.cpf.readOnly=false;statusLabel.hidden=true;branches.hidden=false;cancel.hidden=true;submit.textContent='Cadastrar prestador';}
 function lock(value){busy=value;panel.querySelectorAll('button,input,select').forEach(e=>e.disabled=value||e.dataset.unavailable==='true');}
 function render(){
  branches.replaceChildren(legend);for(const f of data.filiais.filter(f=>active(f.Ativo))){const l=make('label',f.Nome),c=make('input');c.type='checkbox';c.name='filial';c.value=String(f.FilialId);l.prepend(c);branches.append(l);}
  rows.replaceChildren();const table=make('table'),head=make('tr');for(const name of ['Nome','CPF','Telefone','CNPJ','Situação','Filiais autorizadas','Ações'])head.append(make('th',name));table.append(head);
  for(const row of data.registros){
   const tr=make('tr');for(const v of [row.Nome,row.CPF,row.Telefone||'—',row.CNPJ||'—',active(row.Ativo)?'Ativo':'Inativo'])tr.append(make('td',String(v)));
   const links=make('td');for(const f of data.filiais){const linked=data.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId)&&String(v.FilialId)===String(f.FilialId));if(!linked&&!active(f.Ativo))continue;
    const b=button(`${linked?'Remover':'Vincular'} ${f.Nome}`,()=>write(`/api/b24a/chapas/${row.PrestadorId}/filiais/${f.FilialId}`,{vinculado:!linked},'PUT','Vínculo atualizado. Histórico preservado.'));b.dataset.unavailable=String(!linked&&!active(row.Ativo));b.disabled=b.dataset.unavailable==='true';links.append(b);
   }
   tr.append(links);const actions=make('td'),canEdit=data.adm||data.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId));
   if(canEdit)actions.append(button('Editar',()=>{if(busy)return;reset();editing=row;for(const k of ['nome','cpf','telefone','cnpj'])fields[k].value=row[({nome:'Nome',cpf:'CPF',telefone:'Telefone',cnpj:'CNPJ'})[k]]||'';fields.cpf.readOnly=!data.adm;status.value=active(row.Ativo)?'1':'0';statusLabel.hidden=!data.adm;branches.hidden=true;cancel.hidden=false;submit.textContent='Salvar alterações';message.textContent='Edite os dados comuns. As alterações ficam registradas.';fields.nome.focus();}));tr.append(actions);table.append(tr);
  }rows.append(table);
 }
 async function load(cpf,{after}={}){
  const revision=++epoch;filter=cpf;lock(true);message.textContent='Consultando prestadores...';form.hidden=true;rows.replaceChildren();
  try{const result=await api('/api/b24a/chapas'+(cpf?'?cpf='+encodeURIComponent(cpf):''));if(revision!==epoch||!current)return;data=result;reset();render();form.hidden=false;message.textContent=after||(!data.registros.length?'Nenhum prestador encontrado.':`${data.registros.length} prestadores encontrados.`);}
  catch(e){if(revision===epoch)message.textContent=e.message;}
  finally{if(revision===epoch)lock(false);}
 }
 async function write(url,body,method,success){
  if(busy)return;const revision=epoch;lock(true);message.textContent='Verificando autorização...';let saved=false;
  try{await window.jettaEnsureRecentMfa();if(revision!==epoch||!current)return;await api(url,{method,headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)});saved=true;if(revision!==epoch||!current)return;await load(body.cpf||filter,{after:success});}
  catch(e){if(revision===epoch)message.textContent=(saved?'Dados salvos, mas a lista não foi atualizada. ':'Operação recusada: ')+e.message;}
  finally{if(revision===epoch)lock(false);}
 }
 search.addEventListener('submit',e=>{e.preventDefault();if(!busy)load(cpfSearch.value.trim());});
 form.addEventListener('submit',e=>{e.preventDefault();const body=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()]));if(editing){body.ativo=status.value==='1';body.versao=Number(editing.Versao);}else body.filiais=[...branches.querySelectorAll('input:checked')].map(e=>Number(e.value));write('/api/b24a/chapas'+(editing?'/'+editing.PrestadorId:''),body,editing?'PUT':'POST',editing?'Alterações salvas. Histórico preservado.':'Prestador cadastrado.');});
 window.addEventListener('jetta:auth',e=>{enabled=e.detail?.pc03===true;epoch++;current=false;data=null;reset();rows.replaceChildren();message.textContent='';panel.hidden=true;lock(false);});
 window.addEventListener('jetta:cadastro',e=>{
  const show=enabled&&e.detail==='chapas';current=show;panel.hidden=!show;
  if(show){document.getElementById('b24Title').textContent='Prestadores';document.getElementById('b24Message').textContent='';load('');}
  else{epoch++;reset();rows.replaceChildren();data=null;lock(false);}
 });
})();
