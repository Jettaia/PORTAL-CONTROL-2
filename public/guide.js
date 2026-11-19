// Portal guide: authored help content, scoped rendering, no operational requests.
(()=>{
 const root=document.getElementById('guidePage');if(!root)return;
 const images=[
 {
  "topic": "depositos",
  "step": 1,
  "file": "depositos-1.png",
  "caption": "Clique em Novo depósito para abrir o cadastro.",
  "external": false,
  "width": 1120,
  "height": 733,
  "focusX": 1019.0703125,
  "focusY": 199.59375
 },
 {
  "topic": "depositos",
  "step": 2,
  "file": "depositos-2.png",
  "caption": "Preencha o nome e o centro de custo da unidade.",
  "external": false,
  "width": 604,
  "height": 814,
  "focusX": 302,
  "focusY": 176.6171875
 },
 {
  "topic": "depositos",
  "step": 3,
  "file": "depositos-3.png",
  "caption": "Confira os campos de endereço antes de salvar.",
  "external": false,
  "width": 604,
  "height": 814,
  "focusX": 302,
  "focusY": 417.203125
 },
 {
  "topic": "depositos",
  "step": 4,
  "file": "depositos-4.png",
  "caption": "Após revisar os dados, clique em Cadastrar depósito.",
  "external": false,
  "width": 604,
  "height": 814,
  "focusX": 485.96875,
  "focusY": 746.5625
 },
 {
  "topic": "prestadores",
  "step": 1,
  "file": "prestadores-1.png",
  "caption": "Pesquise o documento para evitar um cadastro duplicado.",
  "external": false,
  "width": 1120,
  "height": 971,
  "focusX": 200.5,
  "focusY": 340.59375
 },
 {
  "topic": "prestadores",
  "step": 2,
  "file": "prestadores-2.png",
  "caption": "No formulário Novo prestador, preencha nome e documento.",
  "external": false,
  "width": 604,
  "height": 558,
  "focusX": 302,
  "focusY": 322.9296875
 },
 {
  "topic": "prestadores",
  "step": 3,
  "file": "prestadores-3.png",
  "caption": "Selecione ao menos um depósito autorizado.",
  "external": false,
  "width": 604,
  "height": 558,
  "focusX": 302,
  "focusY": 368.6640625
 },
 {
  "topic": "prestadores",
  "step": 4,
  "file": "prestadores-4.png",
  "caption": "Clique em Cadastrar prestador após conferir os vínculos.",
  "external": false,
  "width": 604,
  "height": 558,
  "focusX": 481.1640625,
  "focusY": 488.859375
 },
 {
  "topic": "atividades",
  "step": 1,
  "file": "atividades-1.png",
  "caption": "Busque no catálogo antes de criar um novo tipo.",
  "external": false,
  "width": 1120,
  "height": 927,
  "focusX": 205.5,
  "focusY": 282.59375
 },
 {
  "topic": "atividades",
  "step": 2,
  "file": "atividades-2.png",
  "caption": "Clique em Nova atividade e preencha nome e descrição.",
  "external": false,
  "width": 1076,
  "height": 652,
  "focusX": 703,
  "focusY": 371.3359375
 },
 {
  "topic": "atividades",
  "step": 3,
  "file": "atividades-3.png",
  "caption": "Clique em Criar atividade para salvar o tipo.",
  "external": false,
  "width": 1076,
  "height": 652,
  "focusX": 961.859375,
  "focusY": 497.671875
 },
 {
  "topic": "atividades",
  "step": 4,
  "file": "atividades-4.png",
  "caption": "Confira a situação Ativo no item salvo.",
  "external": false,
  "width": 1076,
  "height": 698,
  "focusX": 1003.3984375,
  "focusY": 198.796875
 },
 {
  "topic": "tablets",
  "step": 1,
  "file": "tablets-1.png",
  "caption": "Abra Novo tablet e dê um nome ao aparelho.",
  "external": false,
  "width": 644,
  "height": 519,
  "focusX": 322,
  "focusY": 171.390625
 },
 {
  "topic": "tablets",
  "step": 2,
  "file": "tablets-2.png",
  "caption": "Selecione os depósitos autorizados para este aparelho.",
  "external": false,
  "width": 644,
  "height": 519,
  "focusX": 322,
  "focusY": 283.0859375
 },
 {
  "topic": "tablets",
  "step": 3,
  "file": "tablets-3.png",
  "caption": "Clique em Cadastrar e gerar código. O código ativa o aparelho.",
  "external": false,
  "width": 644,
  "height": 519,
  "focusX": 511.1640625,
  "focusY": 450.5625
 },
 {
  "topic": "tablets",
  "step": 4,
  "file": "tablets-4.png",
  "caption": "Na tela do aparelho, informe o código recebido e clique em Autorizar tablet.",
  "external": false,
  "width": 584,
  "height": 525,
  "focusX": 292,
  "focusY": 355
 },
 {
  "topic": "tablets",
  "step": 5,
  "file": "tablets-5.png",
  "caption": "O prestador informa os quatro primeiros dígitos do CPF e confirma o registro.",
  "external": false,
  "width": 584,
  "height": 656,
  "focusX": 292,
  "focusY": 387.5
 },
 {
  "topic": "contratacoes",
  "step": 1,
  "file": "contratacoes-1.png",
  "caption": "Clique em Nova contratação.",
  "external": false,
  "width": 1120,
  "height": 806,
  "focusX": 1010.8125,
  "focusY": 232.59375
 },
 {
  "topic": "contratacoes",
  "step": 2,
  "file": "contratacoes-2.png",
  "caption": "Escolha depósito, prestador, atividade e gestor no formulário.",
  "external": false,
  "width": 604,
  "height": 676,
  "focusX": 168,
  "focusY": 172.890625
 },
 {
  "topic": "contratacoes",
  "step": 3,
  "file": "contratacoes-3.png",
  "caption": "Preencha os horários e o valor; depois clique em Criar contratação.",
  "external": false,
  "width": 604,
  "height": 676,
  "focusX": 493.3203125,
  "focusY": 607.203125
 },
 {
  "topic": "contratacoes",
  "step": 4,
  "file": "contratacoes-4.png",
  "caption": "Na aba Entrada e saída, acompanhe o código e os registros do serviço.",
  "external": false,
  "width": 924,
  "height": 1063,
  "focusX": 457,
  "focusY": 467.9921875
 },
 {
  "topic": "contratacoes",
  "step": 5,
  "file": "contratacoes-5.png",
  "caption": "Use Horários para consultar ou informar ajustes com justificativa.",
  "external": false,
  "width": 924,
  "height": 1063,
  "focusX": 457,
  "focusY": 588.984375
 },
 {
  "topic": "contratacoes",
  "step": 6,
  "file": "contratacoes-6.png",
  "caption": "Revise horários e valor antes de confirmar a liberação para o financeiro.",
  "external": false,
  "width": 924,
  "height": 1063,
  "focusX": 215.265625,
  "focusY": 781.6875
 },
 {
  "topic": "financeiro",
  "step": 1,
  "file": "financeiro-1.png",
  "caption": "Use os filtros para localizar a contratação liberada.",
  "external": false,
  "width": 1120,
  "height": 852,
  "focusX": 566,
  "focusY": 300.890625
 },
 {
  "topic": "financeiro",
  "step": 2,
  "file": "financeiro-2.png",
  "caption": "Confira o valor e clique em Gerar recibo. Isso ainda não confirma o pagamento.",
  "external": false,
  "width": 1076,
  "height": 586,
  "focusX": 955.4609375,
  "focusY": 468.5859375
 },
 {
  "topic": "financeiro",
  "step": 3,
  "file": "financeiro-3.png",
  "caption": "Documento real do portal com dados de treinamento. Pagamento e assinatura acontecem fora do sistema.",
  "external": true,
  "width": 818,
  "height": 1080,
  "focusX": 408.84375,
  "focusY": 862.28125
 },
 {
  "topic": "financeiro",
  "step": 4,
  "file": "financeiro-4.png",
  "caption": "Selecione o arquivo do recibo assinado, legível, em PDF, PNG ou JPEG.",
  "external": false,
  "width": 674,
  "height": 1063,
  "focusX": 332,
  "focusY": 987.390625
 },
 {
  "topic": "financeiro",
  "step": 5,
  "file": "financeiro-5.png",
  "caption": "Após conferir o recibo assinado, clique em Confirmar pagamento integral.",
  "external": false,
  "width": 674,
  "height": 1063,
  "focusX": 173.484375,
  "focusY": 887.1875
 }
];
 const topics=[
  {id:'depositos',title:'Cadastrar depósito',short:'Depósitos',role:'Administrador autorizado',purpose:'Comece pela unidade onde o serviço será realizado. O depósito conecta prestadores, tablets e contratações ao centro de custo correto.',before:'Tenha o nome, o centro de custo e o endereço completo da unidade. Seu acesso precisa permitir a manutenção de depósitos.',path:'Cadastros / Depósitos',steps:[['Abra o cadastro','Acesse Cadastros → Depósitos e clique em Novo depósito.'],['Identifique a unidade','Preencha nome e centro de custo. Confira se a unidade já está cadastrada antes de criar outra.'],['Informe o endereço','Preencha CEP, rua, número, bairro, cidade e UF. Confira os dados retornados pela consulta de CEP.'],['Confira e salve','Revise os dados e clique em Cadastrar depósito. Para alterar depois, use Editar depósito.']],check:'Localize a unidade na lista e confira o centro de custo, o endereço e a situação ativa.',example:[['Nome','Depósito Exemplo'],['Centro de custo','CC-EXEMPLO'],['Cidade / UF','Campinas / SP'],['Situação','Ativo']],faqs:[['Por que o endereço é importante?','A cidade e a UF do depósito são utilizadas na identificação do local no recibo.'],['Não vejo a opção de cadastro.','Confira com o administrador se seu usuário tem permissão para manter depósitos.']],tip:'Use o mesmo depósito do exemplo nas próximas etapas.'},
  {id:'prestadores',title:'Cadastrar prestador',short:'Prestadores',role:'Gestor ou administrador autorizado',purpose:'Cadastre quem vai executar o serviço e vincule essa pessoa aos depósitos onde poderá ser contratada.',before:'Tenha nome completo, CPF ou CNPJ e pelo menos um depósito ativo disponível no seu acesso.',path:'Cadastros / Prestadores',steps:[['Busque antes de cadastrar','Pesquise pelo CPF ou CNPJ para verificar se já existe um cadastro. Se existir, selecione-o e confira os vínculos.'],['Abra Novo prestador','Informe nome completo, CPF ou CNPJ e, se disponível, telefone.'],['Vincule os depósitos','Marque os depósitos em que o prestador vai atuar. O cadastro inicial exige ao menos um depósito.'],['Salve e confira','Clique em Cadastrar prestador e verifique os dados e depósitos vinculados no painel de cadastro.']],check:'O prestador deve estar ativo e vinculado ao depósito que será usado na contratação.',example:[['Nome completo','Prestador Exemplo'],['Documento','Documento fictício para treinamento'],['Depósito vinculado','Depósito Exemplo'],['Situação','Ativo']],faqs:[['O documento já está cadastrado. E agora?','Localize o cadastro existente e ajuste os vínculos permitidos. Não crie um cadastro duplicado.'],['Por que não aparece na contratação?','Confira se está ativo e vinculado ao depósito selecionado. Verifique também o alcance do seu usuário.']],tip:'O vínculo é essencial: estar cadastrado não basta para aparecer em qualquer depósito.'},
  {id:'atividades',title:'Cadastrar tipo de atividade',short:'Tipos de atividade',role:'Administrador autorizado',purpose:'Organize o catálogo de serviços que poderão ser selecionados em uma contratação, como carga ou descarga.',before:'Defina um nome claro para o serviço e confira se já existe uma atividade equivalente.',path:'Cadastros / Tipos de atividade',steps:[['Consulte o catálogo','Acesse Cadastros → Tipos de atividade e pesquise o nome do serviço.'],['Crie a atividade','Clique em Nova atividade e informe o nome. A descrição é opcional e pode explicar quando utilizar o tipo.'],['Salve o cadastro','Clique em Criar atividade. Para ajustar um item existente, selecione-o e use Salvar alterações.'],['Confira a situação','Verifique se o item está ativo para permitir novas contratações.']],check:'Pesquise o nome salvo e confira a descrição e a situação no painel lateral.',example:[['Nome','Descarga'],['Descrição','Descarga de mercadorias no depósito'],['Situação','Ativo']],faqs:[['Tipo de atividade e contratação são a mesma coisa?','Não. O tipo identifica o serviço no catálogo. A contratação registra quem fará esse serviço, onde, quando e por qual valor.'],['O que acontece ao inativar?','O tipo deixa de estar disponível para novos lançamentos. O histórico existente é preservado.']],tip:'Prefira nomes consistentes para evitar tipos diferentes descrevendo o mesmo serviço.'},
  {id:'tablets',title:'Cadastrar e ativar tablet',short:'Tablets',role:'Gestor ou administrador autorizado',purpose:'Autorize o aparelho usado pelos prestadores para registrar entrada e saída nos depósitos selecionados.',before:'Tenha o depósito cadastrado, o aparelho disponível e permissão para cadastrar tablets.',path:'Cadastros / Tablets',steps:[['Cadastre o aparelho','Acesse Tablets e abra Novo tablet. Informe um nome que ajude a identificar o aparelho.'],['Escolha os depósitos','Selecione os depósitos que esse tablet poderá atender e confira os centros de custo apresentados.'],['Gere o código de autorização','Clique em Cadastrar e gerar código. Use o código no aparelho que será autorizado.'],['Ative no aparelho','No tablet, abra a tela Autorizar este tablet, informe o código fornecido e confirme. Mantenha um perfil exclusivo, sem sessão administrativa.'],['Oriente o registro','Na tela Digite seu código, o prestador usa os quatro primeiros dígitos do CPF para registrar a entrada e, depois, a saída da contratação elegível.']],check:'Confira se o tablet aparece como Autorizado e se o aparelho mostra a tela Digite seu código.',example:[['Nome do tablet','Portaria — aparelho de exemplo'],['Depósito','Depósito Exemplo'],['Após ativação','Autorizado'],['Registro do prestador','Quatro primeiros dígitos do CPF']],faqs:[['O código do tablet é o mesmo do prestador?','Não. O código de autorização ativa o aparelho. Os quatro primeiros dígitos do CPF identificam o prestador no registro de entrada e saída.'],['Editei o cadastro do tablet. Preciso ativar de novo?','Sim. Salvar o cadastro invalida a autorização atual. Gere um novo código e ative novamente o aparelho.'],['O código de autorização expirou.','Gere um novo código na gestão de tablets e use-o no aparelho correto.']],tip:'Para este treinamento, simule a orientação ao prestador sem registrar uma operação real.'},
  {id:'contratacoes',title:'Criar e acompanhar contratação',short:'Contratação',role:'Gestor ou administrador autorizado',purpose:'Reúna o prestador, o serviço, a unidade, os horários e o valor em um registro que acompanha a execução até a liberação financeira.',before:'Depósito, prestador vinculado e tipo de atividade devem estar ativos. Confira o gestor responsável e o valor combinado.',path:'Operação / Contratações',steps:[['Abra uma nova contratação','Acesse Operação → Contratações e abra o formulário de criação.'],['Selecione os envolvidos','Escolha o depósito, o tipo de atividade, o gestor responsável e um prestador da lista de busca.'],['Defina horários e valor','Preencha entrada e saída previstas e o valor combinado. Confira todos os dados antes de clicar em Criar contratação.'],['Acompanhe a execução','Abra o detalhe e consulte Entrada e saída. O prestador registra os horários no tablet usando os quatro primeiros dígitos do CPF.'],['Resolva pendências de horário','Se precisar lançar ou corrigir horários manualmente, use Horários e acompanhe a aprovação quando exigida. Solicitações pendentes impedem a liberação.'],['Confira e libere','Com entrada e saída registradas, confira os horários e o valor no Resumo. Clique em Conferir e liberar para pagamento e confirme a liberação.']],check:'A contratação liberada deve aparecer no financeiro. Após a liberação, horários, valor e cancelamento ficam bloqueados.',example:[['Prestador / depósito','Prestador Exemplo / Depósito Exemplo'],['Tipo de atividade','Descarga'],['Previsão ilustrativa','08h às 12h'],['Valor combinado ilustrativo','R$ 150,00']],faqs:[['Por que não consigo liberar?','Confira se há entrada e saída registradas e se existe alguma solicitação de horários aguardando aprovação.'],['Liberação significa pagamento?','Não. A liberação envia a contratação para o financeiro. A baixa exige a confirmação do pagamento com o recibo assinado.']],tip:'Antes de liberar, revise os horários e o valor. Essa conferência evita retrabalho no financeiro.'},
  {id:'financeiro',title:'Do recibo à confirmação do pagamento',short:'Financeiro',role:'Financeiro ou administrador autorizado',purpose:'Acompanhe as contratações liberadas, emita o recibo e registre a baixa após o pagamento realizado fora do portal.',before:'A contratação deve ter sido conferida e liberada. Para concluir a baixa, tenha o recibo assinado e legível.',path:'Financeiro / Financeiro',steps:[['Localize a contratação liberada','Filtre por depósito, prestador, período ou número. Comece pela situação Aguardando pagamento.'],['Gere o recibo','Confira a contratação e o valor. Clique em Gerar recibo e imprima o documento. A situação passa para Recibo gerado; o valor continua pendente.'],['Realize o pagamento fora do portal','Siga o procedimento da empresa para pagar o prestador e colher a assinatura no recibo. O portal não realiza transferências bancárias.'],['Anexe o recibo assinado','Abra o detalhe da contratação e selecione o arquivo legível em PDF, PNG ou JPEG, com até 5 MiB.'],['Confirme e confira a baixa','Confirme o pagamento e verifique a situação Pago, o anexo e o histórico. O sistema utiliza a data de emissão original do recibo como data do pagamento.']],check:'Filtre pela situação Pago e abra o registro. Confira o recibo assinado, o valor e o histórico da confirmação.',example:[['Contratação ilustrativa','#EXEMPLO — Descarga'],['Valor ilustrativo','R$ 150,00'],['Antes da baixa','Recibo gerado'],['Após confirmar com anexo','Pago']],faqs:[['Gerar ou imprimir o recibo já dá baixa?','Não. A baixa acontece após anexar o recibo assinado e confirmar o pagamento.'],['Posso importar vários recibos assinados?','Sim. Use Importar recibos assinados para enviar um PDF. Confira cada identificação e assinatura na prévia antes de confirmar. A identificação automática não valida a assinatura.'],['Confirmei com o anexo errado.','Financeiro ou administrador autorizado pode substituir o anexo ou desfazer a baixa com motivo, preservando o histórico.'],['O gestor pode pagar pelo portal?','O gestor acompanha o financeiro dos depósitos autorizados. As operações financeiras são destinadas ao financeiro e ao administrador autorizado.']],tip:'Aguardando pagamento → Recibo gerado → Pago. Só a última situação representa baixa confirmada.'}
 ];
 const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{book:'<path d="M12 6v15M3 3h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v15h-5a4 4 0 0 0-4 3 4 4 0 0 0-4-3H3z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',check:'<path d="m5 12 4 4L19 6"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 0 1 5.6 1c0 2-2.8 2-2.8 4m0 3h.01"/>'}[name]||''}</svg>`;

 let selected=null;const done=new Set();
 const topicsForPage={depositos:'depositos',chapas:'prestadores',servicos:'atividades',tablets:'tablets',contratacoes:'contratacoes',pagamentos:'financeiro'};
 const help=document.getElementById('guideContextHelp');
 const imageDialog=document.createElement('dialog');imageDialog.id='guideImageDialog';imageDialog.setAttribute('aria-label','Captura ampliada do portal');
 imageDialog.innerHTML='<header><strong>Captura da tela real · dados de treinamento</strong><div><button type="button" data-image-size>Ampliar detalhes</button><button type="button" data-image-close aria-label="Fechar imagem ampliada">Fechar</button></div></header><div class="guide-image-viewport"><img alt=""></div><p class="guide-image-caption" aria-live="polite"></p>';
 document.body.append(imageDialog);
 const enlarged=imageDialog.querySelector('img'),viewport=imageDialog.querySelector('.guide-image-viewport'),sizeButton=imageDialog.querySelector('[data-image-size]');
 let enlargedImage=null,imageRequest=0,returnFocus=null,printJob=null;
 function imageSize(natural){imageDialog.classList.toggle('guide-image-natural',natural);sizeButton.textContent=natural?'Ver tela inteira':'Ampliar detalhes';if(natural&&enlargedImage){viewport.scrollLeft=Math.max(0,enlargedImage.focusX-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,enlargedImage.focusY-viewport.clientHeight/2);}}
 function cancelPrint(){const job=printJob;if(!job)return;printJob=null;job.container.remove();if(job.button.isConnected){job.button.disabled=false;job.button.textContent=job.label;}}
 function closeImage(){if(imageDialog.open)imageDialog.close();}
 imageDialog.querySelector('[data-image-close]').addEventListener('click',closeImage);
 sizeButton.addEventListener('click',()=>imageSize(!imageDialog.classList.contains('guide-image-natural')));
 imageDialog.addEventListener('click',event=>{if(event.target===imageDialog)closeImage();});
 imageDialog.addEventListener('close',()=>{imageRequest++;enlarged.removeAttribute('src');enlarged.alt='';enlargedImage=null;if(returnFocus?.isConnected&&!root.hidden&&window.jettaAccount)returnFocus.focus();returnFocus=null;});
 function openImage(key,button){const image=images.find(image=>image.topic+'-'+image.step===key);if(!image)return;const request=++imageRequest;enlargedImage=image;returnFocus=button;enlarged.src='/guide-images/'+image.file;enlarged.alt=image.caption;imageDialog.querySelector('.guide-image-caption').textContent=image.caption;imageDialog.showModal();imageSize(false);enlarged.decode().then(()=>{if(request===imageRequest&&imageDialog.open)imageSize(matchMedia('(max-width:760px)').matches);}).catch(()=>{if(request===imageRequest&&imageDialog.open)imageDialog.querySelector('.guide-image-caption').textContent='Não foi possível carregar esta captura. Feche a imagem e tente novamente.';});}

 function topicFromHash(){const id=location.hash.split('/')[1];return topics.some(topic=>topic.id===id)?id:null;}
 function setTopic(id,focus=true){selected=topics.some(topic=>topic.id===id)?id:null;const url=new URL(location.href);url.hash='guia'+(selected?'/'+selected:'');history.replaceState(null,'',url);render(focus);}
 function nav(){return `<nav class="guide-index" aria-label="Tutoriais"><button data-overview class="guide-index-home">Visão geral</button>${topics.map((t,i)=>`<button data-topic="${t.id}" ${selected===t.id?'aria-current="page"':''}><span class="guide-number">${done.has(t.id)?icon('check'):String(i+1).padStart(2,'0')}</span><span>${t.short}<small>${i<3?'Preparar cadastros':i===3?'Preparar o aparelho':i===4?'Executar o serviço':'Registrar a baixa'}</small></span>${icon('arrow')}</button>`).join('')}<p class="guide-progress">${done.size} de 6 tutoriais lidos nesta visita</p></nav>`;}
 function escapeText(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
 function screenshot(topic,index){const image=images.find(image=>image.topic===topic&&image.step===index+1);if(!image)return '';return '<figure class="guide-shot"><button type="button" class="guide-shot-open" data-guide-image="'+topic+'-'+(index+1)+'" aria-label="Ampliar captura do passo '+(index+1)+'"><img src="/guide-images/'+image.file+'" alt="'+escapeText(image.caption)+'" width="'+image.width+'" height="'+image.height+'" loading="'+(index?'lazy':'eager')+'" decoding="async"></button><figcaption>'+escapeText(image.caption)+'</figcaption><span class="guide-shot-hint">Clique na imagem para ampliar</span></figure>';}
 function article(t){return '<article class="guide-article"><header><p class="guide-location">'+t.path+'</p><h2 tabindex="-1" id="guideArticleTitle">'+t.title+'</h2><p class="guide-purpose">'+t.purpose+'</p><div class="guide-role">Quem faz: <strong>'+t.role+'</strong></div></header><div class="guide-before"><h3>Antes de começar</h3><p>'+t.before+'</p></div><div class="guide-lesson"><h3>Passo a passo</h3><p class="guide-shots-note">Telas reais do portal com dados de treinamento. Os destaques laranja mostram onde clicar ou preencher.</p><ol class="guide-steps">'+t.steps.map(([title,body],index)=>'<li><div class="guide-step-copy"><h4>'+title+'</h4><p>'+body+'</p></div>'+screenshot(t.id,index)+'</li>').join('')+'</ol><section class="guide-check"><h3>'+icon('check')+' Como saber se deu certo</h3><p>'+t.check+'</p></section><section class="guide-faq"><h3>Dúvidas comuns</h3>'+t.faqs.map(([q,a])=>'<details><summary>'+q+'</summary><p>'+a+'</p></details>').join('')+'</section></div><footer class="guide-article-footer"><button class="guide-secondary" data-done="'+t.id+'">'+icon('check')+(done.has(t.id)?'Marcar como não lido':'Marcar como lido')+'</button><button class="guide-primary" data-next>'+(topics.indexOf(t)===5?'Voltar à visão geral':'Próximo tutorial')+icon('arrow')+'</button></footer></article>';}
 function overview(){return `<div class="guide-overview"><div class="guide-intro"><h2>Do primeiro cadastro<br>ao pagamento.</h2><p>Entenda a sequência da operação e encontre a orientação certa para cada etapa.</p><button class="guide-primary" data-topic="depositos">Começar pelo depósito ${icon('arrow')}</button></div><div class="guide-overview-list">${topics.map((t,i)=>`<button data-topic="${t.id}"><span class="guide-number">${String(i+1).padStart(2,'0')}</span><span><strong>${t.title}</strong><small>${t.path}</small></span>${icon('arrow')}</button>`).join('')}</div><div class="guide-overview-note"><h3>Como as etapas se conectam</h3><p>Os cadastros preparam a operação. O tablet registra os horários da contratação. A conferência libera o serviço para o financeiro, que emite o recibo e registra a baixa.</p><p><strong>Importante:</strong> liberar a contratação e gerar o recibo ainda não confirmam o pagamento.</p></div></div>`;}

 function render(focus=false){
  if(!window.jettaAccount||root.hidden)return;cancelPrint();
  const topic=topics.find(topic=>topic.id===selected);
  root.innerHTML='<div class="guide-root"><div class="guide-heading"><p id="guidePrintStatus" role="status" aria-live="polite"></p><button class="guide-secondary" id="guidePrint" type="button">Imprimir '+(topic?'tutorial':'guia')+'</button></div><div class="guide-manual">'+nav()+'<div>'+(topic?article(topic):overview())+'</div></div></div>';
  root.querySelectorAll('[data-topic]').forEach(button=>button.addEventListener('click',()=>setTopic(button.dataset.topic)));
  root.querySelectorAll('[data-overview]').forEach(button=>button.addEventListener('click',()=>setTopic(null)));
  root.querySelector('[data-done]')?.addEventListener('click',event=>{const id=event.currentTarget.dataset.done;done.has(id)?done.delete(id):done.add(id);render();root.querySelector('[data-done]').focus();});
  root.querySelector('[data-next]')?.addEventListener('click',()=>{done.add(topic.id);setTopic(topics[topics.indexOf(topic)+1]?.id);});
  root.querySelectorAll('[data-guide-image]').forEach(button=>button.addEventListener('click',()=>openImage(button.dataset.guideImage,button)));
  root.querySelector('#guidePrint').addEventListener('click',async event=>{
   if(printJob)return;const button=event.currentTarget,label=button.textContent;button.disabled=true;button.textContent='Preparando impressão…';
   const print=document.createElement('div');print.id='guidePrintContent';print.innerHTML='<div class="guide-root">'+(topic?article(topic):topics.map(article).join(''))+'</div>';print.querySelectorAll('details').forEach(details=>details.open=true);print.querySelectorAll('img').forEach(image=>image.loading='eager');print.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));document.body.append(print);const job={container:print,button,label};printJob=job;
   try{await Promise.all([...print.querySelectorAll('img')].map(image=>image.decode()));if(printJob===job&&button.isConnected&&!root.hidden&&window.jettaAccount)window.print();}
   catch{if(printJob===job&&button.isConnected&&!root.hidden&&window.jettaAccount)root.querySelector('#guidePrintStatus').textContent='Não foi possível carregar as capturas para impressão. Tente novamente.';}
   finally{print.remove();if(printJob===job)printJob=null;if(button.isConnected){button.disabled=false;button.textContent=label;}}
  });
  if(focus){(root.querySelector('#guideArticleTitle')||document.getElementById('pageHeading')).focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'instant'});}
 }
 help.addEventListener('click',()=>{const id=topicsForPage[help.dataset.screen];if(!id||!window.jettaAccount)return;const url=new URL(location.href);url.hash='guia/'+id;history.replaceState(null,'',url);window.dispatchEvent(new CustomEvent('jetta:go',{detail:'guia'}));root.querySelector('#guideArticleTitle')?.focus();});
 window.addEventListener('jetta:page',event=>{const page=event.detail;if(page!=='guia'){closeImage();cancelPrint();}help.hidden=!window.jettaAccount||!topicsForPage[page];help.dataset.screen=page;if(page==='guia'){selected=topicFromHash();render();}});
 window.addEventListener('jetta:auth',event=>{if(!event.detail){closeImage();cancelPrint();done.clear();selected=null;root.replaceChildren();help.hidden=true;}});
 if(window.jettaAccount&&!root.hidden){selected=topicFromHash();render();}
})();
