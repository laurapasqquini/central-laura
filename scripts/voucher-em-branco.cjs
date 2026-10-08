// Gera o modelo em branco de cada voucher: tira só o nome do ganhador e a data do sorteio (o resto do Canva fica igual)
const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument, PDFName, PDFArray, PDFRawStream } = require('pdf-lib');
const ALVOS = ['1363.16174 2429.5654 cm', '2767.2124 318.00116 cm']; // bloco do nome e bloco da data

async function branco(origem, destino) {
  const doc = await PDFDocument.load(fs.readFileSync(origem));
  const page = doc.getPage(0);
  const contents = page.node.get(PDFName.of('Contents'));
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let tirados = 0;
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    let txt = zlib.inflateSync(Buffer.from(stream.contents)).toString('latin1');
    for (const alvo of ALVOS) {
      const i = txt.indexOf(alvo);
      if (i < 0) continue;
      const bt = txt.indexOf('BT\n', i);
      const et = txt.indexOf('ET\n', bt);
      txt = txt.slice(0, bt) + txt.slice(et + 3);
      tirados++;
    }
    const novo = doc.context.flateStream(Buffer.from(txt, 'latin1'));
    doc.context.assign(ref, novo);
  }
  fs.writeFileSync(destino, await doc.save());
  console.log(destino, 'blocos tirados:', tirados);
}
// uso: node scripts/voucher-em-branco.cjs <voucher do Canva.pdf> public/vouchers/<patrocinador>.pdf
const [origem, destino] = process.argv.slice(2);
if (!origem || !destino) throw new Error('uso: node scripts/voucher-em-branco.cjs <entrada.pdf> <saida.pdf>');
branco(origem, destino);
