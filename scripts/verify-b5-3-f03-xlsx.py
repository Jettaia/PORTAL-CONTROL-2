from pathlib import Path
from openpyxl import load_workbook
root=Path('docs/b5-3-f03')
for name in ['pagina-sintetica.xlsx','pagina-interface.xlsx','carteira-sintetica.xlsx']:
    paths=list(root.rglob(name))
    assert paths, name
    for path in paths:
        book=load_workbook(path,data_only=False);sheet=book.active
        assert not book._external_links
        assert all(cell.data_type!='f' for row in sheet for cell in row)
        assert sheet.freeze_panes=='A5'
        assert 'Deposito reservado' not in '\n'.join(str(c.value or '') for row in sheet for c in row)
        if name.startswith('pagina-'):
            assert sheet.max_row==6 and sheet.max_column==28
            assert 'SOMENTE P' in sheet['A1'].value and 'SOMENTE_PAGINA' in sheet['A3'].value
            assert sheet.auto_filter.ref=='A4:AB6'
            for i in (5,6): assert sheet.cell(i,10).value=='100.00' and sheet.cell(i,10).data_type=='s'
        else:
            assert sheet.max_row==5 and sheet.max_column==21
            assert sheet['C5'].data_type=='s' and sheet['C5'].value.startswith('=HYPERLINK')
            assert sheet['J5'].data_type=='s' and sheet['J5'].value=='100.00'
            assert sheet.auto_filter.ref=='A4:U5'
    print('XLSX PASS: '+name+' escopo, texto literal, valor exato, filtros e ausencia de formulas')
