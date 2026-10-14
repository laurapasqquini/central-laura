// Tira de um PDF os dados de autoria (Info e XMP do Canva, que trazem o nome de quem criou a arte).
// uso: node scripts/limpar-metadados-pdf.cjs <arquivo.pdf> [outro.pdf ...]
const fs = require('fs');
const { PDFDocument, PDFName } = require('pdf-lib');
(async () => {
  for (const f of process.argv.slice(2)) {
    const doc = await PDFDocument.load(fs.readFileSync(f), { updateMetadata: false });
    const ref = doc.catalog.get(PDFName.of('Metadata'));
    if (ref) {
      doc.catalog.delete(PDFName.of('Metadata'));
      doc.context.delete(ref);
    }
    doc.setAuthor('');
    doc.setCreator('');
    doc.setProducer('');
    doc.setSubject('');
    doc.setKeywords([]);
    fs.writeFileSync(f, await doc.save({ updateFieldAppearances: false }));
    console.log(f, 'limpo');
  }
})();
