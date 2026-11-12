(()=>{
 const toggle=document.getElementById('notificationsToggle');if(!toggle)return;
 const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const badge=document.getElementById('notificationsBadge'),panel=make('section');panel.id='notificationsPanel';panel.className='notifications-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','notificationsTitle');
 const head=make('header'),title=make('h2','Notificações');title.id='notificationsTitle';const close=make('button','Fechar');close.type='button';head.append(title,close);
 const tools=make('div'),refresh=make('button','Atualizar notificações');refresh.type='button';tools.className='notifications-tools';tools.append(make('span','Horários manuais'),refresh);
 const message=make('p');message.id='notificationsMessage';message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const list=make('div');list.id='notificationsList';const more=make('button','Carregar anteriores');more.type='button';more.hidden=true;
 panel.append(head,tools,message,list,more);document.body.append(panel);
 let account=null,epoch=0,busy=false,timer=null,cursor=null,unread=0;
 const eligible=u=>u?.pc04&&[u.perfil,...(u.funcoes||[])].some(r=>['ADMIN','COORDENADOR','GESTOR'].includes(r));
 function hide(focus=false){panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();}
 function count(value){unread=value;badge.textContent=value>99?'99+':String(value);badge.hidden=value===0;toggle.setAttribute('aria-label',value?`Notificações: ${value} não lidas`:'Notificações');}
 async function api(url,body){const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)}:{})});if(!response.ok)throw Error('NOTIFICACOES_INDISPONIVEIS');return response.json();}
 const date=value=>{const d=new Date(value+'Z');return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});};
 const statuses={PENDENTE:'Aguardando validação',APROVADA:'Aprovada',NEGADA:'Recusada',CANCELADA:'Cancelada'};
 function render(row){
  const item=make('button');item.type='button';item.className='notification-item';item.dataset.read=String(row.Lida);item.dataset.status=row.Status;
  const text=row.Tipo==='SOLICITACAO'?`${row.Solicitante} solicitou alteração de horários`:`Sua solicitação de horários foi ${row.Status==='APROVADA'?'aprovada':row.Status==='NEGADA'?'recusada':'cancelada'}`;
  const heading=make('strong',text),context=make('span',`#${row.Numero} · ${row.Prestador} · ${row.Deposito}`),meta=make('small',`${statuses[row.Status]||row.Status} · ${date(row.CriadoEmUtc)}${row.Lida?'':' · Não lida'}`);context.className='notification-context';item.append(heading,context,meta);
  item.addEventListener('click',async()=>{
   if(busy)return;busy=true;const revision=epoch;item.disabled=true;
   try{await api('/api/notificacoes/'+encodeURIComponent(row.Id)+'/lida',{});if(revision!==epoch)return;row.Lida=true;item.dataset.read='true';hide();location.hash='contratacoes/'+encodeURIComponent(row.ContratacaoId)+'/horarios';window.dispatchEvent(new CustomEvent('jetta:go',{detail:'contratacoes'}));}
   catch{if(revision===epoch)message.textContent='Não foi possível marcar a leitura. Tente novamente.';}
   finally{if(revision===epoch){busy=false;item.disabled=false;refreshList();}}
  });return item;
 }
 async function refreshList(append=false){
  if(!account||busy)return;busy=true;const revision=epoch;refresh.disabled=true;more.disabled=true;list.inert=true;message.textContent='Atualizando notificações…';
  try{const data=await api('/api/notificacoes'+(append&&cursor?'?antes='+encodeURIComponent(cursor):''));if(revision!==epoch)return;
   count(data.naoLidas);if(!append)list.replaceChildren();list.append(...data.registros.map(render));cursor=data.proximaPagina;more.hidden=!cursor;
   message.textContent=!list.children.length?'Nenhuma notificação por enquanto.':unread===0?'Nenhuma notificação não lida.':`${unread} ${unread===1?'notificação não lida':'notificações não lidas'}.`;
  }catch{if(revision===epoch){message.textContent='Não foi possível atualizar as notificações. Tente novamente.';toggle.setAttribute('aria-label','Notificações: falha ao atualizar');}}
  finally{if(revision===epoch){busy=false;refresh.disabled=false;more.disabled=false;list.inert=false;}}
 }
 function auth(user){epoch++;account=eligible(user)?user:null;busy=false;clearInterval(timer);cursor=null;list.replaceChildren();list.inert=false;message.textContent='';more.hidden=true;refresh.disabled=false;hide();count(0);toggle.hidden=!account;if(account){refreshList();timer=setInterval(()=>{if(!document.hidden)refreshList();},30000);}}
 toggle.addEventListener('click',()=>{if(panel.hidden){panel.hidden=false;toggle.setAttribute('aria-expanded','true');refreshList();close.focus();}else hide();});
 close.addEventListener('click',()=>hide(true));refresh.addEventListener('click',()=>refreshList());more.addEventListener('click',()=>refreshList(true));
 document.addEventListener('click',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!toggle.contains(e.target))hide();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){hide(true);e.preventDefault();}});
 window.addEventListener('jetta:auth',e=>auth(e.detail));window.addEventListener('jetta:notifications-refresh',()=>refreshList());document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshList();});auth(window.jettaAccount);
})();
