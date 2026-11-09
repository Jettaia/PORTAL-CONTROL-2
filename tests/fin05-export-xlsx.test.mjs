import test from 'node:test';
import assert from 'node:assert/strict';
import {statementWorkbook} from '../src/fin05-export-xlsx.js';
function entries(buffer){const files=new Map();let offset=0;while(buffer.readUInt32LE(offset)===0x04034b50){const size=buffer.readUInt32LE(offset+18),name=buffer.readUInt16LE(offset+26),extra=buffer.readUInt16LE(offset+28),start=offset+30+name+extra;files.set(buffer.subarray(offset+30,offset+30+name).toString(),buffer.subarray(start,start+size).toString());offset=start+size;}assert.equal(buffer.readUInt32LE(offset),0x02014b50);return files;}
const values={ValorDevido:'100.25',ValorPago:'25.00',Saldo:'75.25'};
const report={geradoEm:'09/11/2026 16:00:00',filtrosTexto:'Todos autorizados',totais:values,depositos:[{DepositoId:1,Deposito:'Sumaré',...values},{DepositoId:2,Deposito:'Floripa',...values}],prestadores:[{DepositoId:1,PrestadorId:1,Prestador:'João & Filhos',CPF:'01234567890',QuantidadeContratacoes:1,...values},{DepositoId:1,PrestadorId:2,Prestador:'Sem movimento',CPF:'00123456000199',QuantidadeContratacoes:0,...values},{DepositoId:2,PrestadorId:1,Prestador:'João & Filhos',CPF:'01234567890',QuantidadeContratacoes:1,...values}],contratacoes:[{DepositoId:1,PrestadorId:1,Numero:'9007199254740993123',DataServico:'2026-11-09',DataCriacao:'2026-11-09T15:00:00.000',CentroCusto:'CC-A',Atividade:'=HYPERLINK("https://example.org") <b>Limpeza</b>',DataPagamento:'2026-11-09T16:00:00.000',...values},{DepositoId:2,PrestadorId:1,Numero:'2',DataServico:'2026-11-10',DataCriacao:'2026-11-09T15:00:00.000',CentroCusto:'CC-B',Atividade:'Descarga',DataPagamento:null,...values}]};
const sheetOf=r=>entries(statementWorkbook(r)).get('xl/worksheets/sheet1.xml');
const row=(sheet,text)=>[...sheet.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)].map(m=>m[0]).find(r=>r.includes(text));
test('XLSX agrupado por depósito/prestador contém contratos, CPF e totais, sem fórmulas',()=>{
 const sheet=sheetOf(report);let index=-1;
 for(const text of ['Depósito: Sumaré','Prestador: João &amp; Filhos','9007199254740993123','Prestador: Sem movimento','Nenhuma contratação','Depósito: Floripa','Descarga','Total geral']){const next=sheet.indexOf(text,index+1);assert.ok(next>index,text);index=next;}
 assert.match(sheet,/CPF\/CNPJ: 012\.345\.678-90/);assert.match(sheet,/CPF\/CNPJ: 00\.123\.456\/0001-99/);
 assert.match(row(sheet,'9007199254740993123'),/t="inlineStr"[^>]*><is><t[^>]*>9007199254740993123/);
 assert.match(row(sheet,'9007199254740993123'),/<v>100\.25<\/v>/);assert.match(row(sheet,'Total geral'),/<v>75\.25<\/v>/);
 assert.match(sheet,/outlineLevel="2"/);assert.match(sheet,/mergeCell ref="A1:I1"/);assert.doesNotMatch(sheet,/<f>|TargetMode="External"|<b>/);assert.match(sheet,/&lt;b&gt;Limpeza&lt;\/b&gt;/);
});
test('XLSX preserva precisão grande, datas tipadas e estado vazio',()=>{
 const large={...report,contratacoes:report.contratacoes.map(r=>({...r,ValorDevido:'9999999999999999.99'}))},sheet=sheetOf(large),line=row(sheet,'9007199254740993123');
 assert.match(line,/t="inlineStr"[^>]*><is><t[^>]*>9999999999999999\.99/);
 const serial=(Date.UTC(2026,10,9)-Date.UTC(1899,11,30))/86400000;assert.ok(line.includes('<v>'+serial+'</v>'));
 const empty=sheetOf({...report,depositos:[],prestadores:[],contratacoes:[],totais:{ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'}});assert.match(empty,/Nenhum prestador/);assert.match(row(empty,'Total geral'),/<v>0\.00<\/v>/);
});
