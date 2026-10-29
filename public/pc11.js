(()=>{
 const root=document.getElementById('pc11Page');if(!root)return;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=String(text);return node;};
 const flag=value=>value===true||value===1||value===1n||value==='1';
 const money=value=>'R$ '+String(value??'0.00').replace('.',',');
 let epoch=0,current=null,busy=false,controller=new AbortController();
 root.innerHTML='<h2>Extrato do prestador</h2><p>Recebíveis liberados, pagamentos e ajustes nas filiais autorizadas. Datas efetivas recompõem o saldo, inclusive em registros retroativos.</p><form id="pc11Filters"><label>Nome do prestador<input name="nome" maxlength="150" autocomplete="off"></label><label>Prestador (código)<input name="prestadorId" inputmode="numeric" pattern="[1-9][0-9]*"></label><label>Filial (código)<input name="filialId" inputmode="numeric" pattern="[1-9][0-9]*"></label><label>De<input name="inicio" type="date"></label><label>Até<input name="fim" type="date"></label><button>Consultar extrato</button></form><p id="pc11Message" role="status" aria-live="polite"></p><button id="pc11Print" type="button" disabled>Imprimir / salvar PDF</button><article id="pc11Result" hidden><h3>Extrato · Jetta Control</h3><p id="pc11Applied"></p><p class="pc11-scope">Somente filiais autorizadas para o usuário da consulta. Valores em reais.</p><div class="pc11-totals"><div><span>Saldo anterior</span><strong id="pc11Previous"></strong></div><div><span>Saldo final</span><strong id="pc11Final"></strong></div><div><span>Pago líquido no período</span><strong id="pc11Paid"></strong></div><div><span>Em aberto até o fim</span><strong id="pc11Open"></strong></div><div><span>A devolver até o fim</span><strong id="pc11Return"></strong></div></div><p id="pc11Receipts"></p><div class="pc11-scroll"><table><caption>Movimentos em ordem efetiva</caption><thead><tr><th>Data efetiva / registro UTC</th><th>Prestador / filial / gestor</th><th>Movimento / serviço</th><th>Origem / documentos</th><th>Valor</th><th>Saldo</th></tr></thead><tbody id="pc11Rows"></tbody></table></div><section id="pc11Group" hidden aria-label="Itens do pagamento agrupado"></section></article>';
 const $=id=>document.getElementById(id),form=$('pc11Filters');
 function message(text){$('pc11Message').textContent=text;}
 function locks(){for(const control of form.querySelectorAll('input,button'))control.disabled=busy;$('pc11Print').disabled=busy||!current;}
 function clear(){current=null;$('pc11Result').hidden=true;$('pc11Rows').replaceChildren();$('pc11Group').replaceChildren();$('pc11Group').hidden=true;locks();}
 async function api(path){const r=await fetch('/api/pc11'+path,{signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.erro||'Consulta indisponível');return data;}
 function fileLink(parent,label,path){const link=el('a',label);link.href='/api/pc11'+path;parent.append(link);}
 function receipt(cell,number){cell.append(el('span',number?`Recibo ${number}`:'Recibo indisponível'));}
 function applied(filters){const names={nome:'Nome',prestadorId:'Prestador',filialId:'Filial',inicio:'De',fim:'Até'};return Object.entries(names).filter(([key])=>filters[key]).map(([key,name])=>`${name}: ${filters[key]}`).join(' · ')||'Todos os prestadores e todo o período no escopo autorizado';}
 function render(data){
  $('pc11Applied').textContent=applied(data.filtros||{});
  for(const [target,key] of [['pc11Previous','saldoAnterior'],['pc11Final','saldoFinal'],['pc11Paid','totalPago'],['pc11Open','totalAberto'],['pc11Return','totalDevolver']])$(target).textContent=money(data[key]);
  $('pc11Receipts').textContent=data.integracaoRecibos==='PENDENTE_PC09'?'Referências de recibos aguardam a integração do módulo de recibos.':'';
  const rows=$('pc11Rows');rows.replaceChildren();
  for(const m of data.movimentos){
   const row=el('tr'),day=el('td'),person=el('td'),type=el('td'),origin=el('td');
   day.append(el('strong',m.DataEfetiva),el('small',`Registro UTC: ${m.RegistradoEmUtc}`));person.append(el('strong',m.Prestador),el('span',`${m.Filial} · ${m.Gestor}`));type.append(el('strong',m.Tipo),el('span',m.Atividade),el('small',`Serviço: ${m.DataServico}`));if(m.Motivo)type.append(el('small',m.Motivo));origin.append(el('strong',`Contratação ${m.Numero}`));receipt(origin,m.Recibo);
   if(m.PagamentoId){const button=el('button',`Consultar grupo ${m.PagamentoId}`);button.type='button';button.addEventListener('click',()=>group(String(m.PagamentoId)));origin.append(button);}
   if(flag(m.TemAnexo))fileLink(origin,`Comprovante do movimento ${m.MovimentoId}`,'/movimentos/'+encodeURIComponent(m.MovimentoId)+'/anexo');
   if(flag(m.TemAnexoPagamento))fileLink(origin,`Comprovante da contratação ${m.Numero}`,'/contratacoes/'+encodeURIComponent(m.ContratacaoId)+'/anexo');
   row.append(day,person,type,origin,el('td',money(m.Valor)),el('td',money(m.Saldo)));rows.append(row);
  }
  if(!data.movimentos.length){const row=el('tr'),cell=el('td','Nenhum movimento no período e filtros consultados.');cell.colSpan=6;row.append(cell);rows.append(row);}
  $('pc11Result').hidden=false;
 }
 async function load(){
  if(busy||!form.reportValidity())return;const params=new URLSearchParams();for(const [key,value] of new FormData(form))if(String(value).trim())params.set(key,String(value).trim());
  const stamp=++epoch;controller.abort();controller=new AbortController();clear();busy=true;locks();message('Consultando…');
  try{const data=await api('/extrato?'+params);if(stamp!==epoch)return;current=data;render(data);message('');}catch(error){if(stamp===epoch)message(error.message);}finally{if(stamp===epoch){busy=false;locks();}}
 }
 async function group(id){
  if(busy||!current)return;const stamp=epoch;busy=true;locks();$('pc11Group').hidden=true;message('Consultando itens autorizados…');
  try{const data=await api('/pagamentos/'+encodeURIComponent(id));if(stamp!==epoch)return;const box=$('pc11Group');box.replaceChildren(el('h3',`Pagamento agrupado ${id}`),el('p','Itens autorizados do grupo completo; pode incluir serviços fora dos filtros do extrato.'),el('p',`Total autorizado: ${money(data.total)}`));
   for(const item of data.itens){const line=el('p',`Contratação ${item.Numero} · ${item.Prestador} · ${item.Filial} · ${item.Gestor} · ${money(item.Valor)}. `);receipt(line,item.Recibo);if(flag(item.TemAnexoPagamento))fileLink(line,`Comprovante da contratação ${item.Numero}`,'/contratacoes/'+encodeURIComponent(item.ContratacaoId)+'/anexo');box.append(line);}box.hidden=false;message('');
  }catch(error){if(stamp===epoch)message(error.message);}finally{if(stamp===epoch){busy=false;locks();}}
 }
 form.addEventListener('submit',event=>{event.preventDefault();load();});
 $('pc11Print').addEventListener('click',()=>{if(current&&!busy)window.print();});
 window.addEventListener('jetta:pc11',()=>form.elements.nome.focus());
 window.addEventListener('jetta:auth',()=>{epoch++;controller.abort();controller=new AbortController();busy=false;clear();form.reset();message('');locks();});
 locks();
})();
