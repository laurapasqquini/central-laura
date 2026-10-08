// Voucher do sorteio diário (Burgo e Jacaré Vermelho): o modelo do Canva sem nome e data
// (public/vouchers, feito por scripts/voucher-em-branco.cjs) + o nome do ganhador e a data do sorteio.
const COR = [0.0745, 0.1608, 0.2039]; // azul-escuro do Canva
export const MODELOS_VOUCHER = [
  { re: /burgo/i, arquivo: 'burgo.pdf', nome: 'BURGO' },
  { re: /jacar[eé]/i, arquivo: 'jacare.pdf', nome: 'JACARÉ VERMELHO' },
];
export const modeloVoucher = (patrocinador = '') => MODELOS_VOUCHER.find((m) => m.re.test(patrocinador)) || null;

export async function gerarVoucher(patrocinador, ganhador, dataISO) {
  const modelo = modeloVoucher(patrocinador);
  if (!modelo) throw new Error('Sem modelo de voucher para este patrocinador');
  const [{ PDFDocument, rgb }, { default: fontkit }] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  const base = import.meta.env.BASE_URL;
  const [pdfBytes, fonteBytes] = await Promise.all([
    fetch(`${base}vouchers/${modelo.arquivo}`).then((r) => r.arrayBuffer()),
    fetch(`${base}fonts/Poppins-Regular.ttf`).then((r) => r.arrayBuffer()),
  ]);
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const fonte = await doc.embedFont(fonteBytes, { subset: true });
  const pagina = doc.getPage(0);
  const cor = rgb(...COR);

  // data do sorteio, no canto de cima (mesma posição do Canva)
  const [, mes, dia] = dataISO.split('-');
  pagina.drawText(`DATA DO SORTEIO: ${dia}/${mes}`, { x: 731, y: 576, size: 12, font: fonte, color: cor });

  // nome do ganhador, centralizado no espaço do Canva (diminui a letra se o nome for longo)
  const nome = ganhador.trim().toUpperCase();
  let tam = 16;
  while (tam > 9 && fonte.widthOfTextAtSize(nome, tam) > 250) tam -= 0.5;
  pagina.drawText(nome, { x: 466 - fonte.widthOfTextAtSize(nome, tam) / 2, y: 65, size: tam, font: fonte, color: cor });

  const blob = new Blob([await doc.save()], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `VOUCHER ${modelo.nome} - ${nome}.pdf`.normalize('NFD').replace(/[̀-ͯ]/g, ''); // sem acento: o Chrome se atrapalha para abrir
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
