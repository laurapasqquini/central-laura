// PDF do contrato da Gralha Azul, gerado no navegador (mesmo conteúdo do Word).
// Cabeçalho e rodapé vêm das imagens do próprio modelo (public/contrato-modelo.docx).
import JSZip from 'jszip';
import { totaisContrato, brl, extenso, dataPorExtenso, PAGAMENTOS } from './contrato';

const AZUL = '#0b63b5';

async function imagensDaMarca() {
  const res = await fetch(`${import.meta.env.BASE_URL}contrato-modelo.docx`);
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const rel = async (parte) => {
    const r = await zip.file(`word/_rels/${parte}.xml.rels`).async('string');
    const alvo = r.match(/Target="(media\/[^"]+)"/)[1];
    return `data:image/png;base64,${await zip.file(`word/${alvo}`).async('base64')}`;
  };
  return { cabecalho: await rel('header1'), rodape: await rel('footer1') };
}

export async function gerarContratoPdf(c) {
  const [{ default: pdfMake }, { default: vfs }, marca] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'), imagensDaMarca()]);
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.setUrlAccessPolicy(() => false); // só imagens embutidas, nada da internet

  const t = totaisContrato(c);
  const pag = PAGAMENTOS[c.pagamento] || PAGAMENTOS.pix5050;
  const doc = c.cliente.doc.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF';
  const b = (text) => ({ text, bold: true });
  const titulo = (text) => ({ text, bold: true, fontSize: 12, color: AZUL, margin: [0, 12, 0, 6] });
  const par = (...partes) => ({ text: partes, margin: [0, 0, 0, 6], alignment: 'justify' });
  const campo = (rot, val) => ({ text: [b(`${rot}: `), val || ''], margin: [0, 0, 0, 3] });

  const itens = t.itens.map((it, n) => {
    const imgs = it.imagens || [];
    const alt = imgs.length > 1 ? 200 : 260;
    const largMax = imgs.length > 1 ? 480 / imgs.length - 10 : 420;
    const fotos = imgs.length
      ? {
          columns: imgs.map((im) => {
            let h = alt;
            let w = (h * im.w) / im.h;
            if (w > largMax) {
              w = largMax;
              h = (w * im.h) / im.w;
            }
            return { image: im.dataUrl, width: w, height: h, alignment: 'center' };
          }),
          columnGap: 10,
          margin: [0, 4, 0, 8],
        }
      : { text: '[Imagem a ser anexada]', italics: true, color: '#888', margin: [0, 4, 0, 8] };
    const linhas = it.tamanhos.filter((tm) => Number(tm.qtd) > 0);
    return [
      // título + "LAYOUT APROVADO" + foto nunca se separam
      {
        unbreakable: true,
        stack: [{ text: `ITEM ${n + 1} — ${(it.titulo || it.produto).toUpperCase()}`, bold: true, fontSize: 12, margin: [0, 10, 0, 4] }, { text: 'LAYOUT APROVADO', bold: true, margin: [0, 0, 0, 2] }, fotos],
      },
      campo('DESCRIÇÃO DO PRODUTO', it.produto),
      campo('TECIDO', it.tecido),
      campo('COR BASE', it.cor),
      campo('PERSONALIZAÇÃO', it.personalizacao),
      campo('DESCRIÇÃO DA PERSONALIZAÇÃO', it.descPers),
      {
        unbreakable: true,
        stack: [
          { text: 'QUANTIDADE POR TAMANHOS:', bold: true, margin: [0, 8, 0, 4] },
          {
            table: {
              widths: [180, 120],
              headerRows: 1,
              body: [
                [
                  { text: 'DESCRIÇÃO', bold: true, fillColor: AZUL, color: '#fff', alignment: 'center' },
                  { text: 'QUANTIDADE', bold: true, fillColor: AZUL, color: '#fff', alignment: 'center' },
                ],
                ...linhas.map((tm) => [
                  { text: tm.tam, alignment: 'center' },
                  { text: String(tm.qtd), alignment: 'center' },
                ]),
                [
                  { text: 'TOTAL', bold: true, alignment: 'center', fillColor: '#eef4fb' },
                  { text: String(it.qtdTotal), bold: true, alignment: 'center', fillColor: '#eef4fb' },
                ],
              ],
            },
            layout: { hLineColor: '#b7c9de', vLineColor: '#b7c9de' },
          },
          { text: [b('SUBTOTAL DO ITEM: '), `${it.qtdTotal} UNIDADES`], margin: [0, 6, 0, 4] },
        ],
      },
    ];
  });

  const metade = Math.round((t.total / 2) * 100) / 100;
  const parcelas =
    c.pagamento === 'pix5050'
      ? [
          { text: [b('1ª parcela (50% – confirmação do pedido): '), brl(metade)] },
          { text: [b('2ª parcela (50% – no envio): '), brl(Math.round((t.total - metade) * 100) / 100)] },
        ]
      : [{ text: [b('Pagamento à vista (na confirmação do pedido): '), brl(t.total)] }];

  const etapas = [
    ['Design Final', 'Após a aprovação do layout pelo Cliente, a Empresa procederá com a produção de acordo com o design final acordado.'],
    ['Compra da Matéria-Prima', 'A Empresa se responsabiliza pela aquisição dos materiais necessários para a produção dos uniformes conforme especificações aprovadas.'],
    ['Encaixe do Molde e Corte', 'Os moldes serão preparados de acordo com os tamanhos e modelos solicitados. O corte será realizado de forma precisa para garantir a qualidade dos uniformes.'],
    ['Personalização', 'A personalização dos uniformes será feita de acordo com o método acordado (bordado, silk screen, DTF, sublimação, etc.) conforme o layout aprovado pelo Cliente.'],
    ['Costura', 'A etapa de costura incluirá a montagem dos uniformes, seguindo os padrões de qualidade estabelecidos.'],
    ['Acabamento e Pacote', 'Após a produção, os uniformes serão inspecionados para garantir que atendam aos padrões de qualidade exigidos. Posteriormente, serão embalados de forma adequada.'],
    ['Expedição', 'Os uniformes serão enviados para o endereço indicado pelo Cliente, conforme as condições acordadas.'],
  ];

  const def = {
    pageSize: 'A4',
    pageMargins: [56, 100, 56, 80],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.2 },
    header: { image: marca.cabecalho, width: 595, margin: [0, 8, 0, 0] },
    footer: { image: marca.rodape, width: 595, margin: [0, 10, 0, 0] },
    info: { title: `Contrato ${c.pedido}`, author: 'Gralha Azul Uniformes' },
    content: [
      { text: 'CONTRATO DE COMPRA DE UNIFORMES PERSONALIZADOS', bold: true, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 12] },
      par(
        'Este Contrato de Compra ("Contrato") é celebrado entre ',
        b('JULIA MARIA FERREIRA RICOBELLO'),
        ', com nome fantasia de ',
        b('GRALHA AZUL UNIFORMES'),
        ', com sede na ',
        b('RUA JOSÉ VENINO PEIXOTO, N° 481, CONJUNTO NOSSA SENHORA APARECIDA, FLORAÍ-PR, CEP 87185-000'),
        ' (doravante referida como "Empresa") e ',
        b(c.cliente.nome),
        `, inscrita sob o ${doc} nº `,
        b(c.cliente.doc),
        ', com sede na ',
        b(c.cliente.endereco),
        ', endereço de entrega ',
        b(c.cliente.entrega || c.cliente.endereco),
        ' e telefone para contato ',
        b(c.cliente.telefone),
        ' como ("Cliente"), a partir da data de confirmação deste contrato.'
      ),
      { text: `NOME DO PEDIDO PARA PRODUÇÃO: ${c.pedido.toUpperCase()}`, bold: true, margin: [0, 4, 0, 4] },
      titulo('1. OBJETO DO CONTRATO'),
      par(b('1.1 '), 'A Empresa se compromete a produzir e entregar ao Cliente uniformes personalizados conforme as especificações acordadas entre ambas as partes, de acordo com o layout pré-aprovado.'),
      par(b('1.2 '), 'O pedido compreende a produção dos seguintes itens:'),
      ...itens.flat(),
      { text: [b('TOTAL GERAL: '), `${t.unidades} UNIDADES`], margin: [0, 6, 0, 0] },
      titulo('2. PROCESSO DE PRODUÇÃO'),
      par('O processo de produção dos uniformes seguirá as seguintes etapas:'),
      ...etapas.map(([n, d], i) => par(b(`${i + 1}. ${n}: `), d)),
      titulo('3. PRAZOS'),
      par(
        b('3.1 '),
        c.prazoTexto ||
          `As partes concordam que o prazo de produção e envio será de até ${c.prazoDias} (${extenso(Number(c.prazoDias))}) dias úteis, a contar da confirmação deste contrato e do pagamento da entrada.`
      ),
      par(b('3.2 '), 'O prazo de entrega da mercadoria, depois do envio não será de responsabilidade da empresa.'),
      par(b('3.3 '), 'Fica a critério do cliente, com o auxílio da empresa, a escolha da transportadora que faça o translado dos produtos.'),
      {
        unbreakable: true,
        stack: [
          titulo('4. CONDIÇÕES FINANCEIRAS'),
          par(b('4.1 '), 'O Cliente concorda em pagar o valor total acordado pela produção dos uniformes personalizados e custo de envio (FRETE), conforme orçamento estabelecido pela Empresa.'),
          par(b('4.2 '), 'O pagamento será efetuado da seguinte forma:'),
          par(c.pagamentoTexto || pag.texto),
          { text: 'Valores acordados:', bold: true, margin: [0, 2, 0, 2] },
          ...t.itens.map((it) => ({ text: `${it.produto}: ${it.qtdTotal} x ${brl(Number(it.preco))} = ${brl(it.subtotal)}` })),
          { text: t.frete ? `Frete: ${brl(t.frete)}` : 'Frete grátis', bold: true },
          { text: [b('Total do pedido: '), b(brl(t.total))], margin: [0, 0, 0, 6] },
          ...parcelas,
          { text: '4.3 Dados bancários', bold: true, margin: [0, 8, 0, 2] },
          { text: pag.via },
          { text: pag.detalhe },
          { text: 'JULIA MARIA FERREIRA RICOBELLO', bold: true },
        ],
      },
      titulo('5. DISPOSIÇÕES GERAIS'),
      par(b('5.1 '), 'Ambas as partes concordam que eventuais modificações no pedido devem ser acordadas por escrito e assinadas por representantes autorizados de ambas as partes.'),
      par(b('5.2 '), 'Qualquer litígio decorrente deste contrato será resolvido amigavelmente pelas partes. Caso não haja acordo, será submetido à jurisdição competente.'),
      titulo('6. DISPOSIÇÕES FINAIS'),
      par('Este Contrato entra em vigor na data de confirmação do recebimento e confirmação via WhatsApp pelo número ', b(`${c.cliente.telefone} — ${c.cliente.nome.split(' ')[0]}`), '.'),
      { text: `FLORAÍ-PR, ${dataPorExtenso(c.data)}`, bold: true, alignment: 'center', margin: [0, 16, 0, 0] },
    ],
  };

  return pdfMake.createPdf(def).getBlob();
}
