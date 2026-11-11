// THROWAWAY: Which structure best suits activity types? Three variants on the existing portal route.
// Synthetic records; edits live in memory. This file is loaded only by the dedicated prototype host.
const $ = s => document.querySelector(s);
const icons = {
  plus:'M12 5v14M5 12h14', search:'m21 21-5-5M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  box:'m3 7 9-5 9 5v10l-9 5-9-5ZM3 7l9 5 9-5M12 12v10', arrow:'M5 12h14m-6-6 6 6-6 6',
  edit:'m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5', close:'m6 6 12 12M6 18 18 6', menu:'M4 6h16M4 12h16M4 18h16',
  truck:'M3 5h12v12H3ZM15 10h4l3 4v3h-7M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0M21 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  layers:'m3 7 9-5 9 5-9 5ZM3 12l9 5 9-5M3 17l9 5 9-5', check:'m5 12 4 4L19 6'
};
const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(icons[n]||icons.box).split('Z!').map(d=>`<path d="${d}"/>`).join('')}</svg>`;
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows = [
  {id:1,nome:'Carga',descricao:'Carregamento de mercadorias no veículo.',ativo:true,icon:'box'},
  {id:2,nome:'Descarga',descricao:'Retirada e movimentação de mercadorias.',ativo:true,icon:'truck'},
  {id:3,nome:'Carga e descarga',descricao:'Operação completa de movimentação.',ativo:true,icon:'layers'},
  {id:4,nome:'Conferência',descricao:'Conferência de volumes e mercadorias.',ativo:true,icon:'check'},
  {id:5,nome:'Paletização',descricao:'Organização de mercadorias em paletes.',ativo:true,icon:'layers'},
  {id:6,nome:'Separação',descricao:'Separação de itens para expedição.',ativo:false,icon:'box'}
];
const variants = {A:'Tabela essencial',B:'Catálogo visual',C:'Lista + detalhe'};
let variant = new URLSearchParams(location.search).get('variant') || 'A';
if(!variants[variant]) variant='A';
let query='',filter='todos',selected=1;
$('#loginBox').hidden=true; $('#dashboard').hidden=true;
document.querySelectorAll('.view-section,.account-actions').forEach(e=>e.hidden=true);
const host=$('#cadastrosPage');host.hidden=false;host.className='view-section ap';
$('main').append(host);
$('#breadcrumb').textContent='Cadastros / Tipos de atividade';$('#pageHeading').textContent='Tipos de atividade';$('#pageDescription').textContent='';
$('#topUser').textContent='Prévia de design';$('.environment').textContent='● Protótipo';
document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('selected',b.dataset.page==='servicos');b.addEventListener('click',()=>toast('Prévia focada em tipos de atividade'));});
document.querySelectorAll('[data-ico]').forEach(e=>e.innerHTML=ico(e.dataset.ico));
$('#toggleSide').onclick=()=>$('#sidebar').classList.toggle('collapsed');
const switcher=document.createElement('div');switcher.className='ap-switch';switcher.setAttribute('aria-label','Variações do protótipo');
document.body.append(switcher);
const dialog=document.createElement('dialog');dialog.className='ap-dialog ap';document.body.append(dialog);
const state=document.createElement('details');state.className='ap-state';state.innerHTML='<summary>Estado da prévia · dados fictícios</summary><pre></pre>';host.after(state);
const notice=document.createElement('div');notice.className='ap-toast';notice.setAttribute('role','status');document.body.append(notice);
let timer;
function toast(text){notice.textContent=text;notice.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>notice.classList.remove('visible'),2600);}
const badge = r=>`<span class="ap-badge ${r.ativo?'on':'off'}"><i></i>${r.ativo?'Ativo':'Inativo'}</span>`;
function fields(row){return `<label>Nome<input name="nome" required maxlength="100" value="${esc(row?.nome||'')}" placeholder="Ex.: Carga"></label><label>Descrição <span class="ap-optional">opcional</span><textarea name="descricao" rows="3" maxlength="500" placeholder="Uma descrição breve">${esc(row?.descricao||'')}</textarea></label><label>Situação<select name="ativo"><option value="1" ${row?.ativo!==false?'selected':''}>Ativo</option><option value="0" ${row?.ativo===false?'selected':''}>Inativo</option></select></label>`;}
function wireForm(form,row,done){form.onsubmit=e=>{e.preventDefault();const data=new FormData(form);const value={nome:data.get('nome').trim(),descricao:data.get('descricao').trim(),ativo:data.get('ativo')==='1'};if(!value.nome)return;if(row)Object.assign(row,value);else{const item={id:Math.max(...rows.map(r=>r.id))+1,icon:'box',...value};rows.push(item);selected=item.id;}done?.();render();toast('Salvo nesta prévia');};}
function edit(id){const row=rows.find(r=>r.id===id);dialog.classList.toggle('drawer',variant==='A');dialog.innerHTML=`<div class="ap-editor-head"><div><span class="ap-eyebrow">TIPO DE ATIVIDADE</span><h2>${row?'Editar atividade':'Nova atividade'}</h2></div><button class="ap-icon" type="button" aria-label="Fechar">${ico('close')}</button></div><form>${fields(row)}<div class="ap-form-actions"><button type="button" class="ap-secondary" data-cancel>Cancelar</button><button class="ap-primary" type="submit">${row?'Salvar alterações':'Criar atividade'}</button></div></form>`;dialog.querySelector('.ap-icon').onclick=()=>dialog.close();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();wireForm(dialog.querySelector('form'),row,()=>dialog.close());dialog.showModal();}
function render(){
  const list=rows.filter(r=>r.nome.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))&&(filter==='todos'||r.ativo===(filter==='ativos')));
  const counts={todos:rows.length,ativos:rows.filter(r=>r.ativo).length,inativos:rows.filter(r=>!r.ativo).length};
  const tabs=`<div class="ap-tabs" role="group" aria-label="Filtrar situação">${['todos','ativos','inativos'].map(f=>`<button type="button" data-filter="${f}" aria-pressed="${f===filter}">${{todos:'Todos',ativos:'Ativos',inativos:'Inativos'}[f]} <span>${counts[f]}</span></button>`).join('')}</div>`;
  const search=`<div class="ap-search">${ico('search')}<input aria-label="Buscar atividade" placeholder="Buscar atividade…" value="${esc(query)}"></div>`;
  const newButton=`<button class="ap-primary" data-new>${ico('plus')} Nova atividade</button>`;
  const blank='<div class="ap-empty">Nenhuma atividade encontrada.</div>';
  host.dataset.variant=variant;
  if(variant==='A')host.innerHTML=`<div class="ap-top"><div class="ap-section-caption">${ico('layers')}<span>Catálogo de atividades <b>${rows.length}</b></span></div>${newButton}</div><div class="ap-surface"><div class="ap-tools">${tabs}${search}</div><div class="ap-table-wrap"><table><thead><tr><th>Atividade</th><th>Descrição</th><th>Situação</th><th><span class="ap-sr">Ações</span></th></tr></thead><tbody>${list.map(r=>`<tr><td><div class="ap-name"><span class="ap-symbol">${ico(r.icon)}</span><strong>${esc(r.nome)}</strong></div></td><td class="ap-description">${esc(r.descricao||'—')}</td><td>${badge(r)}</td><td><button class="ap-icon" data-edit="${r.id}" aria-label="Editar ${esc(r.nome)}">${ico('edit')}</button></td></tr>`).join('')}</tbody></table>${list.length?'':blank}</div><div class="ap-foot">${list.length} atividades</div></div>`;
  if(variant==='B')host.innerHTML=`<div class="ap-catalog-hero"><div><span class="ap-eyebrow">CATÁLOGO OPERACIONAL</span><h2>Cada atividade.<br><em>Um cadastro simples.</em></h2><div class="ap-hero-count"><b>${String(counts.ativos).padStart(2,'0')}</b> ativas <span></span><b>${String(counts.inativos).padStart(2,'0')}</b> inativas</div></div>${newButton}</div><div class="ap-tools catalog-tools">${tabs}${search}</div><div class="ap-cards">${list.map(r=>`<button class="ap-card ${r.ativo?'':'inactive'}" data-edit="${r.id}"><div class="ap-card-top"><span class="ap-symbol">${ico(r.icon)}</span>${badge(r)}</div><h3>${esc(r.nome)}</h3><p>${esc(r.descricao||'Sem descrição')}</p><div class="ap-card-bottom"><span>Editar atividade</span>${ico('arrow')}</div></button>`).join('')||blank}</div>`;
  if(variant==='C'){
    const row=list.find(r=>r.id===selected)||list[0];if(row)selected=row.id;
    host.innerHTML=`<div class="ap-top"><div class="ap-section-caption">${ico('layers')}<span>Catálogo <b>${rows.length}</b></span></div>${newButton}</div><div class="ap-split ap-surface"><div class="ap-list"><div class="ap-list-tools">${search}${tabs}</div>${list.map(r=>`<button class="ap-list-row ${r.id%2?'tone-blue':'tone-orange'} ${row?.id===r.id?'selected':''}" data-select="${r.id}" aria-pressed="${row?.id===r.id}"><span class="ap-list-text"><strong>${esc(r.nome)}</strong><small>${r.ativo?'Ativo':'Inativo'}</small></span>${ico('arrow')}</button>`).join('')||blank}</div><section class="ap-detail">${row?`<div class="ap-editor-head"><div><span class="ap-eyebrow">DETALHES DA ATIVIDADE</span><h2>${esc(row.nome)}</h2></div>${badge(row)}</div><form>${fields(row)}<div class="ap-form-actions"><button class="ap-primary" type="submit">Salvar alterações</button></div></form>`:blank}</section></div>`;
    if(row)wireForm(host.querySelector('form'),row);
  }
  host.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>edit());
  host.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(Number(b.dataset.edit)));
  host.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.select);render();});
  host.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
  const input=host.querySelector('.ap-search input');input.oninput=()=>{const pos=input.selectionStart;query=input.value;render();const next=host.querySelector('.ap-search input');next.focus();next.setSelectionRange(pos,pos);};
  switcher.innerHTML=`<span class="ap-proto-label">PROTÓTIPO</span><button aria-label="Variação anterior">←</button><span class="ap-variant-label">${variant} <small>${variants[variant]}</small></span><button aria-label="Próxima variação">→</button>`;
  const arrows=switcher.querySelectorAll('button');arrows[0].onclick=()=>cycle(-1);arrows[1].onclick=()=>cycle(1);
  state.querySelector('pre').textContent=JSON.stringify({variant,query,filter,selected,registros:rows},null,2);
}
function cycle(delta){const keys=Object.keys(variants);variant=keys[(keys.indexOf(variant)+delta+keys.length)%keys.length];const url=new URL(location);url.searchParams.set('variant',variant);history.pushState({},'',url);render();}
window.addEventListener('popstate',()=>{variant=new URLSearchParams(location.search).get('variant')||'A';if(!variants[variant])variant='A';render();});
window.addEventListener('keydown',e=>{if(dialog.open||e.target.closest('input,textarea,select,[contenteditable]'))return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();cycle(e.key==='ArrowLeft'?-1:1);}});
render();
