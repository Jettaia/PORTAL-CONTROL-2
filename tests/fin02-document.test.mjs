import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReceipt} from '../src/fin02-document.js';
const receipt=value=>({DataEmissao:'2026-11-09',Snapshot:{Numero:'4',ValorLiberado:value,Deposito:'Floripa',CentroCusto:'CC-20',Rua:'Rua teste',NumeroEndereco:'10',Bairro:'Centro',Cidade:'Florianópolis',Estado:'SC',CEP:'13178574',Pagador:'JETTA TRANSPORTES E LOGISTICA LTDA',CnpjPagador:'15.387.508/0001-61',Tipo:'Carregamento de caminhão',DataServico:'2026-11-10',Prestador:'Prestador sintético'}});
test('RECIBO separado do número dinâmico no cabeçalho e dados preservados',()=>{const r=receipt('100.00');r.Snapshot.Prestador='<script>indevido</script>';const html=renderReceipt(r);assert.match(html,/<title>Recibo<\/title>/);assert.match(html,/<h1>RECIBO<\/h1>/);assert.ok(html.indexOf('Floripa')<html.indexOf('<h1>'));assert.ok(html.includes('Contratação 4'));assert.ok(html.includes('&lt;script&gt;indevido&lt;/script&gt;'));assert.ok(html.includes('R$ 100,00'));});

for(const number of ['4','17','238'])test('cabeçalho usa o número real '+number,()=>{const r=receipt('100.00');r.Snapshot.Numero=number;const html=renderReceipt(r);assert.ok(html.includes('<div class="contract-number">Contratação '+number+'</div>'));assert.ok(html.indexOf('Contratação '+number)<html.indexOf('Floripa'));assert.match(html,/<h1>RECIBO<\/h1>/);});
