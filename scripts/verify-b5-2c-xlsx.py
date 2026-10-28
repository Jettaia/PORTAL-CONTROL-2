from pathlib import Path
from openpyxl import load_workbook
for name in ['pagina-sintetica.xlsx','pagina-interface.xlsx']:
    path=Path('docs/b5-2c/regression/regression')/name
    book=load_workbook(path,data_only=False)
    sheet=book.active
    assert sheet.max_row==6, (name,sheet.max_row)
    assert sheet.max_column==28, (name,sheet.max_column)
    assert 'SOMENTE P' in sheet['A1'].value
    assert 'SOMENTE_PAGINA' in sheet['A3'].value
    assert sheet['V4'].value=='Solicitação financeira'
    assert sheet['W4'].value=='Estado da autorização'
    assert sheet.auto_filter.ref=='A4:AB6'
    assert sheet.freeze_panes=='A5'
    assert not book._external_links
    for row in sheet:
        for cell in row:
            assert cell.data_type!='f'
    for i in (5,6):
        assert isinstance(sheet.cell(i,10).value,str)
        assert sheet.cell(i,10).value=='100.00'
        assert sheet.cell(i,22).value
    print('XLSX PASS: '+name+' pagina de 2 linhas, 28 colunas, auditoria e texto sem formula')
