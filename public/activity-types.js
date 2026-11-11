// Activity catalog: existing B24A API, isolated from the provider editor.
(()=>{
  const page=document.getElementById('cadastrosPage');if(!page)return;
  const root=document.createElement('section');root.id='activityTypes';root.hidden=true;
  root.innerHTML=`<div class="activity-toolbar"><span>Catálogo <b id="activityCount"></b></span><div><button id="activityReload" type="button">Atualizar</button><button id="activityNew" type="button">＋ Nova atividade</button></div></div>
    <p id="activityMessage" role="status" aria-live="polite"></p>
    <div class="activity-layout"><div class="activity-sidebar"><label class="activity-search">Buscar atividade<input id="activitySearch" type="search" placeholder="Buscar atividade…" autocomplete="off"></label><div id="activityFilters" role="group" aria-label="Filtrar situação"></div><div id="activityList" aria-label="Tipos de atividade"></div></div>
    <section class="activity-detail" aria-labelledby="activityHeading"><div class="activity-detail-head"><div><small>DETALHES DA ATIVIDADE</small><h2 id="activityHeading">Selecione uma atividade</h2></div><span id="activityBadge"></span></div>
    <form id="activityForm" hidden><label>Nome<input id="activityName" maxlength="120" required></label><label>Descrição <span class="activity-optional">opcional</span><textarea id="activityDescription" rows="3" maxlength="500"></textarea></label><label id="activityStatusLabel">Situação<select id="activityStatus"><option value="1">Ativo</option><option value="0">Inativo</option></select></label><div class="activity-actions"><button id="activityCancel" type="button">Cancelar</button><button id="activitySave" type="submit">Salvar alterações</button></div></form><div id="activityReadOnly"></div></section></div>`;
  page.append(root);
  const $=id=>document.getElementById(id),active=value=>value===true||Number(value)===1;
  let records=[],canEdit=false,selected=null,original=null,filter='todos',revision=0,saving=false,loaded=false;
  const message=text=>{$('activityMessage').textContent=text;};
  async function api(url,options={}){
    const response=await (window.jettaProtectedFetch||fetch)(url,{credentials:'same-origin',cache:'no-store',...options});
    const data=await response.json();if(!response.ok)throw Error(data.erro||`HTTP ${response.status}`);return data;
  }
  function renderList(){
    const buttons=document.createDocumentFragment();
    for(const key of ['todos','ativos','inativos']){
      const count=records.filter(r=>key==='todos'||active(r.Ativo)===(key==='ativos')).length;
      const button=document.createElement('button');button.type='button';button.dataset.activityFilter=key;
      button.textContent=`${{todos:'Todos',ativos:'Ativos',inativos:'Inativos'}[key]} ${count}`;
      button.setAttribute('aria-pressed',String(filter===key));button.disabled=saving||!loaded;
      button.onclick=()=>{filter=key;renderList();};buttons.append(button);
    }
    $('activityFilters').replaceChildren(buttons);
    const query=$('activitySearch').value.trim().toLocaleLowerCase('pt-BR'),list=document.createDocumentFragment();
    let count=0;
    records.forEach((row,index)=>{
      if(!row.Nome.toLocaleLowerCase('pt-BR').includes(query)||(filter!=='todos'&&active(row.Ativo)!==(filter==='ativos')))return;
      count++;
      const button=document.createElement('button');button.type='button';button.className=`activity-row ${index%2?'activity-orange':'activity-blue'}`;
      button.setAttribute('aria-pressed',String(String(selected)===String(row.TipoServicoId)));button.disabled=saving;
      const text=document.createElement('span'),name=document.createElement('strong'),status=document.createElement('small'),arrow=document.createElement('span');
      name.textContent=row.Nome;status.textContent=active(row.Ativo)?'Ativo':'Inativo';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
      text.append(name,status);button.append(text,arrow);button.onclick=()=>{select(row);renderList();};list.append(button);
    });
    if(!count){const empty=document.createElement('p');empty.className='activity-empty';empty.textContent=loaded?'Nenhuma atividade encontrada.':'Consultando atividades…';list.append(empty);}
    $('activityList').replaceChildren(list);$('activityCount').textContent=String(records.length);
  }
  function select(row,focus=false){
    selected=row?.TipoServicoId??null;
    original=row?{nome:row.Nome,descricao:row.Descricao||'',ativo:active(row.Ativo)}:null;
    $('activityHeading').textContent=row?row.Nome:(canEdit?'Nova atividade':'Selecione uma atividade');
    $('activityBadge').textContent=row?(active(row.Ativo)?'Ativo':'Inativo'):'';
    $('activityBadge').className=row?(active(row.Ativo)?'activity-badge active':'activity-badge'):'';
    $('activityName').value=row?.Nome||'';$('activityDescription').value=row?.Descricao||'';
    $('activityStatus').value=!row||active(row.Ativo)?'1':'0';$('activityStatusLabel').hidden=!row;
    $('activityForm').hidden=!canEdit;$('activitySave').textContent=row?'Salvar alterações':'Criar atividade';
    const readOnly=$('activityReadOnly');readOnly.hidden=canEdit;readOnly.replaceChildren();
    if(!canEdit&&row){const label=document.createElement('h3'),description=document.createElement('p');label.textContent='Descrição';description.textContent=row.Descricao||'Sem descrição';readOnly.append(label,description);}
    if(focus&&canEdit)$('activityName').focus();
  }
  function busy(value){
    saving=value;
    root.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=value);
  }
  async function load(preferred){
    const token=++revision;loaded=false;canEdit=false;records=[];
    $('activityNew').hidden=true;$('activityForm').hidden=true;$('activityReadOnly').replaceChildren();
    $('activityHeading').textContent='Consultando atividades…';$('activityBadge').textContent='';
    $('activitySearch').disabled=true;renderList();message('');
    try{
      const data=await api('/api/b24a/servicos');if(token!==revision||root.hidden)return false;
      records=[...data.registros].sort((a,b)=>a.Nome.localeCompare(b.Nome,'pt-BR')||String(a.TipoServicoId).localeCompare(String(b.TipoServicoId)));
      canEdit=data.podeEditar===true;loaded=true;$('activityNew').hidden=!canEdit;$('activitySearch').disabled=false;
      select(records.find(r=>String(r.TipoServicoId)===String(preferred))||records[0]);renderList();return true;
    }catch(error){if(token===revision&&!root.hidden){$('activityHeading').textContent='Consulta indisponível';$('activityList').textContent='Não foi possível carregar as atividades.';message(error.message);}return false;}
  }
  $('activitySearch').oninput=renderList;
  $('activityNew').onclick=()=>{if(saving||!canEdit)return;select(null,true);renderList();message('');};
  $('activityCancel').onclick=()=>{if(saving)return;select(records.find(r=>String(r.TipoServicoId)===String(selected))||records[0]);renderList();message('Alterações descartadas.');};
  $('activityReload').onclick=()=>{if(!saving)load(selected);};
  $('activityForm').onsubmit=async event=>{
    event.preventDefault();if(saving||!canEdit||!loaded||root.hidden)return;
    const name=$('activityName').value.trim();if(!name){$('activityName').focus();return;}
    const body={nome:name,descricao:$('activityDescription').value.trim()};
    const id=selected,token=revision;
    if(original){body.original={...original};body.ativo=$('activityStatus').value==='1';}
    busy(true);message('Salvando…');
    try{
      const result=await api('/api/b24a/servicos'+(id!=null?'/'+encodeURIComponent(id):''),{method:id!=null?'PUT':'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)});
      if(token!==revision||root.hidden)return;
      busy(false);
      if(id==null){$('activitySearch').value='';filter='todos';}
      if(await load(result.resultado?.TipoServicoId??id))message(id!=null?'Alterações salvas.':'Cadastro realizado.');
    }catch(error){if(token===revision&&!root.hidden)message(error.message);}
    finally{if(token===revision)busy(false);}
  };
  window.addEventListener('jetta:cadastro',event=>{
    const isActivity=event.detail==='servicos';page.classList.toggle('activity-mode',isActivity);root.hidden=!isActivity;
    if(isActivity){if(!saving){$('activitySearch').value='';filter='todos';load(selected);}}
    else{revision++;busy(false);}
  });
  window.addEventListener('jetta:auth',()=>{
    revision++;records=[];canEdit=loaded=false;selected=original=null;busy(false);root.hidden=true;page.classList.remove('activity-mode');
    $('activityForm').reset();$('activityReadOnly').replaceChildren();$('activityList').replaceChildren();message('');
  });
})();
