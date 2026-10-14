// Arte do 6x0 6x0 para o Instagram: o modelo do Canva sem os nomes (public/artes, feito por
// scripts/arte-6x0-em-branco.cjs) + os ganhadores da semana, centralizados embaixo de "PARABÉNS AOS ATLETAS:".
// Sai em PNG (1080 x 1920), pronto para postar.
const COR = [0.0745, 0.1608, 0.2039]; // azul-escuro do Canva
export const MODELOS_6X0 = {
  Maringá: { arquivo: '6x0-maringa.pdf', topo: 449 }, // linha de base do primeiro nome (pontos, de baixo para cima)
  Londrina: { arquivo: '6x0-londrina.pdf', topo: 458 },
};
const LIMITE_BAIXO = 200; // acima dos logos dos patrocinadores

export async function gerarArte6x0(cidade, nomes) {
  const modelo = MODELOS_6X0[cidade];
  if (!modelo) throw new Error('Sem arte para esta cidade');
  const [{ PDFDocument, rgb }, { default: fontkit }] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  const base = import.meta.env.BASE_URL;
  const [pdfBytes, fonteBytes] = await Promise.all([
    fetch(`${base}artes/${modelo.arquivo}`).then((r) => r.arrayBuffer()),
    fetch(`${base}fonts/Poppins-Regular.ttf`).then((r) => r.arrayBuffer()),
  ]);
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const fonte = await doc.embedFont(fonteBytes, { subset: true });
  const pagina = doc.getPage(0);
  const { width } = pagina.getSize();
  const cor = rgb(...COR);

  // uma coluna até 10 nomes; mais que isso, duas. Todos com o mesmo tamanho de letra (o que couber)
  const colunas = nomes.length > 10 ? 2 : 1;
  const porColuna = Math.ceil(nomes.length / colunas);
  const altura = modelo.topo - LIMITE_BAIXO;
  const linha = Math.min(38, altura / Math.max(porColuna, 1));
  const larguraColuna = colunas === 1 ? width - 120 : (width - 100) / 2;
  let tam = Math.min(28, linha * 0.78);
  while (tam > 12 && nomes.some((n) => fonte.widthOfTextAtSize(n, tam) > larguraColuna - 10)) tam -= 0.5;
  nomes.forEach((nome, i) => {
    const col = Math.floor(i / porColuna);
    const lin = i % porColuna;
    const centro = colunas === 1 ? width / 2 : 50 + larguraColuna * col + larguraColuna / 2;
    pagina.drawText(nome, { x: centro - fonte.widthOfTextAtSize(nome, tam) / 2, y: modelo.topo - lin * linha, size: tam, font: fonte, color: cor });
  });
  const pdf = await doc.save();

  // PDF → PNG (pdf.js)
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const lido = await pdfjs.getDocument({ data: pdf }).promise;
  const pag = await lido.getPage(1);
  const vp1 = pag.getViewport({ scale: 1 });
  const vp = pag.getViewport({ scale: 1080 / vp1.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  await pag.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `6x0 6x0 ${cidade}.png`.normalize('NFD').replace(/[̀-ͯ]/g, '');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
