// UI enhancement only; permissions and authorization remain on the server.
(()=>{
const el=id=>document.getElementById(id);
let catalog=null;
const groups=['Cadastros','Operação','Financeiro','Parâmetros','Relatórios','Auditoria'];
function safe(t){return String(t??'');}
function draw(data){catalog=data;
const roles=el('rbacProfileTable');if(!roles)return;roles.replaceChildren();
const chosen=el('rbacRole').value;
for(const p of data.perfis||[]){const button=document.createElement('button');button.type='button';button.className='profile-row'+(String(p.PerfilId)===chosen?' active':'');
const name=document.createElement('span');name.textContent=safe(p.Nome);const note=document.createElement('small');note.textContent=safe(p.Codigo);button.append(name,note);
button.addEventListener('click',()=>{el('rbacRole').value=String(p.PerfilId);draw(data);});roles.append(button)}
const container=el('rbacPermissionGroups');container.replaceChildren();
const modMap=new Map();for(const perm of data.permissoes||[]){const k=safe(perm.Modulo);if(!modMap.has(k))modMap.set(k,[]);modMap.get(k).push(perm);}
for(const mod of [...groups,...[...modMap.keys()].filter(x=>!groups.includes(x))]){const matched=[...modMap.entries()].filter(([key])=>key.toLocaleLowerCase('pt-BR').includes(mod.toLocaleLowerCase('pt-BR')));const items=matched.flatMap(([,values])=>values);if(!items.length)continue;
const details=document.createElement('details');details.className='permission-section';details.open=mod==='Cadastros';const sum=document.createElement('summary');sum.textContent=mod+' · '+items.length+' ações';details.append(sum);
for(const item of items){const row=document.createElement('div');row.className='permission-item';const left=document.createElement('b');left.textContent=safe(item.Chave);const action=document.createElement('button');action.type='button';const granted=(data.concessoes||[]).some(x=>String(x.PerfilId)===chosen && x.Chave===item.Chave);action.textContent=item.Critica?'MFA exigido':granted?'Concedida':'Não concedida';action.disabled=Boolean(item.Critica);action.className=granted?'granted':'';if(item.Critica)action.classList.add('critical');action.addEventListener('click',()=>{el('rbacPermission').value=item.Chave;el('rbacGrant').checked=!granted;el('rbacPermission').focus();});row.append(left,action);details.append(row)}container.append(details)}
}
async function getCatalog(){if(el('rbacPanel')?.hidden)return;try{const response=await (window.jettaProtectedFetch||fetch)('/api/b23/catalogo',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;const data=await response.json();if(!response.ok||!data.perfis)return;draw(data);}catch{/* Keep existing form behavior and server errors. */}}
const btn=el('rbacRefresh');if(btn)btn.addEventListener('click',()=>setTimeout(getCatalog,250));
const select=el('rbacRole');if(select)select.addEventListener('change',()=>{if(catalog)draw(catalog)});
const observer=new MutationObserver(()=>{if(!el('rbacPanel').hidden)setTimeout(getCatalog,320)});if(el('rbacPanel'))observer.observe(el('rbacPanel'),{attributes:true,attributeFilter:['hidden']});
})();
