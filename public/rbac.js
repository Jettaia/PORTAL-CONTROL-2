// Jetta Control B2.3: configuracao de perfis; todas as operacoes validadas no servidor.
(()=>{
const holder=document.getElementById('rbacPanel');if(!holder)return;
const el=id=>document.getElementById(id);
async function api(path,body){const opt=body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)};const r=await (window.jettaProtectedFetch||fetch)(path,{...opt,credentials:'same-origin',cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.erro||'Falha na operacao');return data;}
function note(s){el('rbacMsg').textContent=s;}
async function refresh(){try{const data=await api('/api/b23/catalogo');holder.hidden=false;el('rbacRole').replaceChildren();el('rbacUser').replaceChildren();el('rbacPermission').replaceChildren();
for(const p of data.perfis){const o=document.createElement('option');o.value=String(p.PerfilId);o.textContent=p.Nome+' ('+p.Codigo+')';el('rbacRole').append(o);}
for(const u of data.usuarios){if(!u.Ativo)continue;const o=document.createElement('option');o.value=String(u.UsuarioId);o.textContent=u.Nome+' — '+u.Email;el('rbacUser').append(o);}
for(const p of data.permissoes){const o=document.createElement('option');o.value=p.Chave;o.textContent=p.Modulo+' / '+p.Descricao+(p.Critica?' (bloqueada sem MFA)':'');o.disabled=Boolean(p.Critica);el('rbacPermission').append(o);}
const selected=Number(el('rbacRole').value);el('rbacCurrent').textContent='Permissoes do perfil: '+data.concessoes.filter(c=>Number(c.PerfilId)===selected).map(c=>c.Chave).join(', ');
note('Catalogo carregado. Alteracoes exigem Administrador-raiz.');
}catch(e){note(e.message);}}
el('rbacRefresh').addEventListener('click',refresh);
el('rbacRole').addEventListener('change',()=>{const id=Number(el('rbacRole').value);el('rbacCurrent').textContent='Perfil selecionado: '+id+' — utilize Atualizar catálogo para carregar os vínculos.';});
el('rbacNewRole').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/b23/perfis',{codigo:el('rbacCode').value,nome:el('rbacName').value});note('Perfil criado');await refresh();}catch(err){note(err.message)}});
el('rbacSetPermission').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/b23/permissoes',{perfilId:Number(el('rbacRole').value),chave:el('rbacPermission').value,conceder:el('rbacGrant').checked});note('Permissao atualizada');await refresh();}catch(err){note(err.message)}});
el('rbacAssign').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/b23/usuarios/perfis',{usuarioId:Number(el('rbacUser').value),perfilId:Number(el('rbacRole').value),conceder:el('rbacUserGrant').checked});note('Vinculo de perfil atualizado');await refresh();}catch(err){note(err.message)}});
// Atualize apos autenticar usando o botao Atualizar catalogo.
})();
