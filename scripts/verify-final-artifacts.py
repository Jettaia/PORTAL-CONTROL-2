import json
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader
root=Path('docs/final-lab')
r=PdfReader(root/'recibo-sintetico.pdf')
assert len(r.pages)==1, 'Recibo deve ter uma pagina A4, sem paginas em branco'
p=r.pages[0]
assert abs(float(p.mediabox.width)-595.28)<2 and abs(float(p.mediabox.height)-841.89)<2
text=p.extract_text() or ''
assert 'LABORAT' in text and 'SIMULADO' in text and '90,00' in text
assert '90,00' in text and 'NÃO' in text
books=[]
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for name in ['relatorio-financeiro-simulado.xlsx','exportacao-tela.xlsx']:
 with ZipFile(root/name) as book:
  assert book.testzip() is None
  assert not any('external' in n.lower() or 'vba' in n.lower() for n in book.namelist())
  for n in book.namelist():
   if n.endswith(('.xml','.rels')): ET.fromstring(book.read(n))
  sheet=ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
  assert not sheet.findall('.//m:f',ns)
  rows=[[n.text or '' for n in row.findall('.//m:t',ns)] for row in sheet.findall('.//m:row',ns)]
  assert all('\ufffd' not in value for row in rows for value in row)
  assert 'SIMULAÇÃO' in rows[0][0] and 'NÃO' in rows[0][0]
  assert rows[2][0]=='Participação'
  data=rows[3:]
  assert len({x[0] for x in data})==len(data) and 0<len(data)<=100
  assert all('reservado' not in ' '.join(row) for row in data)
  assert any(row[8]=='90.00' for row in data)
  books.append({'arquivo':name,'participacoes':len(data),'xmlValido':True,'semMacrosLinksFormulas':True,'acentosValidos':True})
report={'status':'PASS','pdf':{'paginas':1,'A4':True,'paginasEmBranco':0,'simulacaoExplicita':True},'excel':books,'limite':'Validacao estrutural e de dados; nao comprova comportamento de impressora fisica ou versao instalada do Excel.'}
(root/'artifacts-evidence.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
