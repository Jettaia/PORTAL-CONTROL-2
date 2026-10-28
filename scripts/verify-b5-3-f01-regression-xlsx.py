import json
from pathlib import Path
import openpyxl

path = Path('docs/b5-3-f01/regression/regression/regression/regression/b5-2/regression/b5-1/carteira-sintetica.xlsx')
book = openpyxl.load_workbook(path)
sheet = book.active
assert book.sheetnames == ['Carteira']
assert sheet.max_row == 5
assert sheet['C5'].data_type == 's' and sheet['C5'].value.startswith('=HYPERLINK')
assert sheet['J5'].data_type == 's' and sheet['J5'].value == '100.00'
assert sheet.freeze_panes == 'A5' and sheet.auto_filter.ref == 'A4:U5'
assert len(book._external_links) == 0
assert all(cell.data_type != 'f' for row in sheet for cell in row)
assert 'Deposito reservado' not in '\n'.join(str(cell.value or '') for row in sheet for cell in row)
Path('docs/b5-3-f01/regression/regression/regression/regression/b5-2/regression/b5-1/xlsx-evidence.json').write_text(json.dumps({'status':'PASS','reader':'openpyxl','dataRows':1,'formulaCells':0,'externalLinks':0,'exactMoneyAsText':True,'authorizedScopeOnly':True},indent=2)+'\n',encoding='utf-8')
print('XLSX PASS: formato OOXML, escopo, texto literal, valor exato, filtros e congelamento')
