// THROWAWAY: three provider layouts in the existing portal shell, switchable via ?variant=A/B/C.
// Question: table, cards or list/detail for a minimal provider registry? Synthetic records, memory only.
import {mountPrototypeSwitcher} from './prototype-switcher.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const depotCatalog=[{nome:'Guarulhos',centroCusto:'CC-001'},{nome:'Campinas',centroCusto:'CC-002'},{nome:'Curitiba',centroCusto:'CC-003'}];
const depots=depotCatalog.map(d=>d.nome);
const depotCost=name=>depotCatalog.find(d=>d.nome===name)?.centroCusto||'';
const depotLabel=name=>[name,depotCost(name)].filter(Boolean).join(' · ');
const rows=[
 {id:1,nome:'André Ferreira',documento:'12345678901',telefone:'11900000001',ativo:true,depositos:['Guarulhos','Campinas']},
 {id:2,nome:'Beatriz Almeida',documento:'23456789012',telefone:'19900000002',ativo:true,depositos:['Campinas']},
 {id:3,nome:'Carlos Oliveira',documento:'34567890123',telefone:'41900000003',ativo:true,depositos:['Curitiba']},
 {id:4,nome:'Movimentação Horizonte Ltda.',documento:'12345678000190',telefone:'1130000004',ativo:true,depositos:['Guarulhos','Curitiba']},
 {id:5,nome:'Daniela Santos',documento:'45678901234',telefone:'',ativo:false,depositos:['Guarulhos']},
 {id:6,nome:'Eduardo Lima',documento:'56789012345',telefone:'19900000006',ativo:true,depositos:['Campinas']}
];
let variant='A',query='',filter='todos',depot='',selected=1,creating=false,editingId=null;
const documentMask=value=>{const d=String(value).replace(/\D/g,'').slice(0,14);return d.length<=11?d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3}\.\d{3})(\d)/,'$1.$2').replace(/(\d{3}\.\d{3}\.\d{3})(\d)/,'$1-$2'):d.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2}\.\d{3})(\d)/,'$1.$2').replace(/(\d{2}\.\d{3}\.\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2');};
const phoneMask=value=>{const d=String(value).replace(/\D/g,'');return d.length===11?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:d.length===10?`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`:value||'—';};
$('#loginBox').hidden=true;$('#dashboard').hidden=true;document.querySelectorAll('.view-section,.account-actions').forEach(e=>e.hidden=true);
const host=$('#cadastrosPage');host.hidden=false;host.className='pp';$('main').append(host);
$('#breadcrumb').hidden=true;$('#pageHeading').textContent='Prestadores';$('#pageDescription').textContent='';
$('#topUser').textContent='Prévia de design';$('.environment').textContent='● Protótipo';$('.bell').hidden=true;
$('#toggleSide').textContent='☰';$('#toggleSide').onclick=()=>$('#sidebar').classList.toggle('collapsed');
document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('selected',b.dataset.page==='chapas');b.onclick=()=>toast('Prévia de prestadores');});
const dialog=document.createElement('dialog');dialog.className='pp pp-dialog';document.body.append(dialog);
const state=document.createElement('details');state.className='pp-state';state.innerHTML='<summary>Estado da prévia · dados fictícios</summary><pre></pre>';host.after(state);
const notice=document.createElement('div');notice.className='pp-toast';notice.setAttribute('role','status');notice.hidden=true;document.body.append(notice);let timer;
function toast(text){notice.textContent=text;notice.hidden=false;clearTimeout(timer);timer=setTimeout(()=>notice.hidden=true,2200);}
const badge=r=>`<span class="pp-badge ${r.ativo?'on':'off'}"><i></i>${r.ativo?'Ativo':'Inativo'}</span>`;
const chips=r=>r.depositos.map(d=>`<span class="pp-chip">${esc(depotLabel(d))}</span>`).join('')||'<span class="pp-muted">Sem vínculo</span>';
const newButton='<button class="pp-primary" data-new>＋ Novo prestador</button>';
function updateState(){state.querySelector('pre').textContent=JSON.stringify({variant,busca:query,situacao:filter,deposito:depot,selecionado:selected,editando:editingId,novo:creating,catalogoDepositos:depotCatalog,registros:rows},null,2);}
function tools(){return `<div class="pp-tools"><div class="pp-tabs" role="group" aria-label="Filtrar situação">${['todos','ativos','inativos'].map(f=>`<button type="button" data-filter="${f}" aria-pressed="${f===filter}">${{todos:'Todos',ativos:'Ativos',inativos:'Inativos'}[f]} <span>${rows.filter(r=>f==='todos'||r.ativo===(f==='ativos')).length}</span></button>`).join('')}</div><div class="pp-filters"><select aria-label="Filtrar depósito" class="pp-depot"><option value="">Todos os depósitos</option>${depots.map(d=>`<option value="${esc(d)}" ${d===depot?'selected':''}>${esc(depotLabel(d))}</option>`).join('')}</select><input class="pp-search" type="search" aria-label="Buscar prestador" placeholder="Nome, CPF ou CNPJ…" value="${esc(query)}"></div></div>`;}
function editor(row){return `<form class="pp-form"><label>Nome completo<input name="nome" required maxlength="160" value="${esc(row?.nome||'')}" autocomplete="off"></label><div class="pp-fields"><label>CPF ou CNPJ<input name="documento" required inputmode="numeric" maxlength="18" value="${esc(documentMask(row?.documento||''))}" autocomplete="off"></label><label>Telefone <span class="pp-optional">opcional</span><input name="telefone" type="tel" maxlength="25" value="${esc(row?.telefone?phoneMask(row.telefone):'')}" autocomplete="off"></label></div><fieldset><legend>Depósitos</legend><div class="pp-branch-options">${depots.map(d=>`<label><input type="checkbox" name="depositos" value="${d}" ${row?.depositos.includes(d)?'checked':''}><span>${esc(d)}<small>${esc(depotCost(d))}</small></span></label>`).join('')}</div></fieldset><label class="pp-status">Situação<select name="ativo"><option value="1" ${row?.ativo!==false?'selected':''}>Ativo</option><option value="0" ${row?.ativo===false?'selected':''}>Inativo</option></select></label><div class="pp-actions"><button class="pp-secondary" data-cancel type="button">Cancelar</button><button class="pp-primary" type="submit">${row?'Salvar alterações':'Cadastrar prestador'}</button></div></form>`;}
function wireEditor(form,row,close){
 form.querySelector('[data-cancel]').onclick=()=>{creating=false;editingId=null;if(close){close();updateState();}else render();};
 form.querySelector('[name=documento]').oninput=e=>{e.target.value=documentMask(e.target.value);e.target.setCustomValidity('');};
 form.onsubmit=e=>{e.preventDefault();const data=new FormData(form),digits=data.get('documento').replace(/\D/g,'');
  if(![11,14].includes(digits.length)){const input=form.querySelector('[name=documento]');input.setCustomValidity('Informe 11 dígitos para CPF ou 14 para CNPJ.');input.reportValidity();return;}
  const value={nome:data.get('nome').trim(),documento:digits,telefone:data.get('telefone').replace(/\D/g,''),ativo:data.get('ativo')==='1',depositos:data.getAll('depositos')};if(!value.nome)return;
  if(row)Object.assign(row,value);else{const r={id:Math.max(...rows.map(r=>r.id))+1,...value};rows.push(r);selected=r.id;query='';filter='todos';depot='';}
  close?.();creating=false;editingId=null;render();toast('Salvo nesta prévia');};
}
function openEditor(id){const row=rows.find(r=>r.id===id);editingId=id??null;creating=!row;
 if(variant==='C'&&row){selected=row.id;render();host.querySelector('[name=nome]').focus();return;}
 dialog.classList.toggle('drawer',variant==='A');dialog.innerHTML=`<div class="pp-editor-head"><h2>${row?'Editar prestador':'Novo prestador'}</h2><button class="pp-close" type="button" aria-label="Fechar">×</button></div>${editor(row)}`;
 dialog.querySelector('.pp-close').onclick=()=>{dialog.close();creating=false;editingId=null;updateState();};wireEditor(dialog.querySelector('form'),row,()=>dialog.close());dialog.showModal();updateState();
}
function VariantA(list){return `<div class="pp-top"><span class="pp-count">${rows.length} prestadores</span>${newButton}</div><div class="pp-surface">${tools()}<div class="pp-table-scroll"><table><thead><tr><th>Prestador</th><th>CPF / CNPJ</th><th>Telefone</th><th>Depósitos</th><th>Situação</th><th></th></tr></thead><tbody>${list.map(r=>`<tr><td><strong>${esc(r.nome)}</strong></td><td class="pp-document">${esc(documentMask(r.documento))}</td><td class="pp-muted">${esc(phoneMask(r.telefone))}</td><td><div class="pp-chips">${chips(r)}</div></td><td>${badge(r)}</td><td><button class="pp-edit" data-edit="${r.id}">Editar <span aria-hidden="true">↗</span></button></td></tr>`).join('')}</tbody></table>${list.length?'':'<div class="pp-empty">Nenhum prestador encontrado.</div>'}</div><div class="pp-foot">${list.length} prestadores</div></div>`;}
function VariantB(list){return `<div class="pp-top"><div class="pp-metrics"><span><b>${String(rows.filter(r=>r.ativo).length).padStart(2,'0')}</b> ativos</span><i></i><span><b>${String(rows.filter(r=>!r.ativo).length).padStart(2,'0')}</b> inativos</span></div>${newButton}</div>${tools()}<div class="pp-cards">${list.map(r=>`<article class="pp-card ${r.ativo?'':'inactive'}"><div class="pp-card-head"><span class="pp-person-type">${r.documento.length===14?'Pessoa jurídica':'Pessoa física'}</span>${badge(r)}</div><h2>${esc(r.nome)}</h2><p class="pp-document">${esc(documentMask(r.documento))}</p><div class="pp-phone"><span>Telefone</span><strong>${esc(phoneMask(r.telefone))}</strong></div><div class="pp-chips">${chips(r)}</div><button class="pp-card-edit" data-edit="${r.id}">Editar cadastro <span aria-hidden="true">→</span></button></article>`).join('')||'<div class="pp-empty">Nenhum prestador encontrado.</div>'}</div>`;}
function VariantC(list){const row=creating?null:rows.find(r=>r.id===selected)||list[0];if(row)selected=row.id;
 return `<div class="pp-top">${newButton}</div><div class="pp-split pp-surface"><div class="pp-list">${tools()}<div class="pp-list-items">${list.map(r=>`<button class="pp-list-row ${rows.indexOf(r)%2?'orange':'blue'}" data-select="${r.id}" aria-pressed="${!creating&&row?.id===r.id}"><span><strong>${esc(r.nome)}</strong><small>${esc(documentMask(r.documento))}</small></span><span class="pp-dot ${r.ativo?'on':'off'}" aria-label="${r.ativo?'Ativo':'Inativo'}"></span></button>`).join('')||'<div class="pp-empty">Nenhum prestador encontrado.</div>'}</div></div><section class="pp-detail"><div class="pp-editor-head"><h2>${row?'Cadastro':'Novo prestador'}</h2>${row?badge(row):''}</div>${editor(row)}</section></div>`;
}
function render(){const q=query.trim().toLocaleLowerCase('pt-BR'),digits=q.replace(/\D/g,'');const list=rows.filter(r=>(!q||r.nome.toLocaleLowerCase('pt-BR').includes(q)||(digits&&r.documento.includes(digits)))&&(filter==='todos'||r.ativo===(filter==='ativos'))&&(!depot||r.depositos.includes(depot)));
 host.dataset.variant=variant;host.innerHTML=({A:VariantA,B:VariantB,C:VariantC}[variant])(list);
 host.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>openEditor());host.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(Number(b.dataset.edit)));
 host.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.select);creating=false;editingId=selected;render();});host.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
 const search=host.querySelector('.pp-search');search.oninput=()=>{query=search.value;render();host.querySelector('.pp-search').focus();};host.querySelector('.pp-depot').onchange=e=>{depot=e.target.value;render();};
 if(variant==='C')wireEditor(host.querySelector('form'),creating?null:rows.find(r=>r.id===selected));updateState();
}
dialog.addEventListener('cancel',()=>{creating=false;editingId=null;updateState();});
mountPrototypeSwitcher({A:'Tabela + painel',B:'Cards + modal',C:'Lista + cadastro'},key=>{variant=key;creating=false;editingId=null;render();});
