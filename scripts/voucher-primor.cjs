// Modelo do voucher da Primor, em cima do esqueleto limpo do Canva (VOUCHER.pdf, página 3: sem logo, prêmio só "01",
// círculo vazio e "DATA DO SORTEIO:" já escrito). Põe o logo, o prêmio, a xícara e o rodapé; o nome do ganhador e a
// data a central escreve na hora (src/lib/voucher.js, modelo com soData).
// uso: node scripts/voucher-primor.cjs <VOUCHER.pdf do Canva> <logo primor.png> <Anton-Regular.ttf> public/vouchers/primor.pdf
const fs = require('fs');
const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, moveTo, appendBezierCurve, closePath, clip, endPath } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const [canva, logoPng, antonTtf, destino] = process.argv.slice(2);
if (!destino) throw new Error('uso: node scripts/voucher-primor.cjs <VOUCHER.pdf> <logo.png> <Anton.ttf> <saida.pdf>');
const hex = (h) => rgb(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const ESCURO = hex('#132934'), OURO = hex('#b59a60'), TEXTO = hex('#142c37');

(async () => {
  const origem = await PDFDocument.load(fs.readFileSync(canva));
  const doc = await PDFDocument.create();
  const [pagina] = await doc.copyPages(origem, [2]); // página 3 = esqueleto
  const p = doc.addPage(pagina);
  doc.registerFontkit(fontkit);
  const anton = await doc.embedFont(fs.readFileSync(antonTtf));
  const poppins = await doc.embedFont(fs.readFileSync('public/fonts/Poppins-Regular.ttf'));
  const logo = await doc.embedPng(fs.readFileSync(logoPng));

  // 1) logo: círculo branco do tamanho do logo do Burgo, com o logo da Primor ampliado e recortado no círculo
  const r = 38, k = 0.5523 * r, X = 565.8, Y = 552.3, S = 74; // o PNG tem muita margem: centro do desenho ≈ 54% x 58%
  p.drawCircle({ x: X, y: Y, size: r, color: rgb(1, 1, 1) });
  p.pushOperators(pushGraphicsState(), moveTo(X + r, Y), appendBezierCurve(X + r, Y + k, X + k, Y + r, X, Y + r), appendBezierCurve(X - k, Y + r, X - r, Y + k, X - r, Y),
    appendBezierCurve(X - r, Y - k, X - k, Y - r, X, Y - r), appendBezierCurve(X + k, Y - r, X + r, Y - k, X + r, Y), closePath(), clip(), endPath());
  p.drawImage(logo, { x: X - 0.539 * S, y: Y - 0.417 * S, width: S, height: S });
  p.pushOperators(popGraphicsState());

  // 2) prêmio: o esqueleto só tem "01"; cobre e escreve o texto inteiro com espaço entre as letras (como no Canva)
  p.drawRectangle({ x: 314, y: 205, width: 60, height: 50, color: ESCURO });
  let x = 320;
  for (const ch of '01 CAFÉ COLONIAL') {
    p.drawText(ch, { x, y: 213.5, size: 33, font: anton, color: rgb(1, 1, 1) });
    x += anton.widthOfTextAtSize(ch, 33) + 2.6;
  }

  // 3) xícara de café no círculo vazio (traço dourado, como os desenhos do Canva)
  const cx = 204.9, cy = 210;
  const tr = { borderColor: OURO, borderWidth: 2.6 };
  p.drawSvgPath('M 0 0 H 46 V 18 Q 46 38 23 38 Q 0 38 0 18 Z', { x: cx - 30, y: cy + 8, ...tr }); // xícara
  p.drawSvgPath('M 46 6 Q 60 6 60 16 Q 60 26 44 28', { x: cx - 30, y: cy + 8, ...tr }); // alça
  p.drawSvgPath('M 0 0 Q 32 8 64 0', { x: cx - 39, y: cy - 32, ...tr }); // pires
  for (const dx of [-16, -4, 8]) p.drawSvgPath('M 0 0 Q -5 -7 0 -14 Q 5 -21 0 -28', { x: cx + dx, y: cy + 14, ...tr }); // fumaça

  // 4) rodapé (no lugar do endereço dos outros vouchers)
  ['Panificadora Primor', '@panificadoraprimormga'].forEach((l, i) => p.drawText(l, { x: 805 - poppins.widthOfTextAtSize(l, 7.6) / 2, y: 66 - i * 11, size: 7.6, font: poppins, color: TEXTO }));

  fs.writeFileSync(destino, await doc.save());
  console.log('ok', destino);
})();
