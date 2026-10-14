// Gera o modelo em branco da arte do 6x0 6x0 (Canva): tira só o bloco com os nomes dos ganhadores.
// uso: node scripts/arte-6x0-em-branco.cjs <arte do Canva.pdf> public/artes/6x0-<cidade>.pdf "<x y cm do bloco dos nomes>"
const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument, PDFName, PDFArray, PDFRawStream } = require('pdf-lib');

async function branco(origem, destino, alvo) {
  const doc = await PDFDocument.load(fs.readFileSync(origem));
  const page = doc.getPage(0);
  const contents = page.node.get(PDFName.of('Contents'));
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let tirados = 0;
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    let txt = zlib.inflateSync(Buffer.from(stream.contents)).toString('latin1');
    const i = txt.indexOf(alvo);
    if (i < 0) continue;
    const bt = txt.indexOf('BT\n', i);
    const et = txt.indexOf('ET\n', bt);
    txt = txt.slice(0, bt) + txt.slice(et + 3);
    tirados++;
    doc.context.assign(ref, doc.context.flateStream(Buffer.from(txt, 'latin1')));
  }
  doc.setTitle('6x0 6x0');
  doc.setAuthor('');
  doc.setCreator('');
  doc.setProducer('');
  doc.setKeywords([]);
  doc.setSubject('');
  fs.writeFileSync(destino, await doc.save());
  console.log(destino, 'blocos tirados:', tirados);
}
const [origem, destino, alvo] = process.argv.slice(2);
if (!origem || !destino || !alvo) throw new Error('uso: node scripts/arte-6x0-em-branco.cjs <entrada.pdf> <saida.pdf> "<x y cm>"');
branco(origem, destino, alvo);
