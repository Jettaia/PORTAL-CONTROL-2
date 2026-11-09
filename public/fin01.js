(()=>{
 const root=document.getElementById('fin01Page');if(!root)return;
 const batchErrors={PREVIA_ALTERADA:'Dados alterados; confira uma nova prévia.',PREVIA_EXPIRADA:'A prévia expirou. Gere uma nova prévia do período.',PREVIA_INVALIDA:'A prévia está indisponível. Gere uma nova prévia do período.',PREVIA_DE_OUTRO_USUARIO:'Gere uma nova prévia com o usuário conectado.',PERIODO_MUITO_EXTENSO:'O período é muito extenso. Divida em períodos menores.',RECIBO_INDISPONIVEL:'Não foi possível emitir este recibo. Tente novamente.',PERMISSAO_NEGADA:'Seu perfil não permite esta operação.',MFA_RECENTE_OBRIGATORIO:'Valide a autenticação para continuar.',DATA_INVALIDA:'Informe as datas de início e fim válidas.',PERIODO_INVALIDO:'O fim do período deve ser igual ou posterior ao início.'};
 const labels={AGUARDANDO_PAGAMENTO:'Aguardando pagamento',RECIBO_GERADO:'Recibo gerado',PAGO:'Pago'};
 let pendingStatementDetail=null;
 let canOperate=false,catalogOperate=false;
 let batchVersion=0,batchBusy=false,batchPreview=null,batchResults=[];
 let exportBusy=false,exportVersion=0,listBusy=false,exportReady=false;
 let rows=[],next=null,applied='',generation=0,detailGeneration=0,controller=new AbortController();
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const statusBadge=state=>el('span',labels[state]||'Situação indisponível','fin01-badge fin01-badge--'+({AGUARDANDO_PAGAMENTO:'pendente',RECIBO_GERADO:'recibo',PAGO:'pago'}[state]||'neutra'));
 root.innerHTML='<header class="fin01-heading"><h2>Financeiro de contratações</h2><p>Consulte as contratações liberadas. Pendências aparecem pela liberação mais antiga.</p></header><form id="fin01Filters" class="fin01-grid"><label>Número da contratação<input name="numero" inputmode="numeric" pattern="[1-9][0-9]*" placeholder="Número exato"></label><label>Depósito<select name="depositoId" aria-label="Depósito"><option value="">Todos autorizados</option></select></label><label>Prestador<select name="prestadorId" aria-label="Prestador"><option value="">Todos autorizados</option></select></label><label>Serviço desde<input name="inicio" type="date"></label><label>Serviço até<input name="fim" type="date"></label><label>Situação<select name="situacao" aria-label="Situação"><option value="">Todas</option><option value="AGUARDANDO_PAGAMENTO" selected>Aguardando pagamento</option><option value="RECIBO_GERADO">Recibo gerado</option><option value="PAGO">Pago</option></select></label><div class="fin01-actions"><button>Aplicar filtros</button><button type="button" id="fin01Clear" class="secondary">Limpar filtros</button></div></form><p class="fin01-period">O período considera a data do serviço.</p><div class="fin01-actions"><button type="button" id="fin02BatchStart" hidden>Gerar recibos do período</button></div><section id="fin02Batch" aria-label="Lote de recibos" aria-live="polite"></section><div class="fin01-toolbar"><h3>Contratações</h3><details class="fin01-export"><summary aria-label="Exportar financeiro">Exportar</summary><button type="button" data-fin01-export="xlsx">Exportar em Excel</button><button type="button" data-fin01-export="pdf">Exportar em PDF</button></details></div><p id="fin01Message" role="status" aria-live="polite"></p><div class="fin01-scroll" tabindex="0" role="region" aria-label="Contratações liberadas"><table><thead><tr><th>Número</th><th>Prestador</th><th>Depósito</th><th>Atividade</th><th>Data do serviço</th><th>Valor liberado</th><th>Liberação</th><th>Situação</th><th>Consulta</th><th>Recibo</th></tr></thead><tbody id="fin01Rows"></tbody></table></div><button type="button" id="fin01More" hidden>Carregar mais</button><section id="fin01Detail" aria-label="Detalhe financeiro" aria-live="polite"></section>';
 const $=id=>document.getElementById(id),form=$('fin01Filters'),message=text=>$('fin01Message').textContent=text;
 function exportControls(){root.querySelectorAll('[data-fin01-export]').forEach(button=>button.disabled=exportBusy||listBusy||!exportReady);}
 function resetExport(){exportVersion++;exportBusy=false;exportControls();}
 function currentFilters(){return new URLSearchParams([...new FormData(form)].filter(([,value])=>value)).toString();}
 async function exportFinance(format){
  if(exportBusy||listBusy||!exportReady||root.hidden||document.hidden)return;
  if(currentFilters()!==applied){message('Aplique os filtros alterados antes de exportar.');return;}
  const stamp=++exportVersion,revision=generation,signal=controller.signal,kind=format==='pdf'?'PDF':'Excel',mime=format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const valid=()=>stamp===exportVersion&&revision===generation&&!signal.aborted&&!root.hidden&&!document.hidden;
  exportBusy=true;exportControls();root.querySelector('.fin01-export').open=false;message('Preparando arquivo '+kind+'…');
  try{
   const response=await fetch('/api/financeiro/contratacoes/exportar.'+format+(applied?'?'+applied:''),{signal,credentials:'same-origin',cache:'no-store'});
   if(!valid())return;
   if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.erro==='EXPORTACAO_PDF_OCUPADA'?'Já existe uma exportação PDF em andamento. Tente novamente em instantes.':data.erro==='EXPORTACAO_MUITOS_REGISTROS'?'Há muitos registros para exportar. Use filtros mais específicos e tente novamente.':'Não foi possível exportar. Tente novamente em instantes.');}
   if(response.headers.get('content-type')?.split(';')[0].trim()!==mime)throw Error('O servidor não retornou um arquivo '+kind+' válido.');
   const blob=await response.blob();if(!valid())return;
   const filename=/filename="([^"\\/]+)"/.exec(response.headers.get('content-disposition')||'')?.[1];
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename&&/^[A-Za-z0-9_.-]+$/.test(filename)&&filename.endsWith('.'+format)?filename:'financeiro.'+format;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Arquivo '+kind+' exportado.');
  }catch(error){if(valid()&&error.name!=='AbortError')message(error.message);}
  finally{if(stamp===exportVersion){exportBusy=false;exportControls();}}
 }
 root.querySelectorAll('[data-fin01-export]').forEach(button=>button.addEventListener('click',()=>exportFinance(button.dataset.fin01Export)));
 new MutationObserver(()=>{if(root.hidden)resetExport();}).observe(root,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)resetExport();});
 exportControls();
 const serviceDate=value=>value?value.split('-').reverse().join('/'):'—';
 const timestamp=value=>value?new Date(value.slice(0,23)+'Z').toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
 const amount=value=>'R$ '+String(value??'0.00').replace('.',',');
 async function api(path,method='GET',body={}){const response=await fetch('/api/financeiro'+path,{signal:controller.signal,credentials:'same-origin',cache:'no-store',method,...(method==='POST'?{headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok){const error=Error(batchErrors[data.erro]||data.erro||'Não foi possível consultar o financeiro.');error.codigo=data.codigo||data.erro;throw error;}return data;}
 function render(){const target=$('fin01Rows');target.replaceChildren();
  if(!rows.length){const tr=el('tr'),td=el('td','Nenhuma contratação encontrada para os filtros informados.');td.colSpan=10;tr.append(td);target.append(tr);}
  for(const row of rows){const tr=el('tr');tr.dataset.contract=row.ContratacaoId;
   for(const text of [row.Numero,row.Prestador,row.Deposito,row.Tipo,serviceDate(row.DataServico),amount(row.ValorLiberado),timestamp(row.LiberadoEmUtc)])tr.append(el('td',text));
   const status=el('td'),badge=statusBadge(row.Situacao);status.append(badge);tr.append(status);
   const td=el('td'),button=el('button','Detalhes');button.type='button';button.setAttribute('aria-label','Detalhes da contratação '+row.Numero);button.addEventListener('click',()=>detail(row.ContratacaoId));td.append(button);tr.append(td);
   const receiptCell=el('td');
   if(row.ReciboId){const link=el('a','Abrir recibo','fin02-print');link.href='/api/financeiro/contratacoes/'+encodeURIComponent(row.ContratacaoId)+'/recibo/impressao';link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','Abrir recibo da contratação '+row.Numero);receiptCell.append(link);}
   else if(canOperate){const emit=el('button','Gerar recibo');emit.type='button';emit.setAttribute('aria-label','Gerar recibo da contratação '+row.Numero);emit.addEventListener('click',()=>generateReceipt(row.ContratacaoId,emit,$('fin01Message')));receiptCell.append(emit);}
   else receiptCell.textContent='Ainda não emitido';
   tr.append(receiptCell);target.append(tr);
  }$('fin01More').hidden=!next;
 }
 function batchReset(){batchVersion++;batchPreview=null;batchResults=[];$('fin02Batch').replaceChildren();}
 function batchControls(){ $('fin02BatchStart').hidden=!catalogOperate;$('fin02BatchStart').disabled=batchBusy; }
 function batchTable(records,result=false){
  const scroll=el('div',undefined,'fin01-scroll'),table=el('table'),head=el('thead'),hr=el('tr'),body=el('tbody');
  for(const label of result?['Contratação','Resultado','Detalhe']:['Contratação','Prestador','Depósito','Data do serviço','Valor liberado'])hr.append(el('th',label));head.append(hr);table.append(head,body);
  for(const r of records){const tr=el('tr');for(const value of result?[r.numero,{GERADO:'Gerado',JA_EMITIDO:'Já emitido',FALHA:'Falha'}[r.estado]||r.estado,batchErrors[r.erro]||r.erro||'']:[r.Numero,r.Prestador,r.Deposito,serviceDate(r.DataServico),amount(r.ValorLiberado)])tr.append(el('td',value));body.append(tr);}scroll.append(table);return scroll;
 }
 function batchButton(text,action){const button=el('button',text);button.type='button';button.disabled=batchBusy;button.addEventListener('click',action);return button;}
 function showBatchResults(summary){const target=$('fin02Batch');target.replaceChildren(el('h3','Resultado da geração'),el('p',summary),el('p','A geração do recibo não confirma o pagamento.'),batchTable(batchResults,true));const actions=el('div',undefined,'fin01-actions');
  if(batchPreview&&batchResults.some(r=>r.estado==='FALHA'&&r.erro!=='PREVIA_ALTERADA'))actions.append(batchButton('Tentar novamente pendentes',runBatch));
  if(batchResults.some(r=>r.erro==='PREVIA_ALTERADA')){target.append(el('p','A prévia foi alterada. Gere uma nova prévia do período antes de confirmar.'));actions.append(batchButton('Gerar nova prévia',previewBatch));}
  if(batchResults.some(r=>['GERADO','JA_EMITIDO'].includes(r.estado)))actions.append(batchButton('Imprimir recibos gerados',printBatch));target.append(actions);
 }
 async function previewBatch(){if(batchBusy||!catalogOperate)return;batchReset();const target=$('fin02Batch'),inicio=form.elements.inicio.value,fim=form.elements.fim.value;
  if(!inicio||!fim){target.append(el('p','Informe o início e o fim do período.'));return;}
  if(fim<inicio){target.append(el('p','O fim do período deve ser igual ou posterior ao início.'));return;}
  const query=new URLSearchParams({inicio,fim});for(const name of ['depositoId','prestadorId','numero'])if(form.elements[name].value)query.set(name,form.elements[name].value);
  if(form.elements.numero.value&&!/^[1-9]\d*$/.test(form.elements.numero.value)){target.append(el('p','Informe um número de contratação válido.'));return;}
  const stamp=batchVersion,requestSignal=controller.signal;batchBusy=true;batchControls();target.append(el('p','Consultando todas as contratações do período…'));
  try{const data=await api('/recibos/previa?'+query);if(stamp!==batchVersion)return;target.replaceChildren(el('h3','Prévia do lote'),el('p','Inclui somente contratações liberadas sem recibo no período, independentemente do filtro Situação. O período inclui as duas datas.'));
   if(!data.quantidade){target.append(el('p','Nenhuma contratação liberada sem recibo neste período.'));return;}
   batchPreview=data.previa;target.append(el('p',data.quantidade+' contratações; total '+amount(data.total)+'. '+data.jaEmitidos+' já possuem recibo e ficam fora do lote.'),batchTable(data.registros));batchBusy=false;
   const actions=el('div',undefined,'fin01-actions');actions.append(batchButton('Confirmar geração',runBatch),batchButton('Cancelar',()=>{batchReset();batchControls();}));target.append(actions);
  }catch(error){if(stamp===batchVersion&&error.name!=='AbortError')target.replaceChildren(el('p',error.message));}
  finally{if(!requestSignal.aborted){batchBusy=false;batchControls();}}
 }
 async function runBatch(){if(batchBusy||!batchPreview||!catalogOperate)return;const stamp=batchVersion,token=batchPreview,requestSignal=controller.signal;batchBusy=true;batchControls();$('fin02Batch').querySelectorAll('button').forEach(b=>b.disabled=true);
  try{const data=await api('/recibos/gerar','POST',{previa:token});if(stamp!==batchVersion)return;batchResults=data.resultados;batchBusy=false;showBatchResults(data.gerados+' gerados; '+data.ignorados+' já emitidos; '+data.falhas+' falhas.');await load();}
  catch(error){if(stamp===batchVersion&&error.name!=='AbortError'){batchBusy=false;if(['PREVIA_ALTERADA','PREVIA_EXPIRADA','PREVIA_INVALIDA','PREVIA_DE_OUTRO_USUARIO'].includes(error.codigo)||error.message.includes('PREVIA_ALTERADA')){batchPreview=null;if(batchResults.length){showBatchResults(error.message);$('fin02Batch').append(batchButton('Gerar nova prévia',previewBatch));}else $('fin02Batch').replaceChildren(el('p',error.codigo==='PREVIA_ALTERADA'?'A prévia foi alterada. Gere uma nova prévia do período antes de confirmar.':error.message),batchButton('Gerar nova prévia',previewBatch));return;}showBatchResults('Não foi possível concluir a geração: '+error.message);if(!batchResults.length)$('fin02Batch').append(batchButton('Tentar novamente pendentes',runBatch));}}
  finally{if(!requestSignal.aborted){batchBusy=false;batchControls();$('fin02Batch').querySelectorAll('button').forEach(b=>b.disabled=false);}}
 }
 async function printBatch(){if(batchBusy||!catalogOperate)return;const ids=batchResults.filter(r=>['GERADO','JA_EMITIDO'].includes(r.estado)).map(r=>String(r.contratacaoId));if(!ids.length)return;
  const popup=window.open('about:blank','_blank');if(!popup){$('fin02Batch').append(el('p','Permita a abertura de janelas para imprimir os recibos.'));return;}popup.opener=null;const stamp=batchVersion,requestSignal=controller.signal;batchBusy=true;batchControls();$('fin02Batch').querySelectorAll('button').forEach(b=>b.disabled=true);
  try{const response=await fetch('/api/financeiro/recibos/impressao',{signal:controller.signal,credentials:'same-origin',cache:'no-store',method:'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify({contratacaoIds:ids})});if(!response.ok)throw Error('Não foi possível preparar a impressão.');const html=await response.text();if(stamp!==batchVersion){popup.close();return;}popup.addEventListener('load',()=>{if(!popup.closed){popup.focus();popup.print();}},{once:true});popup.document.open();popup.document.write(html);popup.document.close();}
  catch(error){popup.close();if(stamp===batchVersion&&error.name!=='AbortError')$('fin02Batch').append(el('p',error.message));}
  finally{if(!requestSignal.aborted){batchBusy=false;batchControls();$('fin02Batch').querySelectorAll('button').forEach(b=>b.disabled=false);}}
 }
 $('fin02BatchStart').addEventListener('click',previewBatch);
 for(const event of ['input','change'])form.addEventListener(event,()=>{batchReset();batchControls();});
 async function generateReceipt(key,button,feedback){
  if(button.disabled)return;const stamp=detailGeneration,listStamp=generation;
  button.disabled=true;feedback.textContent='Gerando recibo…';
  try{await api('/contratacoes/'+encodeURIComponent(key)+'/recibo','POST');if(stamp!==detailGeneration||listStamp!==generation){if(button.isConnected&&listStamp===generation)feedback.textContent='Recibo gerado. Atualize a consulta para visualizá-lo.';return;}await load();await detail(key);}
  catch(error){if(stamp===detailGeneration&&listStamp===generation&&error.name!=='AbortError'){feedback.textContent=error.message;button.disabled=false;}}
  finally{if(button.isConnected)button.disabled=false;}
 }
 async function detail(key){const stamp=++detailGeneration,target=$('fin01Detail');target.replaceChildren(el('p','Consultando detalhes…'));
  try{const {registro:r,podeOperar}=await api('/contratacoes/'+encodeURIComponent(key));if(stamp!==detailGeneration)return;
   target.replaceChildren(el('h3','Contratação '+r.Numero));const close=el('button','Fechar detalhes');close.type='button';close.addEventListener('click',()=>{detailGeneration++;target.replaceChildren();root.querySelector(`[data-contract="${key}"] button`)?.focus();});target.append(close);
   const dl=el('dl');
   for(const [label,value] of [['Prestador',r.Prestador],['Depósito',r.Deposito],['Centro de custo',r.CentroCusto],['Cidade / UF',r.Cidade+' / '+r.Estado],['Atividade',r.Tipo],['Data do serviço',serviceDate(r.DataServico)],['Valor liberado',amount(r.ValorLiberado)],['Situação',labels[r.Situacao]],['Responsável pela liberação',r.LiberadoPor||'Não identificado'],['Liberado em (Brasília)',timestamp(r.LiberadoEmUtc)],['Gestor responsável',r.GestorResponsavel],['Início previsto',r.InicioPrevisto?.replace('T',' ')],['Fim previsto',r.FimPrevisto?.replace('T',' ')],['Entrada real',r.EntradaReal?.replace('T',' ')],['Saída real',r.SaidaReal?.replace('T',' ')]]){const dd=el('dd');if(label==='Situação')dd.append(statusBadge(r.Situacao));else dd.textContent=value||'—';dl.append(el('dt',label),dd);}target.append(dl);
   const receiptActions=el('div',undefined,'fin01-actions'),receiptMessage=el('p');receiptMessage.setAttribute('role','status');receiptMessage.setAttribute('aria-live','polite');
   if(r.ReciboId){
    target.append(el('p','Recibo emitido em '+serviceDate(r.DataEmissao)+'.'+(r.Situacao==='PAGO'?'':' O valor continua pendente até a confirmação do pagamento com recibo assinado.')));
    if(r.ReciboCompativel===false||r.ReciboCompativel===0)target.append(el('p','A contratação mudou após a emissão. O recibo original foi preservado; não pode ser usado para baixar uma origem divergente.'));
    const link=el('a','Abrir recibo para impressão','fin02-print');link.href='/api/financeiro/contratacoes/'+encodeURIComponent(key)+'/recibo/impressao';link.target='_blank';link.rel='noopener';receiptActions.append(link);
   }else if(podeOperar){
    const emit=el('button','Gerar recibo');emit.type='button';receiptActions.append(emit);
    emit.addEventListener('click',()=>generateReceipt(key,emit,receiptMessage));
   }
   target.append(receiptActions,receiptMessage);await paymentDetail(key,r,podeOperar,target,stamp);if(stamp===detailGeneration)target.scrollIntoView({block:'nearest'});
  }catch(error){if(stamp===detailGeneration&&error.name!=='AbortError')target.replaceChildren(el('p',error.message));}
 }
 async function paymentDetail(key,r,podeOperar,target,stamp){
  const box=el('section',undefined,'fin03-payment');box.setAttribute('aria-label','Pagamento e evidências');target.append(box);
  try{
   const data=await api('/contratacoes/'+encodeURIComponent(key)+'/pagamento');if(stamp!==detailGeneration)return;
   const payment=data.pagamento;box.append(el('h4','Pagamento e evidências'));
   if(payment)box.append(el('p','Data do pagamento: '+serviceDate(payment.DataPagamento)),el('p','Valor integral: '+amount(payment.Valor)),el('p','Confirmado no sistema em '+timestamp(payment.ConfirmadoEmUtc)+' (Brasília).'));
   const attachments=el('ul');for(const [i,a] of (data.anexos||[]).entries()){
    const item=el('li'),link=el('a','Baixar '+a.Nome+' — versão '+(i+1));link.href='/api/financeiro/contratacoes/'+encodeURIComponent(key)+'/anexos/'+encodeURIComponent(a.AnexoId);item.append(link);attachments.append(item);
   }if(attachments.childElementCount)box.append(attachments);
   const feedback=el('p');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');box.append(feedback);
   let busy=false;
   const mutate=async(suffix,body,button)=>{
    if(busy||stamp!==detailGeneration)return;busy=true;const controls=[...box.querySelectorAll('input,button')],disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);feedback.textContent='Registrando…';
    try{await api('/contratacoes/'+encodeURIComponent(key)+'/pagamento'+suffix,'POST',body);if(stamp!==detailGeneration)return;await load();await detail(key);}
    catch(error){if(stamp===detailGeneration&&error.name!=='AbortError'){feedback.textContent=error.message;controls.forEach((c,i)=>c.disabled=disabled[i]);button.disabled=false;}}
    finally{busy=false;}
   };
   function upload(labelText,buttonText,suffix){
    const form=el('form',undefined,'fin03-form'),label=el('label',labelText),input=el('input');input.type='file';input.accept='.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';label.append(input);
    const hint=el('p','PDF, PNG ou JPEG, até 5 MiB. Anexe o recibo assinado, legível.','fin01-period'),button=el('button',buttonText);button.disabled=true;
    input.addEventListener('change',()=>{button.disabled=!input.files.length;feedback.textContent='';});
    form.append(label,hint,button);box.append(form);
    form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;const file=input.files[0];if(!file)return;
     if(file.size===0||file.size>5*1024*1024||!['application/pdf','image/png','image/jpeg'].includes(file.type)){feedback.textContent='Selecione PDF, PNG ou JPEG de até 5 MiB.';return;}
     button.disabled=true;input.disabled=true;
     try{
      const conteudoBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});
      if(stamp!==detailGeneration)return;input.disabled=false;button.disabled=false;
      await mutate(suffix,{...(payment?{baixaId:payment.BaixaId,anexoId:payment.AnexoId}:{reciboId:r.ReciboId,baixaAnteriorId:data.ultimaBaixaId??null}),arquivo:{nome:file.name,tipo:file.type,conteudoBase64}},button);
     }catch(error){if(stamp===detailGeneration){feedback.textContent=error.message;button.disabled=false;input.disabled=false;}}
    });
   }
   if(podeOperar&&data.podeOperar){
    if(payment){
     upload('Novo recibo assinado','Substituir anexo','/anexo');
     const form=el('form',undefined,'fin03-form'),label=el('label','Motivo do desfazimento'),reason=el('input'),undo=el('button','Desfazer baixa');reason.type='text';reason.maxLength=800;reason.required=true;label.append(reason);undo.className='secondary';undo.disabled=true;
     reason.addEventListener('input',()=>undo.disabled=!reason.value.trim());form.append(label,el('p','A correção restaura a pendência e mantém o recibo e o histórico.'),undo);box.append(form);
     form.addEventListener('submit',event=>{event.preventDefault();if(reason.value.trim())mutate('/desfazer',{baixaId:payment.BaixaId,anexoId:payment.AnexoId,motivo:reason.value.trim()},undo);});
    }else if(r.ReciboId&&r.ReciboCompativel!==false&&r.ReciboCompativel!==0)upload('Recibo assinado','Confirmar pagamento integral','');
   }
   box.append(el('h4','Histórico financeiro'));const history=el('ol');
   const actions={FIN02_EMITIR:'Recibo emitido',FIN03_CONFIRMAR:'Pagamento confirmado',FIN03_DESFAZER:'Baixa desfeita',FIN03_SUBSTITUIR:'Anexo substituído'};
   for(const item of data.historico||[]){let details={};try{details=JSON.parse(item.DetalhesJson||'{}');}catch{}const actor=details.ator?.nome||item.AtorNome||'Usuário não identificado';history.append(el('li',(actions[item.Acao]||item.Acao)+' — '+actor+' — '+timestamp(item.CriadoEmUtc)+(details.motivo||item.Motivo?' — '+(details.motivo||item.Motivo):'')));}
   box.append(history.childElementCount?history:el('p','Nenhuma ação financeira registrada.'));
  }catch(error){if(stamp===detailGeneration&&error.name!=='AbortError')box.replaceChildren(el('p','Não foi possível consultar pagamento e evidências: '+error.message));}
 }
 async function load(more=false){resetExport();listBusy=true;exportReady=false;exportControls();const stamp=++generation;detailGeneration++;$('fin01Detail').replaceChildren();
  if(!more){applied=new URLSearchParams([...new FormData(form)].filter(([,value])=>value)).toString();rows=[];next=null;render();}
  const query=new URLSearchParams(applied);if(more&&next)query.set('cursor',next);
  $('fin01More').disabled=true;message('Consultando…');
  try{const data=await api('/contratacoes?'+query);if(stamp!==generation)return;
   exportReady=true;canOperate=data.podeOperar===true;rows=more?[...new Map([...rows,...data.registros].map(r=>[String(r.ContratacaoId),r])).values()]:data.registros;next=data.proximaPagina;render();message('Consulta atualizada.');
  }catch(error){if(stamp!==generation||error.name==='AbortError')return;rows=[];next=null;render();message(error.message);
  }finally{if(stamp===generation){listBusy=false;exportControls();$('fin01More').disabled=false;}}
 }
 function options(name,values,key){const select=form.elements[name],selected=select.value;select.replaceChildren(new Option('Todos autorizados',''),...values.map(row=>new Option(row.Nome,row[key])));if([...select.options].some(o=>o.value===selected))select.value=selected;}
 form.addEventListener('submit',event=>{event.preventDefault();load();});$('fin01More').addEventListener('click',()=>load(true));
 $('fin01Clear').addEventListener('click',()=>{form.reset();batchReset();batchControls();load();});
 window.addEventListener('jetta:fin01',async()=>{const signal=controller.signal;
  try{const data=await api('/catalogo');if(signal.aborted)return;catalogOperate=data.podeOperar===true;batchControls();options('depositoId',data.depositos,'DepositoId');options('prestadorId',data.prestadores,'PrestadorId');await load();if(!signal.aborted&&pendingStatementDetail){const key=pendingStatementDetail;pendingStatementDetail=null;await detail(key);}}catch(error){if(!signal.aborted)message(error.message);}
 });
 window.addEventListener('jetta:fin01-open',event=>{const key=String(event.detail??'');if(!/^[1-9]\d*$/.test(key)||!window.jettaAccount?.fin01)return;pendingStatementDetail=key;window.dispatchEvent(new CustomEvent('jetta:go',{detail:'pagamentos'}));});
 window.addEventListener('jetta:auth',()=>{exportReady=false;listBusy=false;resetExport();pendingStatementDetail=null;canOperate=false;catalogOperate=false;batchReset();batchBusy=false;batchControls();generation++;detailGeneration++;controller.abort();controller=new AbortController();rows=[];next=null;applied='';form.reset();options('depositoId',[],'DepositoId');options('prestadorId',[],'PrestadorId');$('fin01Detail').replaceChildren();render();message('');});
})();
