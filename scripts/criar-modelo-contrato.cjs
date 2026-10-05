// Cria public/contrato-modelo.docx a partir de um contrato real da Gralha Azul (ex.: CONTRATO_FURIA_BODY.docx),
// trocando tudo o que é do cliente/pedido por marcadores {{...}} e tirando as fotos de produto.
// Uso: node scripts/criar-modelo-contrato.cjs "C:\...\CONTRATO_FURIA_BODY.docx"
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const src = process.argv[2];
const OUT = path.join(__dirname, '..', 'public', 'contrato-modelo.docx');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function troca(x, de, para, todas = false) {
  const alvo = esc(de).replace(/"/g, '&quot;');
  const re = new RegExp(`(<w:t(?: [^>]*)?>)(${alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(</w:t>)`, todas ? 'g' : '');
  if (!re.test(x)) throw new Error('não achei no modelo: ' + de);
  return x.replace(re, `$1${para}$3`);
}

(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(src));
  let x = await zip.file('word/document.xml').async('string');

  x = troca(x, 'Larissa da Silva Santos', '{{NOME}}');
  x = troca(x, ', inscrita sob o CPF nº ', ', inscrita sob o {{DOC_TIPO}} nº ');
  x = troca(x, '123.882.449-86', '{{DOC}}');
  x = x.replace(/(<w:t(?: [^>]*)?>)Rua Osvaldo Cruz, nº 359, CEP 87020-200, Maringá – PR(<\/w:t>)/, '$1{{ENDERECO}}$2');
  x = troca(x, 'Rua Osvaldo Cruz, nº 359, CEP 87020-200, Maringá – PR', '{{ENTREGA}}');
  x = troca(x, '(44) 99740-3880', '{{TELEFONE}}');
  x = troca(x, 'NOME DO PEDIDO PARA PRODUÇÃO: FÚRIA', 'NOME DO PEDIDO PARA PRODUÇÃO: {{PEDIDO}}');
  x = troca(x, 'ITEM 1 — BODY', 'ITEM {{N}} — {{ITEM_TITULO}}');
  x = troca(x, 'Body', '{{PRODUTO}}');
  x = troca(x, 'Suplex', '{{TECIDO}}');
  x = troca(x, 'Preto/dourado, conforme layout aprovado', '{{COR}}');
  x = troca(x, 'Sublimação', '{{PERSONALIZACAO}}');
  x = troca(
    x,
    'Conforme layout aprovado (Conjunto Fúria, Atlética A.A.A.J.F.O.G). Observação: devem ser consideradas as alterações enviadas em conversa privada após o piloto (ex.: ajuste na quantidade de estrelas da estampa frontal).',
    '{{DESC_PERS}}'
  );
  // Tabela: deixa só uma linha de tamanho (modelo) + TOTAL
  const t0 = x.indexOf('<w:tbl>') >= 0 ? x.indexOf('<w:tbl>') : x.indexOf('<w:tbl ');
  const t1 = x.indexOf('</w:tbl>', t0) + 8;
  let tbl = x.slice(t0, t1);
  const rows = tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g);
  let linha = rows[1].replace(/(<w:t(?: [^>]*)?>)PP(<\/w:t>)/, '$1{{TAM}}$2').replace(/(<w:t(?: [^>]*)?>)7(<\/w:t>)/, '$1{{QTD}}$2');
  let total = rows[rows.length - 1].replace(/(<w:t(?: [^>]*)?>)40(<\/w:t>)/, '$1{{TOTAL_ITEM}}$2');
  tbl = tbl.replace(rows.slice(1).join(''), linha + total);
  if (!tbl.includes('{{TAM}}') || !tbl.includes('{{TOTAL_ITEM}}')) throw new Error('tabela');
  x = x.slice(0, t0) + tbl + x.slice(t1);

  x = troca(x, '40 UNIDADES', '{{SUBTOTAL}} UNIDADES');
  x = troca(x, '40 UNIDADES', '{{TOTAL_GERAL}} UNIDADES');
  x = troca(
    x,
    'As partes concordam que o prazo de produção e envio será de até 30 (trinta) dias úteis, a contar da confirmação deste contrato e do pagamento da entrada.',
    '{{PRAZO_TEXTO}}'
  );
  x = troca(
    x,
    'Pagamento via PIX, dividido em 2 (duas) parcelas: 50% (cinquenta por cento) na confirmação do pedido e 50% (cinquenta por cento) no envio.',
    '{{PAGAMENTO_TEXTO}}'
  );
  x = troca(x, 'Body: 40 x R$ 65,00 = R$ 2.600,00', '{{VALOR_LINHA}}');
  x = troca(x, 'Frete grátis', '{{FRETE_LINHA}}');
  x = troca(x, 'R$ 2.600,00', '{{TOTAL_PEDIDO}}');
  x = troca(x, '1ª parcela (50% – confirmação do pedido): ', '{{PARC_ROTULO}}');
  x = troca(x, 'R$ 1.300,00', '{{PARC_VALOR}}');
  x = troca(x, '2ª parcela (50% – no envio): ', '{{PARC2_ROTULO}}');
  x = troca(x, 'R$ 1.300,00', '{{PARC2_VALOR}}');
  x = troca(x, 'Pagamento via PIX', '{{PAG_VIA}}');
  x = troca(x, 'CNPJ: 09063151000163', '{{PAG_DETALHE}}');
  x = troca(x, '44 99740-3880 — Larissa', '{{CONFIRMA}}');
  x = troca(x, 'FLORAÍ-PR, 17 DE SETEMBRO DE 2026', 'FLORAÍ-PR, {{DATA}}');

  // Foto do item: vira marcadores (o app troca pelo vínculo/tamanho de cada imagem)
  x = x.replace(/r:embed="rId101"/, 'r:embed="{{IMG_RID}}"');
  x = x.replace(/<wp:extent cx="\d+" cy="\d+"\/>/, '<wp:extent cx="{{CX}}" cy="{{CY}}"/>').replace(/<a:ext cx="\d+" cy="\d+"\/>/, '<a:ext cx="{{CX}}" cy="{{CY}}"/>');
  x = x.replace(/(<wp:docPr id=")\d+(")/, '$1{{DOCPR}}$2');

  for (const resto of ['Larissa', 'FÚRIA', 'Fúria', '123.882', 'Osvaldo']) if (x.includes(resto)) throw new Error('sobrou dado do cliente: ' + resto);
  zip.file('word/document.xml', x);

  // Tira as fotos de produto do modelo e os vínculos delas
  for (const n of Object.keys(zip.files)) if (/word\/media\/item_img_/.test(n)) zip.remove(n);
  let rels = await zip.file('word/_rels/document.xml.rels').async('string');
  rels = rels.replace(/<Relationship Id="rId10[0-9]"[^>]*\/>/g, '');
  zip.file('word/_rels/document.xml.rels', rels);
  // Propriedades do documento sem autor/título do contrato antigo
  for (const n of ['docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml']) {
    if (!zip.file(n)) continue;
    let p = await zip.file(n).async('string');
    p = p.replace(/<dc:title>[^<]*<\/dc:title>/, '<dc:title>Contrato Gralha Azul</dc:title>').replace(/<dc:creator>[^<]*<\/dc:creator>/, '<dc:creator>Gralha Azul Uniformes</dc:creator>');
    zip.file(n, p);
  }

  fs.writeFileSync(OUT, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('modelo salvo em', OUT);
})();
