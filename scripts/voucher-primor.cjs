// Modelo em branco do voucher da Primor, feito a partir do do Burgo (mesmo layout do Canva):
// troca o logo, o prêmio, o desenho e o rodapé. O nome do ganhador e a data a central escreve na hora.
// uso: node scripts/voucher-primor.cjs <logo primor.png> <Anton-Regular.ttf> public/vouchers/primor.pdf
const fs = require('fs');
const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, moveTo, appendBezierCurve, closePath, clip, endPath } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const [logoPng, antonTtf, destino] = process.argv.slice(2);
if (!destino) throw new Error('uso: node scripts/voucher-primor.cjs <logo.png> <Anton.ttf> <saida.pdf>');
const hex = (h) => rgb(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const FUNDO = hex('#f8f3ea'), ESCURO = hex('#132934'), VERDE = hex('#d9e8cc'), OURO = hex('#b59a60'), CINZA = hex('#8f8f8e'), TEXTO = hex('#142c37');

(async () => {
  const doc = await PDFDocument.load(fs.readFileSync('public/vouchers/burgo.pdf'));
  doc.registerFontkit(fontkit);
  const anton = await doc.embedFont(fs.readFileSync(antonTtf));
  const poppins = await doc.embedFont(fs.readFileSync('public/fonts/Poppins-Regular.ttf'));
  const logo = await doc.embedPng(fs.readFileSync(logoPng));
  const p = doc.getPage(0);
  // texto com espaço entre as letras (como no Canva)
  const espacado = (txt, x, y, size, cor, esp) => {
    for (const ch of txt) {
      p.drawText(ch, { x, y, size, font: anton, color: cor });
      x += anton.widthOfTextAtSize(ch, size) + esp;
    }
    return x;
  };
  const largura = (txt, size, esp) => [...txt].reduce((s, ch) => s + anton.widthOfTextAtSize(ch, size) + esp, 0) - esp;

  // 1) logo do patrocinador (no lugar do círculo do Burgo): círculo branco com o logo da Primor
  p.drawCircle({ x: 565.8, y: 554, size: 50, color: FUNDO });
  p.drawCircle({ x: 565.8, y: 552.3, size: 38, color: rgb(1, 1, 1) });
  // o PNG tem muita margem: amplia o logo e recorta no círculo (centro do desenho ≈ 54% x 58% do PNG)
  const r = 38, k = 0.5523 * r, X = 565.8, Y = 552.3, S = 74;
  p.pushOperators(pushGraphicsState(), moveTo(X + r, Y), appendBezierCurve(X + r, Y + k, X + k, Y + r, X, Y + r), appendBezierCurve(X - k, Y + r, X - r, Y + k, X - r, Y),
    appendBezierCurve(X - r, Y - k, X - k, Y - r, X, Y - r), appendBezierCurve(X + k, Y - r, X + r, Y - k, X + r, Y), closePath(), clip(), endPath());
  p.drawImage(logo, { x: X - 0.539 * S, y: Y - 0.417 * S, width: S, height: S });
  p.pushOperators(popGraphicsState());

  // 2) prêmio: cobre "01 HAMBURGUER" e a faixa verde da validade
  p.drawRectangle({ x: 312, y: 150, width: 545, height: 108, color: ESCURO });
  const PREMIO = '01 CAFÉ COLONIAL';
  espacado(PREMIO, 320, 213.5, 33, rgb(1, 1, 1), 2.6);
  const VALIDADE = 'VÁLIDO POR 07 DIAS';
  const lv = largura(VALIDADE, 11.5, 1.4);
  p.drawSvgPath(`M 4 0 H ${lv + 12} Q ${lv + 16} 0 ${lv + 16} 4 V 22 Q ${lv + 16} 26 ${lv + 12} 26 H 4 Q 0 26 0 22 V 4 Q 0 0 4 0 Z`, { x: 318.5, y: 186.5, color: VERDE });
  espacado(VALIDADE, 326, 168, 11.5, CINZA, 1.4);

  // 3) desenho: no lugar do hambúrguer, uma xícara de café (traço dourado, como o do Canva)
  const cx = 204.9, cy = 202.5;
  p.drawCircle({ x: cx, y: cy + 6, size: 84, color: ESCURO });
  p.drawCircle({ x: cx, y: cy, size: 66, color: VERDE });
  p.drawCircle({ x: cx, y: cy, size: 57, color: FUNDO });
  const tr = { borderColor: OURO, borderWidth: 2.6 };
  // xícara (origem do SVG = canto de cima à esquerda; y cresce para baixo)
  p.drawSvgPath('M 0 0 H 46 V 18 Q 46 38 23 38 Q 0 38 0 18 Z', { x: cx - 30, y: cy + 8, ...tr });
  p.drawSvgPath('M 46 6 Q 60 6 60 16 Q 60 26 44 28', { x: cx - 30, y: cy + 8, ...tr });
  p.drawSvgPath('M 0 0 Q 32 8 64 0', { x: cx - 39, y: cy - 32, ...tr }); // pires
  for (const dx of [-16, -4, 8]) p.drawSvgPath('M 0 0 Q -5 -7 0 -14 Q 5 -21 0 -28', { x: cx + dx, y: cy + 14, ...tr }); // fumaça

  // 4) rodapé: no lugar do endereço do Burgo
  p.drawRectangle({ x: 690, y: 40, width: 225, height: 52, color: FUNDO });
  const linhas = ['Panificadora Primor', '@panificadoraprimormga'];
  linhas.forEach((l, i) => p.drawText(l, { x: 805 - poppins.widthOfTextAtSize(l, 7.6) / 2, y: 66 - i * 11, size: 7.6, font: poppins, color: TEXTO }));

  fs.writeFileSync(destino, await doc.save());
  console.log('ok', destino);
})();
