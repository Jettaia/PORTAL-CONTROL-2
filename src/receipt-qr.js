import qrcode from 'qrcode-generator';
export function receiptQr(receipt){
 if(!/^[1-9]\d*$/.test(String(receipt.ContratacaoId))||!/^[1-9]\d*$/.test(String(receipt.VersaoOrigem)))return '';
 const payload=`JC1:${receipt.ContratacaoId}:${receipt.VersaoOrigem}`,qr=qrcode(0,'M');qr.addData(payload);qr.make();
 return `<div class="receipt-qr" data-receipt-qr="${payload}">${qr.createSvgTag({cellSize:2,margin:8,scalable:true})}<small>Identificação do recibo</small></div>`;
}
