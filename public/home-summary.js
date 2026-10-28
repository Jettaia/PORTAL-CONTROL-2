(()=>{
 const $=id=>document.getElementById(id);let generation=0;
 const clear=()=>{$('homeMetrics').replaceChildren();};
 function metric(title,value){const card=document.createElement('article');card.className='kpi';const box=document.createElement('div'),label=document.createElement('strong'),number=document.createElement('div');label.textContent=title;number.className='kpi-value';number.textContent=String(value);box.append(label,number);card.append(box);$('homeMetrics').append(card);}
 async function load(){const ticket=++generation;clear();if($('dashboard').hidden)return;const role=$('role').textContent.trim(),day=$('homeFilters').elements.dia.value,q=new URLSearchParams(day?{inicio:day,fim:day}:{});$('homeStatus').textContent='Consultando seu escopo autorizado…';
  if(!['GESTOR','FINANCEIRO','DIRETORIA'].includes(role)){$('homeStatus').textContent='Use Cadastros e Perfis para administrar os acessos. Os indicadores operacionais exigem perfil e permissão próprios.';return;}
  try{const response=await (window.jettaProtectedFetch||fetch)((role==='DIRETORIA'?'/api/final-lab/gestao?':'/api/b61/carteira?')+q,{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw Error(response.status===403?'Seu perfil não possui permissão para este resumo.':'Resumo indisponível. Selecione uma data menor ou consulte a jornada.');const data=await response.json();if(ticket!==generation||$('dashboard').hidden)return;
   if(role==='DIRETORIA'){metric('Serviços contratados',data.linhas.length);metric('Depósitos no recorte',new Set(data.linhas.map(r=>r.DepositoId)).size);metric('Prestadores no recorte',new Set(data.linhas.map(r=>r.PrestadorId)).size);metric('Ocorrências',data.linhas.reduce((s,r)=>s+Number(r.Ocorrencias),0));}
   else{const i=data.indicadores;metric('Participações contratadas',i.participacoes);metric('Execução registrada',i.etapas.EXECUTADO.quantidade);metric('Aguardando conferência',data.linhas.filter(r=>r.etapas.EXECUTADO&&!r.etapas.CONFERIDO).length);metric('Serviços fechados',i.etapas.FECHADO.quantidade);metric('Sem entrada regular',data.linhas.filter(r=>!r.horarios.some(h=>h.tipo==='ENTRADA')).length);metric('Com pendências',i.etapas.BLOQUEADO.quantidade);metric('Prestadores',i.prestadores);metric('Depósitos no recorte',new Set(data.linhas.map(r=>r.deposito.id)).size);}
   $('homeStatus').textContent=(day?'Serviços de '+day:'Todo o recorte autorizado')+' · contagens de participações; etapas podem se sobrepor. Ausência de entrada exige análise e não confirma falta.';
  }catch(e){if(ticket===generation){clear();$('homeStatus').textContent=e.message;}}
 }
 $('homeFilters').addEventListener('submit',e=>{e.preventDefault();load();});
 new MutationObserver(()=>{generation++;clear();if(!$('dashboard').hidden)load();}).observe($('dashboard'),{attributes:true,attributeFilter:['hidden']});
 if(!$('dashboard').hidden)load();
})();
