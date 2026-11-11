(()=>{
 const panel=document.getElementById('pc03Panel');if(!panel)return;
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
 const active=v=>v===true||v===1||v==='1';
 const formatDocument=value=>{const digits=String(value||'').replace(/\D/g,'').slice(0,14),groups=digits.length<=11?[3,3,3,2]:[2,3,3,4,2],separators=digits.length<=11?['.','.','-']:['.','.','/','-'];let result='',offset=0;for(let i=0;i<groups.length&&offset<digits.length;i++){if(i)result+=separators[i-1];result+=digits.slice(offset,offset+groups[i]);offset+=groups[i];}return result;};
 function maskDocument(input){const caret=input.selectionStart,digitsBefore=input.value.slice(0,caret).replace(/\D/g,'').length;input.value=formatDocument(input.value);let position=0,count=0;while(position<input.value.length&&count<digitsBefore){if(/\d/.test(input.value[position]))count++;position++;}input.setSelectionRange(position,position);input.setCustomValidity('');}
 let enabled=false,current=false,epoch=0,busy=false,data=null,selected=null,filter='';
 panel.classList.add('pc03-ui');
 panel.innerHTML=`<div class="pc03-top"><button id="pc03Reload" type="button">Atualizar</button><button id="pc03New" type="button" hidden>＋ Novo prestador</button></div><p id="pc03Message" role="status" aria-live="polite"></p><div class="pc03-layout"><aside class="pc03-list"><select id="pc03DepotFilter" aria-label="Filtrar depósito"></select><input id="pc03Search" type="search" placeholder="Nome, CPF ou CNPJ…" aria-label="Buscar por nome, CPF ou CNPJ" autocomplete="off"><div id="pc03Filters" class="pc03-tabs" role="group" aria-label="Filtrar situação"></div><div id="pc03List"></div></aside><section id="pc03Edit" class="pc03-detail"><div class="pc03-heading"><h2>Cadastro</h2><span id="pc03Badge"></span></div><div id="pc03Editor"></div><div id="pc03ReadOnly"></div></section></div><dialog id="pc03NewDialog" aria-labelledby="pc03NewTitle"><div class="pc03-heading"><h2 id="pc03NewTitle">Novo prestador</h2><button type="button" id="pc03NewClose" aria-label="Fechar">×</button></div><p id="pc03NewMessage" role="status" aria-live="polite"></p><div id="pc03NewEditor"></div></dialog>`;
 const $=id=>document.getElementById(id),dialog=$('pc03NewDialog');
 const depotLabel=f=>[f.Nome,f.CentroCusto].filter(Boolean).join(' · ');
 const errors={CPF_DUPLICADO:'CPF ou CNPJ já cadastrado. Use a busca para localizar o cadastro existente.',SOMENTE_ADM:'Somente ADM pode corrigir CPF/CNPJ ou alterar a situação.',PRESTADOR_FORA_ESCOPO:'Vincule o prestador a um depósito autorizado antes de editar.',DEPOSITOS_INVALIDAS:'Selecione ao menos um depósito.',NOME_COMPLETO_OBRIGATORIO:'Informe o nome completo.',REGISTRO_ALTERADO_ATUALIZE:'Outra pessoa alterou o cadastro. Atualize a busca antes de editar.',DEPOSITO_NAO_AUTORIZADA:'Depósito inativo ou fora do seu acesso.',MFA_RECENTE_OBRIGATORIO:'Confirme o MFA e tente novamente.',DOCUMENTO_INVALIDO:'Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos.',DOCUMENTO_UNICO_OBRIGATORIO:'Informe somente um CPF ou CNPJ.',CPF_INVALIDO:'Informe um CPF com 11 dígitos.',CNPJ_INVALIDO:'Informe um CNPJ com 14 dígitos.',PRESTADOR_INATIVO:'O prestador está inativo.',PRESTADORES_INDISPONIVEIS:'Não foi possível consultar ou salvar os prestadores.'};
 async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options}),b=await r.json().catch(()=>({}));if(!r.ok)throw Error(errors[b.erro]||b.erro||'Operação indisponível.');return b;}
 function message(text,modal=false){$(modal?'pc03NewMessage':'pc03Message').textContent=text;}
 function canEdit(row){return data?.podeEditar!==false&&(data?.adm||data?.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId)));}
 function buildEditor(host,isNew){
  const form=make('form');form.className='pc03-form';const fields={};
  for(const [key,label,max]of [['nome','Nome completo',160],['documento','CPF ou CNPJ',18],['telefone','Telefone (opcional)',25]]){const l=make('label',label),input=make('input');input.name=key;input.id=(isNew?'pc03_new_':'pc03_')+key;input.maxLength=max;input.required=key!=='telefone';if(key!=='nome')input.inputMode=key==='documento'?'numeric':'tel';if(key==='documento'){input.pattern='[0-9.\\/\\-\\s]+';input.addEventListener('input',()=>maskDocument(input));}l.append(input);form.append(l);fields[key]=input;}
  const branches=make('fieldset'),legend=make('legend','Depósitos'),options=make('div',undefined,'pc03-branches');branches.append(legend,options);form.append(branches);
  const statusLabel=make('label','Situação'),status=make('select');status.append(new Option('Ativo','1'),new Option('Inativo','0'));statusLabel.className='pc03-status';statusLabel.append(status);form.append(statusLabel);
  const actions=make('div',undefined,'pc03-actions'),cancel=make('button',isNew?'Cancelar':'Cancelar edição'),submit=make('button',isNew?'Cadastrar prestador':'Salvar alterações');cancel.type='button';submit.type='submit';submit.className='pc03-primary';actions.append(cancel,submit);form.append(actions);host.append(form);
  let editing=null;
  function populate(row){editing=row?{...row}:null;form.reset();fields.documento.setCustomValidity('');for(const [key,col]of [['nome','Nome'],['documento','CPF'],['telefone','Telefone']])fields[key].value=row?.[col]||'';fields.documento.value=formatDocument(fields.documento.value);fields.documento.readOnly=!!row&&!data?.adm;statusLabel.hidden=!row||!data?.adm;status.value=active(row?.Ativo)?'1':'0';
   options.replaceChildren();for(const f of data?.depositos||[]){const linked=!!row&&data.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId)&&String(v.DepositoId)===String(f.DepositoId));if(!active(f.Ativo)&&!linked)continue;const label=make('label'),check=make('input'),text=make('span');check.type='checkbox';check.name='deposito';check.value=String(f.DepositoId);check.checked=linked;text.append(make('span',f.Nome+(active(f.Ativo)?'':' (inativo)')),make('small',f.CentroCusto||'—'));label.append(check,text);options.append(label);}
   if(!options.childElementCount)options.append(make('p','Nenhum depósito disponível.','pc03-empty'));form.hidden=!isNew&&!row;
  }
  cancel.onclick=()=>{if(busy)return;if(isNew){dialog.close();populate(null);message('',true);}else{populate(data?.registros.find(r=>String(r.PrestadorId)===String(selected)));message('');}};
  form.onsubmit=event=>{event.preventDefault();if(busy||!current||data?.podeEditar===false||isNew&&!dialog.open||!isNew&&!editing)return;
   const doc=fields.documento.value.trim(),digits=doc.replace(/\D/g,'');if(!/^[0-9.\/\-\s]+$/.test(doc)||![11,14].includes(digits.length)){fields.documento.setCustomValidity('Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos.');fields.documento.reportValidity();return;}
   fields.documento.setCustomValidity('');const body=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value.trim()]));body.depositos=[...options.querySelectorAll('input:checked')].map(e=>Number(e.value));if(!isNew){body.ativo=status.value==='1';body.versao=Number(editing.Versao);}save(body,isNew?null:editing,isNew);
  };
  return {form,populate,fields};
 }
 const inline=buildEditor($('pc03Editor'),false),creation=buildEditor($('pc03NewEditor'),true);
 function lock(value){busy=value;panel.querySelectorAll('button,input,select').forEach(e=>e.disabled=value);}
 function select(row){selected=row?.PrestadorId??null;$('pc03Badge').textContent=row?(active(row.Ativo)?'● Ativo':'● Inativo'):'';$('pc03Badge').className=row?'pc03-badge '+(active(row.Ativo)?'on':'off'):'';
  const editable=!!row&&canEdit(row);inline.populate(editable?row:null);inline.form.hidden=!editable;const readOnly=$('pc03ReadOnly');readOnly.replaceChildren();readOnly.hidden=editable;
  if(row&&!editable){readOnly.append(make('h3',row.Nome),make('p',formatDocument(row.CPF)),make('p',row.Telefone||'—'));for(const f of data.depositos.filter(f=>data.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId)&&String(v.DepositoId)===String(f.DepositoId))))readOnly.append(make('p',depotLabel(f)));}
  else if(!row)readOnly.append(make('p','Selecione um prestador.','pc03-empty'));
 }
 function renderList(){
  const records=data?.registros||[],tabs=document.createDocumentFragment();for(const [value,label]of [['','Todos'],['1','Ativos'],['0','Inativos']]){const b=make('button',label+' '+records.filter(r=>!value||active(r.Ativo)===(value==='1')).length);b.type='button';b.dataset.pc03Status=value;b.setAttribute('aria-pressed',String(filter===value));b.disabled=busy;b.onclick=()=>{filter=value;renderList();};tabs.append(b);}$('pc03Filters').replaceChildren(tabs);
  const q=$('pc03Search').value.trim().toLocaleLowerCase('pt-BR'),digits=q.replace(/\D/g,''),branch=$('pc03DepotFilter').value,rows=document.createDocumentFragment();let count=0;
  records.forEach((row,index)=>{if(q&&!row.Nome.toLocaleLowerCase('pt-BR').includes(q)&&!(digits&&String(row.CPF).replace(/\D/g,'').includes(digits)))return;if(filter&&active(row.Ativo)!==(filter==='1'))return;if(branch&&!data.vinculos.some(v=>String(v.PrestadorId)===String(row.PrestadorId)&&String(v.DepositoId)===branch))return;
   count++;const b=make('button',undefined,'pc03-row '+(index%2?'orange':'blue')),text=make('span'),dot=make('span',undefined,'pc03-dot '+(active(row.Ativo)?'on':'off'));b.type='button';b.disabled=busy;b.setAttribute('aria-pressed',String(String(selected)===String(row.PrestadorId)));text.append(make('strong',row.Nome),make('small',formatDocument(row.CPF)));dot.setAttribute('aria-label',active(row.Ativo)?'Ativo':'Inativo');b.append(text,dot);b.onclick=()=>{if(busy)return;select(row);renderList();message('');};rows.append(b);
  });if(!count)rows.append(make('p','Nenhum prestador encontrado.','pc03-empty'));$('pc03List').replaceChildren(rows);
 }
 function render(preferred){const old=$('pc03DepotFilter').value;$('pc03DepotFilter').replaceChildren(new Option('Todos os depósitos',''));for(const f of data.depositos)$('pc03DepotFilter').append(new Option(depotLabel(f),String(f.DepositoId)));$('pc03DepotFilter').value=old;
  $('pc03New').hidden=data.podeEditar===false;select(data.registros.find(r=>String(r.PrestadorId)===String(preferred??selected))||data.registros[0]);renderList();}
 async function load({after='',preferred}={}){const token=++epoch;lock(true);message('Consultando prestadores…');$('pc03New').hidden=true;data=null;inline.form.hidden=true;$('pc03ReadOnly').replaceChildren();$('pc03List').replaceChildren();
  try{const result=await api('/api/b24a/chapas');if(token!==epoch||!current)return;data=result;render(preferred);message(after||(!data.registros.length?'Nenhum prestador encontrado.':''));}
  catch(error){if(token===epoch&&current){message(error.message);$('pc03List').replaceChildren(make('p','Consulta indisponível.','pc03-empty'));}}
  finally{if(token===epoch)lock(false);}
 }
 async function save(body,row,isNew){if(busy)return;const token=epoch;lock(true);message('Verificando autorização…',isNew);let saved=false;
  try{await window.jettaEnsureRecentMfa();if(token!==epoch||!current)return;const result=await api('/api/b24a/chapas'+(row?'/'+encodeURIComponent(row.PrestadorId):''),{method:row?'PUT':'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)});saved=true;if(token!==epoch||!current)return;
   if(isNew){dialog.close();creation.populate(null);$('pc03Search').value='';$('pc03DepotFilter').value='';filter='';}await load({after:row?'Alterações salvas.':'Prestador cadastrado.',preferred:result.resultado?.PrestadorId??row?.PrestadorId});
  }catch(error){if(token===epoch&&current)message((saved?'Dados salvos, mas a lista não foi atualizada. ':'Operação recusada: ')+error.message,isNew);}
  finally{if(token===epoch)lock(false);}
 }
 $('pc03New').onclick=()=>{if(busy||!data||data.podeEditar===false)return;creation.populate(null);message('',true);dialog.showModal();creation.fields.nome.focus();};
 $('pc03NewClose').onclick=()=>{if(!busy){dialog.close();creation.populate(null);message('',true);}};dialog.addEventListener('cancel',event=>{event.preventDefault();$('pc03NewClose').click();});
 $('pc03Reload').onclick=()=>{if(!busy)load();};$('pc03Search').oninput=()=>{if(data&&!busy)renderList();};$('pc03DepotFilter').onchange=()=>{if(data&&!busy)renderList();};
 function clear(){epoch++;current=false;data=null;selected=null;filter='';dialog.close();inline.populate(null);creation.populate(null);$('pc03ReadOnly').replaceChildren();$('pc03List').replaceChildren();$('pc03Filters').replaceChildren();$('pc03Search').value='';$('pc03DepotFilter').replaceChildren();$('pc03New').hidden=true;$('pc03Badge').textContent='';message('');message('',true);lock(false);}
 const host=document.getElementById('cadastrosPage');
 window.addEventListener('jetta:auth',event=>{enabled=event.detail?.pc03===true;clear();panel.hidden=true;host?.classList.remove('provider-mode');});
 window.addEventListener('jetta:cadastro',event=>{const show=enabled&&event.detail==='chapas';if(!show)clear();current=show;panel.hidden=!show;host?.classList.toggle('provider-mode',show);if(show){const m=document.getElementById('b24Message');if(m)m.textContent='';load();}});
 if(host)new MutationObserver(()=>{if(host.hidden){clear();panel.hidden=true;host.classList.remove('provider-mode');}}).observe(host,{attributes:true,attributeFilter:['hidden']});
})();