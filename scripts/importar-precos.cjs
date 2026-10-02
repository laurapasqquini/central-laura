// Lê a planilha de orçamento da Gralha Azul e gera src/data/gralha.json.
// Uso: node scripts/importar-precos.cjs "C:\caminho\ORÇAMENTO.xlsx"
// (precisa do pacote xlsx: npm i -D xlsx)
const X = require('xlsx');
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const wb = X.readFile(file);
const clean = (v) => String(v ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
const money = (v) => {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  const m = clean(v).replace(/R\$\s?/i, '').match(/^(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const s = m[1].includes(',') ? m[1].replace(/\./g, '').replace(',', '.') : m[1];
  return Math.round(parseFloat(s) * 100) / 100;
};
// "5-14 Peças" -> {min:5,max:14} · "51 ou mais" -> {min:51} · "Acima de 100" -> {min:101}
const tier = (label) => {
  const t = clean(label).toLowerCase();
  if (/dias|meses|semanas/.test(t)) return null;
  let m = t.match(/(\d+)\s*(?:-|a|até)\s*(\d+)/);
  if (m) return { min: +m[1], max: +m[2] };
  m = t.match(/(\d+)\s*(?:ou mais|\+)/);
  if (m) return { min: +m[1] };
  m = t.match(/acima de\s*(\d+)/);
  if (m) return { min: +m[1] + 1 };
  m = t.match(/^(\d+)\s*(?:peças|pecas|unidades|un)/);
  if (m) return { min: +m[1] }; // degraus: vale a partir dessa quantidade
  return null;
};
const FIELDS = { 'descrição do produto': 'nome', tamanho: 'tamanho', tecido: 'tecido', material: 'tecido', personalização: 'personalizacao', 'prazo de produção': 'prazo', 'forma de pagamento': 'pagamento' };

const produtos = [];
const avisos = [];
for (const aba of wb.SheetNames) {
  const ws = wb.Sheets[aba];
  const grid = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const at = (r, c) => (grid[r] ? grid[r][c] : '');
  let blocos = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] || []).length; c++) {
      if (!/descri[cç][aã]o do produto/i.test(clean(at(r, c)))) continue;
      blocos++;
      const p = { aba: aba.trim(), faixas: [], extras: [] };
      let unitCol = null; // tabelas com "Valor total" e "Valor unitário": usa o unitário
      for (let rr = r; rr < Math.min(r + 24, grid.length); rr++) {
        const label = clean(at(rr, c));
        if (rr > r && /descri[cç][aã]o do produto|orçamento gralha/i.test(label)) break;
        if (/^quantidade$/i.test(label)) for (let cc = c; cc < c + 6; cc++) if (/unit[aá]rio/i.test(clean(at(rr, cc)))) unitCol = cc;
        const key = FIELDS[label.replace(/:$/, '').toLowerCase()];
        if (key) p[key] = clean(at(rr, c + 1));
        else if (!label && clean(at(rr, c + 1)) && rr < r + 8) p.extras.push(clean(at(rr, c + 1)));
        const f = label && tier(label);
        if (f) {
          const preco = money(at(rr, unitCol ?? c + 1));
          if (preco != null) p.faixas.push({ ...f, preco });
          else avisos.push(`${aba} › ${p.nome}: faixa "${label}" sem preço`);
        }
      }
      if (!p.nome) continue;
      if (!p.faixas.length) avisos.push(`${aba} › ${p.nome}: nenhum preço encontrado`);
      p.minimo = p.faixas.length ? Math.min(...p.faixas.map((x) => x.min)) : null;
      produtos.push(p);
    }
  }
  // Abas em formato de lista simples: "Produto | R$ 00,00"
  if (!blocos) {
    let n = 0;
    for (const row of grid) {
      const nome = clean(row[0]);
      const preco = money(row[1]);
      if (nome && preco != null && !/orçamento/i.test(nome)) {
        produtos.push({ aba: aba.trim(), nome, faixas: [{ min: 1, preco }], extras: [], minimo: 1 });
        n++;
      }
    }
    if (!n) avisos.push(`Aba "${aba}" não tem produtos no formato esperado (ignorada)`);
  }
}

produtos.forEach((p, i) => (p.id = `p${i + 1}`));
const out = path.join(__dirname, '..', 'src', 'data', 'gralha.json');
fs.writeFileSync(out, JSON.stringify({ origem: path.basename(file), geradoEm: new Date().toISOString().slice(0, 10), produtos }, null, 1));
console.log(`${produtos.length} produtos em ${new Set(produtos.map((p) => p.aba)).size} abas -> ${out}`);
const porAba = {};
produtos.forEach((p) => (porAba[p.aba] = (porAba[p.aba] || 0) + 1));
console.log(porAba);
if (avisos.length) console.log('\nAVISOS:\n- ' + avisos.join('\n- '));
