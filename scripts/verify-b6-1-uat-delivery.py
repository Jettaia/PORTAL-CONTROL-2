import json
import hashlib
from pathlib import Path
from decimal import Decimal
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader

root = Path('docs/b6-1-uat-executada')
execution = json.loads((root/'execucao.json').read_text(encoding='utf-8'))
assert execution['status'] == 'PASS_EXECUCAO_TECNICA_COMPLETA'
assert len(execution['steps']) == 13
assert execution['obrigacoes'] == 0
pdfs = []
for suffix, person in zip(['A', 'B'], execution['people']):
    file = root/'entrega'/f'minuta-prestador-{suffix}.pdf'
    reader = PdfReader(file)
    assert len(reader.pages) == 1
    page = reader.pages[0]
    assert abs(float(page.mediabox.width)-595.28) < 2
    assert abs(float(page.mediabox.height)-841.89) < 2
    text = page.extract_text()
    assert 'MINUTA DE RECIBO' in text and 'COMPROVA PAGAMENTO' in text
    assert person['value'].replace('.', ',') in text
    pdfs.append({'arquivo':str(file),'paginas':1,'A4':True,'valorContratualReferencia':person['value'],'pagamentoComprovado':False})
with ZipFile(root/'entrega/custos-gerenciais.xlsx') as book:
    assert book.testzip() is None
    assert not any('external' in f.lower() or 'macro' in f.lower() for f in book.namelist())
    ns = {'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    sheet = ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
    assert not sheet.findall('.//m:f',ns)
    rows = [[n.text or '' for n in row.findall('.//m:t',ns)] for row in sheet.findall('.//m:sheetData/m:row',ns)][4:]
    assert len(rows) == len(set(row[0] for row in rows))
    for person in execution['people']:
        row = next(row for row in rows if row[0] == person['participationId'])
        assert row[12] == person['value'] and row[14] == person['value']
        assert 'FECHADO' in row[15] and 'PREVISTO_PARA_PROVISAO' in row[15]
    assert sum(Decimal(row[12]) for row in rows) == Decimal(execution['indicadoresDepois']['etapas']['CONTRATADO']['valor'])
    assert sum(Decimal(row[14]) for row in rows if row[14]) == Decimal(execution['indicadoresDepois']['etapas']['PREVISTO_PARA_PROVISAO']['valor'])
report = {'status':'PASS','execucaoCompleta':True,'etapas':13,'pagamentoRealizado':False,'obrigacoes':0,'pdfs':pdfs,'excelParticipacoes':len(rows),'duplicadas':0,'formulas':0,'validacaoJuridicaFiscal':'NAO_PRESUMIDA'}
files = list((root/'entrega').glob('*'))
report['sha256'] = {f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
(root/'arquivos-validados.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
