// THROWAWAY: three structurally distinct deposit screens in the existing portal shell, ?variant=A/B/C.
// Question: which layout makes deposit consultation and registration clearer with minimal text?
import {mountPrototypeSwitcher} from './prototype-switcher.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=[
  {id:1,nome:'Guarulhos',centroCusto:'CC-001',rua:'Avenida Santos Dumont',numero:'1500',bairro:'Cumbica',cidade:'Guarulhos',estado:'SP',cep:'07180-000',ativo:true},
  {id:2,nome:'Campinas',centroCusto:'CC-002',rua:'Rua dos Transportadores',numero:'240',bairro:'Distrito Industrial',cidade:'Campinas',estado:'SP',cep:'13054-000',ativo:true},
  {id:3,nome:'Curitiba',centroCusto:'CC-003',rua:'Avenida das Indústrias',numero:'860',bairro:'Cidade Industrial',cidade:'Curitiba',estado:'PR',cep:'81260-000',ativo:true},
  {id:4,nome:'Contagem',centroCusto:'CC-004',rua:'Rua do Contorno',numero:'320',bairro:'Industrial',cidade:'Contagem',estado:'MG',cep:'32223-000',ativo:true},
  {id:5,nome:'Santos',centroCusto:'CC-005',rua:'Avenida Portuária',numero:'75',bairro:'Macuco',cidade:'Santos',estado:'SP',cep:'11015-000',ativo:false}
];
let variant='A',query='',filter='todos',selected=1,creating=false;
$('#loginBox').hidden=true;$('#dashboard').hidden=true;
document.querySelectorAll('.view-section,.account-actions').forEach(e=>e.hidden=true);
const host=$('#depositsPage');host.hidden=false;host.className='dp';$('main').append(host);
$('#breadcrumb').textContent='';$('#breadcrumb').hidden=true;$('#pageHeading').textContent='Depósitos';$('#pageDescription').textContent='';
$('#topUser').textContent='Prévia de design';$('.environment').textContent='● Protótipo';
document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('selected',b.dataset.page==='depositos');b.onclick=()=>toast('Prévia de depósitos');});
$('#toggleSide').textContent='☰';$('#toggleSide').onclick=()=>$('#sidebar').classList.toggle('collapsed');
$('.bell').hidden=true;
const dialog=document.createElement('dialog');dialog.className='dp dp-dialog';document.body.append(dialog);
const state=document.createElement('details');state.className='dp-state';state.innerHTML='<summary>Estado da prévia · dados fictícios</summary><pre></pre>';host.after(state);
const notice=document.createElement('div');notice.className='dp-toast';notice.setAttribute('role','status');document.body.append(notice);let timer;
function toast(text){notice.textContent=text;notice.hidden=false;clearTimeout(timer);timer=setTimeout(()=>notice.hidden=true,2400);}
notice.hidden=true;
const badge=r=>`<span class="dp-badge ${r.ativo?'on':'off'}"><i></i>${r.ativo?'Ativo':'Inativo'}</span>`;
function field(key,label,row,{wide=false,max=150,required=true}={}){return `<label ${wide?'class="dp-wide"':''}>${label}<input name="${key}" maxlength="${max}" ${required?'required':''} value="${esc(row?.[key]||'')}" ${key==='cep'?'inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000"':''} ${key==='estado'?'pattern="[A-Za-z]{2}" placeholder="UF"':''}></label>`;}
function editor(row){return `<form class="dp-form"><fieldset><legend>Cadastro</legend><div class="dp-fields">${field('nome','Nome',row)}${field('centroCusto','Centro de custo',row,{max:80})}</div></fieldset><fieldset><legend>Endereço</legend><div class="dp-fields dp-address">${field('cep','CEP',row,{max:9})}${field('estado','UF',row,{max:2})}${field('rua','Rua',row,{wide:true,max:200})}${field('numero','Número',row,{max:30})}${field('bairro','Bairro',row,{max:120})}${field('cidade','Cidade',row,{wide:true,max:120})}</div></fieldset><label class="dp-status-field">Situação<select name="ativo"><option value="1" ${row?.ativo!==false?'selected':''}>Ativo</option><option value="0" ${row?.ativo===false?'selected':''}>Inativo</option></select></label><div class="dp-actions"><button class="dp-secondary" type="button" data-cancel>Cancelar</button><button class="dp-primary" type="submit">${row?'Salvar alterações':'Cadastrar depósito'}</button></div></form>`;}
function wireEditor(form,row,close){
  form.querySelector('[data-cancel]').onclick=()=>{if(close)close();else{creating=false;render();}};
  form.querySelector('[name=cep]').oninput=e=>{const d=e.target.value.replace(/\D/g,'').slice(0,8);e.target.value=d.length>5?d.slice(0,5)+'-'+d.slice(5):d;};
  form.onsubmit=e=>{e.preventDefault();const data=new FormData(form),value=Object.fromEntries([...data].map(([k,v])=>[k,v.trim()]));value.ativo=data.get('ativo')==='1';value.estado=value.estado.toUpperCase();
    if(row)Object.assign(row,value);else{const added={id:Math.max(...rows.map(r=>r.id))+1,...value};rows.push(added);selected=added.id;}
    creating=false;close?.();render();toast('Salvo nesta prévia');};
}
function openEditor(id){const row=rows.find(r=>r.id===id);if(variant==='C'){selected=id;creating=!row;render();host.querySelector('[name=nome]').focus();return;}
  dialog.classList.toggle('drawer',variant==='A');dialog.innerHTML=`<div class="dp-editor-head"><h2>${row?'Editar depósito':'Novo depósito'}</h2><button class="dp-close" type="button" aria-label="Fechar">×</button></div>${editor(row)}`;
  dialog.querySelector('.dp-close').onclick=()=>dialog.close();wireEditor(dialog.querySelector('form'),row,()=>dialog.close());dialog.showModal();updateState();
}
function updateState(){state.querySelector('pre').textContent=JSON.stringify({variant,busca:query,situacao:filter,selecionado:selected,novo:creating,registros:rows},null,2);}
function tools(){return `<div class="dp-tools"><div class="dp-tabs" role="group" aria-label="Situação">${['todos','ativos','inativos'].map(f=>`<button data-filter="${f}" aria-pressed="${filter===f}">${{todos:'Todos',ativos:'Ativos',inativos:'Inativos'}[f]} <span>${rows.filter(r=>f==='todos'||r.ativo===(f==='ativos')).length}</span></button>`).join('')}</div><input class="dp-search" type="search" aria-label="Buscar depósito" placeholder="Buscar depósito ou cidade…" value="${esc(query)}"></div>`;}
const newButton='<button class="dp-primary" data-new>＋ Novo depósito</button>';
function VariantA(list){return `<div class="dp-top"><span class="dp-count">${rows.length} depósitos</span>${newButton}</div><div class="dp-surface">${tools()}<div class="dp-table-scroll"><table><thead><tr><th>Depósito</th><th>Centro de custo</th><th>Cidade / UF</th><th>Situação</th><th></th></tr></thead><tbody>${list.map(r=>`<tr><td><strong>${esc(r.nome)}</strong><small>${esc(r.rua)}, ${esc(r.numero)}</small></td><td><span class="dp-cc">${esc(r.centroCusto)}</span></td><td>${esc(r.cidade)} <span class="dp-uf">${esc(r.estado)}</span></td><td>${badge(r)}</td><td><button class="dp-edit" data-edit="${r.id}">Editar <span aria-hidden="true">↗</span></button></td></tr>`).join('')}</tbody></table>${list.length?'':'<div class="dp-empty">Nenhum depósito encontrado.</div>'}</div><div class="dp-foot">${list.length} depósitos</div></div>`;}
function VariantB(list){return `<div class="dp-top dp-card-top"><div class="dp-metrics"><span><b>${String(rows.filter(r=>r.ativo).length).padStart(2,'0')}</b> ativos</span><i></i><span><b>${String(rows.filter(r=>!r.ativo).length).padStart(2,'0')}</b> inativos</span></div>${newButton}</div>${tools()}<div class="dp-cards">${list.map(r=>`<article class="dp-card ${r.ativo?'':'inactive'}"><div class="dp-card-head"><span class="dp-cc">${esc(r.centroCusto)}</span>${badge(r)}</div><h2>${esc(r.nome)}</h2><p class="dp-city">${esc(r.cidade)} · ${esc(r.estado)}</p><div class="dp-card-address">${esc(r.rua)}, ${esc(r.numero)}<br>${esc(r.bairro)} · ${esc(r.cep)}</div><button class="dp-card-edit" data-edit="${r.id}">Editar depósito <span aria-hidden="true">→</span></button></article>`).join('')||'<div class="dp-empty">Nenhum depósito encontrado.</div>'}</div>`;}
function VariantC(list){const row=creating?null:rows.find(r=>r.id===selected)||list[0];if(row)selected=row.id;
  return `<div class="dp-top"><span class="dp-count">${rows.length} depósitos</span>${newButton}</div><div class="dp-split dp-surface"><div class="dp-list">${tools()}<div class="dp-list-items">${list.map((r)=>`<button class="dp-list-row ${rows.indexOf(r)%2?'orange':'blue'}" data-select="${r.id}" aria-pressed="${!creating&&selected===r.id}"><span><strong>${esc(r.nome)}</strong><small>${esc(r.cidade)} / ${esc(r.estado)} <span>· ${esc(r.centroCusto)}</span></small></span><span class="dp-list-dot ${r.ativo?'on':'off'}" aria-label="${r.ativo?'Ativo':'Inativo'}"></span></button>`).join('')||'<div class="dp-empty">Nenhum depósito encontrado.</div>'}</div></div><section class="dp-detail"><div class="dp-editor-head"><h2>${row?esc(row.nome):'Novo depósito'}</h2>${row?badge(row):''}</div>${editor(row)}</section></div>`;}
function render(){const q=query.toLocaleLowerCase('pt-BR');const list=rows.filter(r=>[r.nome,r.cidade,r.centroCusto,r.estado].some(s=>s.toLocaleLowerCase('pt-BR').includes(q))&&(filter==='todos'||r.ativo===(filter==='ativos')));
  host.dataset.variant=variant;host.innerHTML=({A:VariantA,B:VariantB,C:VariantC}[variant])(list);
  host.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>openEditor());host.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(Number(b.dataset.edit)));
  host.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.select);creating=false;render();});
  host.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
  const input=host.querySelector('.dp-search');input.oninput=()=>{query=input.value;render();host.querySelector('.dp-search').focus();};
  if(variant==='C')wireEditor(host.querySelector('form'),creating?null:rows.find(r=>r.id===selected));
  updateState();
}
mountPrototypeSwitcher({A:'Tabela + painel',B:'Cards + modal',C:'Lista + cadastro'},key=>{variant=key;creating=false;render();});
