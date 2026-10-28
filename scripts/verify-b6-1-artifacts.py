import json
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader

root = Path('docs/b6-1')
pdf = Path('output/pdf/minuta-recibo-b6-1-sintetica.pdf')
reader = PdfReader(pdf)
assert len(reader.pages) == 1
page = reader.pages[0]
assert abs(float(page.mediabox.width) - 595.28) < 2
assert abs(float(page.mediabox.height) - 841.89) < 2
text = page.extract_text()
assert 'MINUTA DE RECIBO' in text and 'COMPROVA PAGAMENTO' in text
assert '100,00' in text
draft = json.loads((root / 'minuta-sintetica.json').read_text(encoding='utf-8'))
assert draft['quitacao'] is False and draft['pagamentoConfirmado'] is False
for key in ['bruto', 'retencoes', 'liquidoRecebido', 'dataPagamento', 'meioPagamento']:
    assert draft[key] is None
books = []
for name in ['provisionamento-sintetico.xlsx', 'exportacao-interface.xlsx']:
    with ZipFile(root / name) as book:
        assert book.testzip() is None
        names = book.namelist()
        assert all('macro' not in p.lower() and 'external' not in p.lower() for p in names)
        for filename in names:
            ET.fromstring(book.read(filename))
        sheet = ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
        ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        assert not sheet.findall('.//m:f', ns)
        rows = sheet.findall('.//m:sheetData/m:row', ns)
        texts = [[n.text or '' for n in row.findall('.//m:t', ns)] for row in rows]
        assert 'NÃO É OBRIGAÇÃO NEM PAGAMENTO' in texts[0][0]
        participations = [r[0] for r in texts[4:]]
        assert len(set(participations)) == len(participations)
        assert 0 < len(participations) <= 100
        assert all('reservado' not in ' '.join(r) for r in texts[4:])
        books.append({'arquivo': name, 'participacoes': len(participations), 'formulas': 0, 'xmlValido': True})
report = {'status': 'PASS', 'pdf': {'arquivo': str(pdf), 'paginas': 1, 'A4': True,
          'minutaSemPagamento': True, 'renderizacao': 'screenshots/minuta-pdf-a4.png'},
          'excel': books, 'limite': 'Validação técnica de artefatos sintéticos; sem aprovação jurídica/fiscal.'}
(root / 'artifacts-evidence.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=True))
