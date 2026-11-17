// Tablet administration: one record, displayed in every linked depot.
(()=>{
 const $=id=>document.getElementById(id),host=$('tabletsPage');if(!host)return;
 let account=window.jettaAccount,epoch=0,request=0,busy=false,editing=null,branches=[],records=[],timer,returnFocus;
 let query='',statusFilter='todos',depotFilter='';const groupState=new Map();
 const allowed=()=>!!account?.pc05&&[account.perfil,...(account.funcoes||[])].some(role=>['ADMIN','COORDENADOR','GESTOR'].includes(role));
 const canDelete=()=>[account?.perfil,...(account?.funcoes||[])].some(role=>['ADMIN','COORDENADOR'].includes(role));
 const visible=()=>allowed()&&!host.hidden;
 const text=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=value;return node;};
 const statuses={REVOGADO:'Revogado',SEM_DEPOSITO:'Sem depósito',BLOQUEADO:'Bloqueado',ATIVO:'Autorizado',PENDENTE:'Aguardando ativação',CODIGO_EXPIRADO:'Código expirado'};
 const errors={SOMENTE_ADM:'Somente Admin pode excluir tablets.',TABLET_NAO_REVOGADO:'Revogue o tablet antes de excluir.',TABLET_INDISPONIVEL:'Tablet indisponível. Atualize a consulta.',PERMISSAO_NEGADA:'Seu acesso não permite esta operação.',MFA_RECENTE_OBRIGATORIO:'Valide o MFA para continuar.',DEPOSITO_NAO_AUTORIZADO:'Selecione um depósito ativo autorizado.',DEPOSITO_INDISPONIVEL:'O depósito está indisponível. Atualize a consulta.',TABLET_NAO_ENCONTRADO:'Tablet indisponível. Atualize a consulta.',CAMPOS_INVALIDOS:'Confira o nome e o depósito informados.'};
 function action(label,handler){const node=text('button',label);node.type='button';node.onclick=handler;return node;}
 const badge=row=>{const node=text('span',statuses[row.Estado]||'Indisponível');node.className='tablets-status';node.dataset.state=row.Estado;return node;};
 const links=row=>row.Depositos?.length?row.Depositos:row.DepositoId?[{DepositoId:row.DepositoId,Nome:row.Deposito||'Depósito '+row.DepositoId,CentroCusto:row.CentroCusto}]:[];
 host.classList.add('tablets-grouped');
 const dialog=text('dialog');dialog.id='tabletsDialog';dialog.setAttribute('aria-labelledby','tabletsFormTitle');
 const head=text('header');head.className='tablets-dialog-head';const title=text('h2','Novo tablet');title.id='tabletsFormTitle';
 const oldTitle=$('tabletsFormTitle'),oldCard=oldTitle.closest('.tablets-card');oldTitle.remove();
 const closeButton=action('×',()=>closeEditor());closeButton.className='tablets-close';closeButton.setAttribute('aria-label','Fechar tablet');head.append(title,closeButton);
 const dialogMessage=text('p');dialogMessage.id='tabletsDialogMessage';dialogMessage.role='status';dialogMessage.setAttribute('aria-live','polite');
 const authorization=text('section');authorization.id='tabletsAuthorization';authorization.append(text('h3','Autorização do aparelho'));
 const authorizationStatus=text('p');authorizationStatus.id='tabletsAuthorizationStatus';
 const manageActions=text('div');manageActions.className='tablets-manage-actions';authorization.append(authorizationStatus,$('tabletsSecret'),manageActions);
 $('tabletsCancel').textContent='Cancelar';$('tabletsForm').querySelector('.tablets-actions').append($('tabletsCancel'),$('tabletsSave'));$('tabletsForm').querySelector('legend').textContent='Depósitos autorizados';
 dialog.append(head,$('tabletsForm'),dialogMessage,authorization);host.append(dialog);oldCard.remove();
 $('tabletsRows').classList.remove('tablets-scroll','tablets-card');
 const counts=text('div');counts.id='tabletsCounts';counts.setAttribute('aria-label','Resumo dos tablets');host.querySelector('.tablets-header h2').replaceWith(counts);
 const topActions=text('div');topActions.className='tablets-top-actions';const newButton=action('＋ Novo tablet',()=>{if(busy)return;clearSecret();reset();openDialog();});newButton.id='tabletsNew';
 topActions.append($('tabletsReload'),newButton);host.querySelector('.tablets-header').append(topActions);
 const tools=text('div');tools.className='tablets-tools';const tabs=text('div');tabs.className='tablets-status-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Filtrar situação dos tablets');
 for(const [key,label]of Object.entries({todos:'Todos',ativos:'Autorizados',pendentes:'Para ativar',revogados:'Revogados',indisponiveis:'Indisponíveis'})){const b=action(label,()=>{statusFilter=key;draw();});b.dataset.filter=key;tabs.append(b);}
 const filters=text('div');filters.className='tablets-filters';const search=text('input');search.type='search';search.id='tabletsSearch';search.placeholder='Buscar tablet…';search.setAttribute('aria-label','Buscar tablet');search.autocomplete='off';
 const depotSelect=text('select');depotSelect.id='tabletsDepotFilter';depotSelect.setAttribute('aria-label','Filtrar depósito');filters.append(search,depotSelect);tools.append(tabs,filters);$('tabletsRows').before(tools);
 search.oninput=()=>{query=search.value;draw();};depotSelect.onchange=()=>{depotFilter=depotSelect.value;draw();};
 function message(value){$('tabletsMessage').textContent=dialog.open?'':value;dialogMessage.textContent=dialog.open?value:'';}
 function clearSecret(){clearTimeout(timer);$('tabletsSecret').replaceChildren();$('tabletsSecret').hidden=true;}
 function closeEditor(force=false){if(busy&&!force)return;if(dialog.open)dialog.close();clearSecret();dialogMessage.textContent='';reset();if(!force){if(returnFocus?.isConnected)returnFocus.focus();else newButton.focus();}}
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});dialog.addEventListener('close',clearSecret);
 function openDialog(){if(!dialog.open){returnFocus=document.activeElement;dialog.showModal();}dialogMessage.textContent='';$('tabletsName').focus();}
 function reset(){editing=null;$('tabletsForm').reset();title.textContent='Novo tablet';$('tabletsSave').textContent='Cadastrar e gerar código';$('tabletsEditNotice').hidden=true;$('tabletsCancel').hidden=false;authorization.hidden=true;manageActions.replaceChildren();costCenter();}
 const selectedDepots=()=>Array.from($('tabletsDepot').querySelectorAll('input:checked'),o=>o.value);
 function costCenter(){const ids=selectedDepots();$('tabletsDepotCount').textContent=ids.length+' '+(ids.length===1?'depósito selecionado':'depósitos selecionados');$('tabletsCostCenter').textContent='Centros de custo: '+(branches.filter(d=>ids.includes(String(d.DepositoId))).map(d=>d.CentroCusto||'—').join(' · ')||'—');}
 function lock(value){busy=value;for(const control of host.querySelectorAll('button,input,select'))control.disabled=value||control.dataset.revoked==='true';$('tabletsSave').disabled=value||!branches.length;newButton.disabled=value||!branches.length;}
 async function api(url,body){const response=await(window.jettaProtectedFetch||fetch)(url,{credentials:'same-origin',cache:'no-store',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(errors[data.erro]||(response.status>=500?'Não foi possível consultar os tablets. Atualize a consulta.':'Não foi possível concluir a operação. Atualize a consulta.'));return data;}
 function edit(row){
  if(busy)return;clearSecret();reset();editing=String(row.TabletId);$('tabletsName').value=row.Nome;const ids=links(row).map(d=>String(d.DepositoId));for(const option of $('tabletsDepot').querySelectorAll('input'))option.checked=ids.includes(option.value);costCenter();title.textContent=row.Nome;$('tabletsSave').textContent='Salvar alterações';$('tabletsEditNotice').hidden=false;authorization.hidden=false;authorizationStatus.replaceChildren(badge(row));
  for(const [label,fn]of [['Gerar novo código',()=>write('/'+encodeURIComponent(row.TabletId)+'/pareamento',{},'Novo código gerado. A autorização anterior foi invalidada.')],['Revogar',()=>write('/'+encodeURIComponent(row.TabletId)+'/revogar',{},'Autorização revogada.')]]){const b=action(label,fn);b.setAttribute('aria-label',label+(label==='Gerar novo código'?' para ':' ')+row.Nome);if(label==='Revogar'){b.className='tablets-danger';b.disabled=row.Estado==='REVOGADO';b.dataset.revoked=String(row.Estado==='REVOGADO');}manageActions.append(b);}
  if(canDelete()){const b=action('Excluir tablet',()=>{if(busy||!visible())return;if(window.confirm('Excluir o tablet “'+row.Nome+'”? A autorização deste dispositivo será encerrada e ele será removido da lista. Os apontamentos registrados serão preservados.'))write('/'+encodeURIComponent(row.TabletId)+'/excluir',{},'Tablet excluído.');});b.className='tablets-delete';b.setAttribute('aria-label','Excluir '+row.Nome);manageActions.append(b);}
  openDialog();
 }
 function catalog(){const map=new Map(branches.map(d=>[String(d.DepositoId),d]));for(const row of records)for(const d of links(row))if(!map.has(String(d.DepositoId)))map.set(String(d.DepositoId),d);return [...map.values()].sort((a,b)=>String(a.Nome).localeCompare(String(b.Nome),'pt-BR'));}
 function matches(row){const needle=query.trim().toLocaleLowerCase('pt-BR');const rowLinks=links(row);const haystack=[row.Nome,...rowLinks.flatMap(d=>[d.Nome,d.CentroCusto])].join(' ').toLocaleLowerCase('pt-BR');return(!needle||haystack.includes(needle))&&(!depotFilter||(depotFilter==='none'?!rowLinks.length:rowLinks.some(d=>String(d.DepositoId)===depotFilter)))&&(statusFilter==='todos'||statusFilter==='ativos'&&row.Estado==='ATIVO'||statusFilter==='pendentes'&&['PENDENTE','CODIGO_EXPIRADO'].includes(row.Estado)||statusFilter==='revogados'&&row.Estado==='REVOGADO'||statusFilter==='indisponiveis'&&['BLOQUEADO','SEM_DEPOSITO'].includes(row.Estado));}
 function draw(){
  tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===statusFilter)));
  counts.replaceChildren(text('span',records.length+' tablets cadastrados'));for(const [label,state]of [['Autorizados','ATIVO'],['Para ativar','PENDENTE'],['Revogados','REVOGADO']]){const span=text('span',label+' '),number=records.filter(r=>state==='PENDENTE'?['PENDENTE','CODIGO_EXPIRADO'].includes(r.Estado):r.Estado===state).length;span.className='tablets-count '+state.toLowerCase();span.append(text('b',String(number)));counts.append(span);}
  const target=$('tabletsRows');target.replaceChildren();if(!records.length){target.append(text('p','Nenhum tablet cadastrado.'));return;}
  const filtered=records.filter(matches);if(!filtered.length){target.append(text('p','Nenhum tablet encontrado para os filtros informados.'));return;}
  const groups=catalog().map(d=>({key:String(d.DepositoId),name:d.Nome,cc:d.CentroCusto,rows:filtered.filter(r=>links(r).some(link=>String(link.DepositoId)===String(d.DepositoId)))}));
  const orphans=filtered.filter(r=>!links(r).length);if(orphans.length)groups.push({key:'none',name:'Sem depósito',rows:orphans});
  for(const group of groups){if(depotFilter&&group.key!==depotFilter)continue;if((query.trim()||statusFilter!=='todos')&&!group.rows.length)continue;
   const details=text('details');details.className='tablets-group';details.dataset.depotId=group.key;details.open=group.rows.length>0&&(groupState.get(group.key)??true);
   details.addEventListener('toggle',()=>{if(details.isConnected)groupState.set(group.key,details.open);});
   const summary=text('summary'),identity=text('div');identity.append(text('strong',group.name),text('small',group.cc||'Sem centro de custo'));
   const total=text('div');total.className='tablets-group-count';total.append(text('span',group.rows.filter(r=>r.Estado==='ATIVO').length+' autorizados'),text('b',String(group.rows.length)),text('span','tablets'),text('span','⌄'));summary.append(identity,total);details.append(summary);
   if(!group.rows.length)details.append(text('p','Nenhum tablet neste depósito.'));
   for(const row of group.rows){const entry=text('div');entry.className='tablets-group-row';entry.dataset.tabletId=String(row.TabletId);const identity=text('div');identity.append(text('strong',row.Nome));const other=links(row).filter(d=>String(d.DepositoId)!==group.key);identity.append(text('small',other.length?'Compartilhado com '+other.map(d=>d.Nome).join(' · '):group.key==='none'?'Vincule um depósito para autorizar este aparelho.':'Exclusivo deste depósito'));const state=text('div');state.append(badge(row));const manage=action('Gerenciar ↗',()=>edit(row));manage.setAttribute('aria-label','Gerenciar '+row.Nome+' em '+group.name);manage.disabled=busy;entry.append(identity,state,manage);details.append(entry);}
   target.append(details);
  }
 }
 function render(data){
  branches=data.depositos||[];records=data.registros||[];const options=$('tabletsDepot');options.replaceChildren();for(const d of branches){const label=text('label'),check=text('input');label.className='tablets-depot-option';check.type='checkbox';check.name='depositos';check.value=String(d.DepositoId);const caption=text('span',d.Nome);caption.append(text('small',d.CentroCusto||'Sem centro de custo'));label.append(check,caption);options.append(label);}
  depotSelect.replaceChildren(new Option('Todos os depósitos',''),...catalog().map(d=>new Option(d.Nome,String(d.DepositoId))));if(records.some(r=>!links(r).length))depotSelect.append(new Option('Sem depósito','none'));if([...depotSelect.options].some(o=>o.value===depotFilter))depotSelect.value=depotFilter;else depotFilter='';reset();draw();
 }
 async function load(){if(!visible())return;const revision=epoch,sequence=++request;message('Consultando tablets…');lock(true);try{const data=await api('/api/pc05/tablets');if(revision!==epoch||sequence!==request||!visible())return;render(data);message(branches.length?'':'Cadastre um depósito autorizado antes de cadastrar tablets.');return true;}catch(e){if(revision===epoch&&sequence===request&&visible()){records=[];counts.replaceChildren();$('tabletsRows').replaceChildren();closeEditor(true);message(e.message);}}finally{if(revision===epoch&&sequence===request)lock(false);}}
 async function write(suffix,body,success){
  if(busy||!visible())return;const manageId=editing,wasOpen=dialog.open;clearSecret();const revision=epoch;lock(true);message('Verificando autorização…');let saved=false;
  try{if(window.jettaEnsureRecentMfa)await window.jettaEnsureRecentMfa();if(revision!==epoch||!visible())return;const result=await api('/api/pc05/tablets'+suffix,body);saved=true;if(revision!==epoch||!visible())return;const refreshed=await load();if(revision!==epoch||!visible())return;
   const row=records.find(r=>String(r.TabletId)===String(result.tabletId??manageId));if(suffix.endsWith('/excluir'))closeEditor(true);else if(wasOpen&&refreshed&&row)edit(row);
   message(refreshed?success:'Operação salva. Não foi possível atualizar a lista; atualize a consulta antes de repetir.');
   if(result.pareamento&&!document.hidden&&dialog.open){const code=text('strong',result.pareamento);$('tabletsSecret').replaceChildren(text('span','Código de ativação'),code,text('p','Use em até 5 minutos no tablet, em /tablet.html. Este código será ocultado em 30 segundos.'));$('tabletsSecret').hidden=false;timer=setTimeout(clearSecret,30000);}
  }catch(e){if(revision===epoch&&visible())message((saved?'Operação salva. Atualize a consulta. ':'')+e.message);}finally{if(revision===epoch)lock(false);}
 }
 $('tabletsForm').onsubmit=e=>{e.preventDefault();const depositos=selectedDepots();if(!depositos.length){message('Selecione pelo menos um depósito.');$('tabletsDepot').querySelector('input')?.focus();return;}if(depositos.some(id=>!branches.some(d=>String(d.DepositoId)===id)))return;const body={nome:$('tabletsName').value.trim(),depositos};if(!body.nome)return;write(editing?'/'+encodeURIComponent(editing)+'/cadastro':'',body,editing?'Cadastro salvo. A autorização anterior foi invalidada; gere um novo código para ativar novamente.':'Tablet cadastrado. Use o código para ativar o navegador do tablet.');};
 $('tabletsDepot').onchange=costCenter;$('tabletsCancel').onclick=()=>closeEditor();$('tabletsReload').onclick=()=>{if(!busy){closeEditor(true);clearSecret();load();}};
 window.addEventListener('jetta:tablets',()=>{clearSecret();load();});window.addEventListener('jetta:auth',e=>{epoch++;request++;account=e.detail;busy=false;branches=[];records=[];query='';statusFilter='todos';depotFilter='';search.value='';groupState.clear();closeEditor(true);reset();$('tabletsRows').replaceChildren();$('tabletsDepot').replaceChildren();counts.replaceChildren();message('');if(!allowed())host.hidden=true;});
 new MutationObserver(()=>{if(host.hidden){epoch++;request++;busy=false;closeEditor(true);clearSecret();}}).observe(host,{attributes:true,attributeFilter:['hidden']});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearSecret();});
})();
