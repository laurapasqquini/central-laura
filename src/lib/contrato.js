// Monta o contrato da Gralha Azul (.docx) no próprio navegador, a partir de public/contrato-modelo.docx.
// O modelo tem marcadores {{...}}; os itens, a tabela de tamanhos e as fotos são repetidos aqui.
import JSZip from 'jszip';

export const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (xml, vals) => xml.replace(/\{\{([A-Z_0-9]+)\}\}/g, (m, k) => (k in vals ? esc(vals[k]) : m));

const EXTENSO = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
export const extenso = (n) => (n < 20 ? EXTENSO[n] : n < 100 ? DEZENAS[Math.floor(n / 10)] + (n % 10 ? ` e ${EXTENSO[n % 10]}` : '') : String(n));
const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
export const dataPorExtenso = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} DE ${MESES[m - 1]} DE ${y}`;
};

export const PAGAMENTOS = {
  pix5050: {
    nome: 'PIX 50% + 50%',
    texto: 'Pagamento via PIX, dividido em 2 (duas) parcelas: 50% (cinquenta por cento) na confirmação do pedido e 50% (cinquenta por cento) no envio.',
    via: 'Pagamento via PIX',
    detalhe: 'CNPJ: 09063151000163',
  },
  pixvista: { nome: 'PIX à vista', texto: 'Pagamento via PIX, à vista, na confirmação do pedido.', via: 'Pagamento via PIX', detalhe: 'CNPJ: 09063151000163' },
  boleto: {
    nome: 'Boleto à vista',
    texto: 'Pagamento à vista, via boleto bancário, no ato da confirmação do pedido.',
    via: 'Pagamento via boleto bancário',
    detalhe: 'Boleto emitido por Gralha Azul Uniformes.',
  },
};

export const totaisContrato = (c) => {
  const itens = c.itens.map((it) => {
    const qtd = it.tamanhos.reduce((s, t) => s + (Number(t.qtd) || 0), 0);
    return { ...it, qtdTotal: qtd, subtotal: qtd * (Number(it.preco) || 0) };
  });
  const produtos = itens.reduce((s, i) => s + i.subtotal, 0);
  const frete = Number(c.frete) || 0;
  return { itens, produtos, frete, total: produtos + frete, unidades: itens.reduce((s, i) => s + i.qtdTotal, 0) };
};

// Divide o <w:body> em parágrafos/tabelas de primeiro nível
function filhosDoBody(body) {
  const kids = [];
  let i = 0;
  while (i < body.length) {
    const m = body.slice(i).match(/^<(w:p|w:tbl)[ >]/);
    if (!m) {
      i++;
      continue;
    }
    const tag = m[1];
    const re = new RegExp(`<${tag}[ >]|</${tag}>`, 'g');
    re.lastIndex = i;
    let depth = 0;
    let mm;
    let j = i;
    while ((mm = re.exec(body))) {
      if (mm[0].startsWith('</')) {
        if (--depth === 0) {
          j = re.lastIndex;
          break;
        }
      } else depth++;
    }
    kids.push(body.slice(i, j));
    i = j;
  }
  return kids;
}

// Imagens: { dataUrl, w, h } (PNG ou JPEG)
const MAX_H = 3600000; // ~10 cm, igual aos contratos antigos
const MAX_W = 5400000; // ~15 cm

export async function gerarContrato(c) {
  const res = await fetch(`${import.meta.env.BASE_URL}contrato-modelo.docx`);
  if (!res.ok) throw new Error('não achei o modelo do contrato');
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const doc = await zip.file('word/document.xml').async('string');
  const b0 = doc.indexOf('<w:body>') + 8;
  const b1 = doc.lastIndexOf('<w:sectPr');
  const k = filhosDoBody(doc.slice(b0, b1));
  const acha = (txt) => {
    const i = k.findIndex((x) => x.includes(txt));
    if (i < 0) throw new Error('modelo sem ' + txt);
    return i;
  };

  const iItem = acha('{{ITEM_TITULO}}');
  const iSub = acha('{{SUBTOTAL}}');
  const bloco = k.slice(iItem, iSub + 1); // título → subtotal
  const vazio = k[iSub + 1]; // parágrafo em branco entre itens
  const iImg = bloco.findIndex((x) => x.includes('{{IMG_RID}}'));
  const iTbl = bloco.findIndex((x) => x.startsWith('<w:tbl'));

  const t = totaisContrato(c);
  let rels = await zip.file('word/_rels/document.xml.rels').async('string');
  let ct = await zip.file('[Content_Types].xml').async('string');
  let nImg = 0;

  const itensXml = t.itens
    .map((it, n) => {
      const vals = {
        N: n + 1,
        ITEM_TITULO: (it.titulo || it.produto).toUpperCase(),
        PRODUTO: it.produto,
        TECIDO: it.tecido,
        COR: it.cor,
        PERSONALIZACAO: it.personalizacao,
        DESC_PERS: it.descPers,
        SUBTOTAL: it.qtdTotal,
      };
      return bloco
        .map((x, j) => {
          if (j === iImg) {
            const imgs = it.imagens || [];
            if (!imgs.length) return x.replace(/<w:drawing>[\s\S]*<\/w:drawing>/, '<w:t>[Imagem a ser anexada]</w:t>');
            // várias imagens: lado a lado no mesmo parágrafo, menores
            const draw = x.match(/<w:drawing>[\s\S]*<\/w:drawing>/)[0];
            const alturaMax = imgs.length === 1 ? MAX_H : Math.round(MAX_H * 0.75);
            const larguraMax = Math.round(MAX_W / imgs.length);
            const desenhos = imgs.map((im) => {
              nImg++;
              const ext = im.dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg';
              const nome = `produto_${nImg}.${ext}`;
              const rid = `rIdProd${nImg}`;
              zip.file(`word/media/${nome}`, im.dataUrl.split(',')[1], { base64: true });
              rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${nome}"/></Relationships>`);
              let cy = alturaMax;
              let cx = Math.round((cy * im.w) / im.h);
              if (cx > larguraMax) {
                cx = larguraMax;
                cy = Math.round((cx * im.h) / im.w);
              }
              return draw.replace(/\{\{IMG_RID\}\}/g, rid).replace(/\{\{CX\}\}/g, cx).replace(/\{\{CY\}\}/g, cy).replace(/\{\{DOCPR\}\}/g, 1000 + nImg);
            });
            return x.replace(draw, desenhos.join('</w:r><w:r><w:t xml:space="preserve">   </w:t></w:r><w:r>'));
          }
          if (j === iTbl) {
            const rows = x.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g);
            const linha = rows.find((r) => r.includes('{{TAM}}'));
            const total = rows.find((r) => r.includes('{{TOTAL_ITEM}}'));
            const linhas = it.tamanhos
              .filter((tm) => Number(tm.qtd) > 0)
              .map((tm) => fill(linha, { TAM: tm.tam, QTD: tm.qtd }))
              .join('');
            return x.replace(linha + total, linhas + fill(total, { TOTAL_ITEM: it.qtdTotal }));
          }
          return fill(x, vals);
        })
        .join('');
    })
    .join(vazio);

  const pag = PAGAMENTOS[c.pagamento] || PAGAMENTOS.pix5050;
  const metade = Math.round((t.total / 2) * 100) / 100;
  const geral = {
    NOME: c.cliente.nome,
    DOC_TIPO: c.cliente.doc.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF',
    DOC: c.cliente.doc,
    ENDERECO: c.cliente.endereco,
    ENTREGA: c.cliente.entrega || c.cliente.endereco,
    TELEFONE: c.cliente.telefone,
    PEDIDO: c.pedido.toUpperCase(),
    TOTAL_GERAL: t.unidades,
    PRAZO_TEXTO:
      c.prazoTexto ||
      `As partes concordam que o prazo de produção e envio será de até ${c.prazoDias} (${extenso(Number(c.prazoDias))}) dias úteis, a contar da confirmação deste contrato e do pagamento da entrada.`,
    PAGAMENTO_TEXTO: c.pagamentoTexto || pag.texto,
    FRETE_LINHA: t.frete ? `Frete: ${brl(t.frete)}` : 'Frete grátis',
    TOTAL_PEDIDO: brl(t.total),
    PAG_VIA: pag.via,
    PAG_DETALHE: pag.detalhe,
    CONFIRMA: `${c.cliente.telefone} — ${c.cliente.nome.split(' ')[0]}`,
    DATA: dataPorExtenso(c.data),
  };
  if (c.pagamento === 'pix5050') {
    Object.assign(geral, {
      PARC_ROTULO: '1ª parcela (50% – confirmação do pedido): ',
      PARC_VALOR: brl(metade),
      PARC2_ROTULO: '2ª parcela (50% – no envio): ',
      PARC2_VALOR: brl(Math.round((t.total - metade) * 100) / 100),
    });
  } else {
    Object.assign(geral, { PARC_ROTULO: 'Pagamento à vista (na confirmação do pedido): ', PARC_VALOR: brl(t.total) });
  }

  const iValor = acha('{{VALOR_LINHA}}');
  const out = k.map((x, j) => {
    if (j === iItem) return itensXml;
    if (j > iItem && j <= iSub) return '';
    if (j === iValor) return t.itens.map((it) => fill(x, { VALOR_LINHA: `${it.produto}: ${it.qtdTotal} x ${brl(Number(it.preco))} = ${brl(it.subtotal)}` })).join('');
    if (x.includes('{{PARC2_ROTULO}}') && c.pagamento !== 'pix5050') return '';
    return fill(x, geral);
  });

  const novo = doc.slice(0, b0) + out.join('') + doc.slice(b1);
  if (/\{\{[A-Z_0-9]+\}\}/.test(novo)) throw new Error('faltou preencher: ' + novo.match(/\{\{[A-Z_0-9]+\}\}/)[0]);
  zip.file('word/document.xml', novo);
  zip.file('word/_rels/document.xml.rels', rels);
  for (const [ext, mime] of [
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
  ])
    if (!new RegExp(`Extension="${ext}"`, 'i').test(ct)) ct = ct.replace('<Default ', `<Default Extension="${ext}" ContentType="${mime}"/><Default `);
  zip.file('[Content_Types].xml', ct);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
