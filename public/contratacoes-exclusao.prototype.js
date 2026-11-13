// THROWAWAY: uma proposta no padrão existente, com simulação dos três perfis.
(()=>{
 const roles={ADMIN:'Admin',COORDENADOR:'Coordenador',GESTOR:'Gestor',FINANCEIRO:'Financeiro'};
 let role=Object.hasOwn(roles,new URLSearchParams(location.search).get('perfil'))?new URLSearchParams(location.search).get('perfil'):'ADMIN';
 const rows=[['101','João Carlos Silva','ABERTA',null],['102','Maria Aparecida Santos','ABERTA',null],['103','Paulo Henrique Souza','LIBERADA',null],['104','Ana Paula Oliveira','LIBERADA','2026-11-12T15:00:00Z'],['105','Carlos Eduardo Lima','CANCELADA',null]].map(([id,nome,status,pago])=>({ContratacaoId:id,Numero:'2026'+id,Prestador:nome,PrestadorId:id,DepositoId:'1',Deposito:'Campinas',CentroCusto:'CC-002',TipoServicoId:'1',Tipo:'Carga e descarga',GestorResponsavel:'Bruno Costa',GestorResponsavelId:'7',CriadoPor:'7',DataServico:'2026-11-13',InicioPrevisto:'2026-11-13T08:00',FimPrevisto:'2026-11-13T17:00',EntradaReal:null,SaidaReal:null,Valor:'180.00',Status:status,PagoEmUtc:pago,Versao:1}));
 const requests=new Map(),deleted=new Set(),audit=[];
 const financial=new Map(rows.filter(r=>r.Status==='LIBERADA').map(r=>[r.ContratacaoId,{numero:r.Numero,prestador:r.Prestador,etapa:r.PagoEmUtc?'Paga':'Encaminhada ao financeiro',valor:180}]));
 const account=()=>({id:7,nome:'Prévia · '+roles[role],perfil:role,funcoes:[role],pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true});
 const baseFetch=window.fetch.bind(window);
 const reply=data=>Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));
 window.fetch=(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url,location.origin);
  if(url.pathname==='/api/auth/me')return reply({preview:true,usuario:account()});
  if(url.pathname==='/api/pc04/exclusoes-pendentes')return reply({podeExcluir:false,registros:[]});
  if(url.pathname==='/api/pc04/catalogo')return reply({podeOperar:true,depositos:[{DepositoId:'1',Nome:'Campinas'}],tipos:[],prestadores:[],gestores:[]});
  if(url.pathname==='/api/pc04/contratacoes'&&(!options?.method||options.method==='GET')){
   const q=url.searchParams;
   return reply({registros:rows.filter(r=>!deleted.has(r.ContratacaoId)&&(!q.get('situacao')||q.get('situacao')===r.Status)&&(!q.get('prestador')||r.Prestador.toLowerCase().includes(q.get('prestador').toLowerCase()))&&(!q.get('numero')||r.Numero.includes(q.get('numero')))),proximaPagina:null,podeOperar:true});
  }
  const match=/^\/api\/pc04\/contratacoes\/(\d+)$/.exec(url.pathname);
  if(match)return reply({registro:rows.find(r=>r.ContratacaoId===match[1]),podeOperar:true,eventos:[]});
  return baseFetch(input,options);
 };
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const privileged=()=>role==='ADMIN';
 let dialog,focusBack;
 function close(){dialog.close();focusBack?.focus();}
 function refresh(){window.dispatchEvent(new CustomEvent('jetta:auth',{detail:account()}));decorate();}
 function show(r,review=false){
  focusBack=document.activeElement;
  const pending=requests.get(r.ContratacaoId),direct=privileged(),linked=financial.get(r.ContratacaoId);
  const title=review?'Excluir contratação solicitada':direct?'Excluir contratação':'Solicitar exclusão ao admin';
  dialog.innerHTML=`<header class="pc04-dialog-header"><div><h2 id="exclusionTitle">${title}</h2><p>Contratação #${esc(r.Numero)} · ${esc(r.Prestador)}</p></div><button class="pc04-close" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
  <div class="pc04-dialog-body"><dl class="exclusion-facts"><div><dt>Depósito</dt><dd>${esc(r.Deposito)} · ${esc(r.CentroCusto)}</dd></div><div><dt>Serviço</dt><dd>13/11/2026 · 08:00–17:00</dd></div><div><dt>Valor combinado</dt><dd>R$ 180,00</dd></div><div><dt>Situação</dt><dd>${r.PagoEmUtc?'Paga':{ABERTA:'Aberta',LIBERADA:'Liberada',CANCELADA:'Cancelada'}[r.Status]}</dd></div></dl>
  <p class="exclusion-note">${direct?'A contratação será excluída da operação e os registros financeiros vinculados serão removidos, independentemente da etapa no financeiro. A exclusão será registrada na auditoria administrativa.':'Somente o admin pode excluir. Seu pedido não remove a contratação nem os registros financeiros: o admin deverá analisar e executar a exclusão manualmente.'}</p>
  ${linked?`<div class="exclusion-request"><strong>Impacto no financeiro</strong><p>${esc(linked.etapa)} · R$ 180,00</p><p>${direct?'O registro financeiro e o valor desta contratação serão retirados das consultas e totais.':'O pedido também abrange a remoção do registro financeiro vinculado.'}${r.PagoEmUtc?' A exclusão do registro não desfaz o pagamento já realizado.':''}</p></div>`:''}
  ${review?`<div class="exclusion-request"><strong>Solicitado por ${esc(pending?.solicitante)} · ${esc(pending?.perfil)}</strong><p>${esc(pending?.motivo)}</p></div>`:''}
  <form id="exclusionForm"><label for="exclusionReason">${review?'Motivo da decisão':'Motivo '+(direct?'da exclusão':'da solicitação')}</label><textarea id="exclusionReason" required maxlength="800" rows="3" placeholder="Descreva o motivo"></textarea>${direct?'<label class="exclusion-check"><input type="checkbox" required> Confirmo a exclusão da contratação e de seus registros financeiros vinculados.</label>':''}</form></div>
  <footer class="pc04-dialog-footer"><span>${direct?'Exclusão exclusiva do admin':'Exclusão manual pelo admin'}</span><div><button data-back type="button">Voltar</button>${review?'<button data-reject type="button">Recusar pedido</button>':''}<button data-confirm type="button" class="${direct?'pc04-danger':'pc04-primary'}">${direct?'Confirmar exclusão':'Enviar solicitação ao admin'}</button></div></footer>`;
  dialog.querySelector('.pc04-close').onclick=close;dialog.querySelector('[data-back]').onclick=close;
  dialog.querySelector('[data-confirm]')?.addEventListener('click',()=>{
   if(!dialog.querySelector('form').reportValidity())return;
   const motivo=dialog.querySelector('textarea').value.trim();if(!motivo){dialog.querySelector('textarea').focus();return;}
   if(privileged()){deleted.add(r.ContratacaoId);financial.delete(r.ContratacaoId);requests.delete(r.ContratacaoId);audit.push({contratacao:r.Numero,acao:'Exclusão da contratação e dos registros financeiros vinculados',perfil:role,motivo});}
   else requests.set(r.ContratacaoId,{motivo,perfil:roles[role],solicitante:role==='GESTOR'?'Bruno Costa':'Usuário de demonstração'});
   close();refresh();feedback(direct?'Contratação e registros financeiros vinculados excluídos nesta prévia.':'Solicitação enviada nesta prévia. O admin deverá executar a exclusão manualmente.');
  });
  dialog.querySelector('[data-reject]')?.addEventListener('click',()=>{
   if(!privileged())return;
   const reason=dialog.querySelector('textarea');if(!reason.reportValidity()||!reason.value.trim())return;
   requests.delete(r.ContratacaoId);audit.push({contratacao:r.Numero,acao:'Pedido recusado',perfil:role,motivo:reason.value.trim()});close();refresh();feedback('Pedido recusado nesta prévia. Contratação mantida.');
  });
  dialog.showModal();
 }
 function feedback(text){document.querySelector('#exclusionFeedback').textContent=text;}
 function decorate(){
  document.querySelectorAll('.pc04-table tr[data-contract]').forEach(tr=>{
   tr.querySelectorAll('.pc04-exclusion-danger,.pc04-exclusion-request').forEach(button=>button.remove());
   if(tr.querySelector('[data-exclusion]'))return;
   const r=rows.find(r=>r.ContratacaoId===tr.dataset.contract);if(!r)return;
   tr.closest('table').querySelector('th:last-child').textContent='Ações';
   const pending=requests.has(r.ContratacaoId),button=document.createElement('button');button.type='button';button.dataset.exclusion='';
   button.textContent=pending?(privileged()?'Analisar e excluir':'Exclusão solicitada'):privileged()?'Excluir':'Solicitar exclusão';
   button.className=privileged()?'exclusion-action':'exclusion-request-action';button.disabled=pending&&!privileged();button.onclick=()=>show(r,pending&&privileged());tr.lastElementChild.append(button);
   if(pending){const tag=document.createElement('small');tag.className='exclusion-pending';tag.textContent='Aguardando exclusão pelo admin';tr.cells[4].append(tag);}
  });
  const state=document.querySelector('#exclusionState');if(state)state.textContent=JSON.stringify({perfil:role,solicitacoes:[...requests],excluidas:[...deleted],registrosFinanceiros:[...financial.values()],totalFinanceiro:[...financial.values()].reduce((sum,r)=>sum+r.valor,0),auditoriaAdministrativa:audit},null,2);
 }
 window.addEventListener('DOMContentLoaded',()=>{
  const banner=document.querySelector('#previewNotice');banner.innerHTML='<strong>Preview · exclusão de contratações</strong><span>Dados fictícios · alterações apenas nesta sessão</span><label>Simular perfil <select id="exclusionRole">'+Object.entries(roles).map(([key,label])=>`<option value="${key}" ${key===role?'selected':''}>${label}</option>`).join('')+'</select></label>';
  const notice=document.createElement('p');notice.id='exclusionFeedback';notice.role='status';notice.setAttribute('aria-live','polite');banner.after(notice);
  dialog=document.createElement('dialog');dialog.id='exclusionDialog';dialog.className='pc04-dialog';dialog.setAttribute('aria-labelledby','exclusionTitle');document.querySelector('#pc04Panel').append(dialog);
  const state=document.createElement('details');state.className='exclusion-state';state.innerHTML='<summary>Estado da simulação</summary><pre id="exclusionState"></pre>';document.querySelector('main').append(state);
  document.querySelector('#exclusionRole').onchange=e=>{role=e.target.value;const u=new URL(location);u.searchParams.set('perfil',role);history.replaceState(null,'',u);refresh();feedback('Simulando o perfil '+roles[role]+'.');};
  new MutationObserver(()=>decorate()).observe(document.querySelector('#pc04Panel'),{childList:true,subtree:true});decorate();
 });
})();
