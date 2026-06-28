const path = require('path');
const fs = require('fs');

let sqlite3 = null;
try { sqlite3 = require('sqlite3').verbose(); } catch (err) { sqlite3 = null; }

let db = null;
let dbPath = null;
let userDataRoot = null;
let dataDir = null;
let registryPath = null;
let currentCompanyId = 'default';

const now = () => new Date().toISOString();
const json = (v) => JSON.stringify(v ?? null);
const parse = (v, fallback = null) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS produtos (id TEXT PRIMARY KEY, nome TEXT, codigo_barras TEXT, categoria TEXT, unidade TEXT, marca TEXT, fornecedor TEXT, custo REAL DEFAULT 0, venda REAL DEFAULT 0, estoque REAL DEFAULT 0, minimo REAL DEFAULT 0, imagem TEXT, ativo INTEGER DEFAULT 1, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS clientes (id TEXT PRIMARY KEY, nome TEXT, telefone TEXT, cidade TEXT, endereco TEXT, documento TEXT, email TEXT, limite REAL DEFAULT 0, ativo INTEGER DEFAULT 1, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS usuarios (id TEXT PRIMARY KEY, nome TEXT, usuario TEXT UNIQUE, senha_hash TEXT, perfil TEXT, ativo INTEGER DEFAULT 1, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS fornecedores (id TEXT PRIMARY KEY, nome TEXT, telefone TEXT, cidade TEXT, documento TEXT, email TEXT, ativo INTEGER DEFAULT 1, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS vendas (id TEXT PRIMARY KEY, data TEXT, cliente_id TEXT, usuario_id TEXT, caixa_id TEXT, pagamento TEXT, subtotal REAL, desconto REAL, total REAL, custo REAL, cancelada INTEGER DEFAULT 0, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS vendas_itens (id TEXT PRIMARY KEY, venda_id TEXT, produto_id TEXT, nome TEXT, quantidade REAL, valor_unitario REAL, custo_unitario REAL, total REAL, payload_json TEXT)`,
  `CREATE TABLE IF NOT EXISTS caixas (id TEXT PRIMARY KEY, numero INTEGER, operador_id TEXT, operador_nome TEXT, abertura TEXT, fechamento TEXT, status TEXT, valor_inicial REAL, valor_final REAL, valor_esperado REAL, diferenca REAL, total_vendido REAL DEFAULT 0, vendas_qtd INTEGER DEFAULT 0, dinheiro_vendas REAL DEFAULT 0, pix_vendas REAL DEFAULT 0, debito_vendas REAL DEFAULT 0, credito_vendas REAL DEFAULT 0, fiado_vendas REAL DEFAULT 0, sangrias REAL DEFAULT 0, suprimentos REAL DEFAULT 0, observacao TEXT, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS estoque_movimentos (id TEXT PRIMARY KEY, data TEXT, produto_id TEXT, tipo TEXT, quantidade REAL, observacao TEXT, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS despesas (id TEXT PRIMARY KEY, data TEXT, descricao TEXT, categoria TEXT, valor REAL, pago INTEGER DEFAULT 1, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS contas_receber (id TEXT PRIMARY KEY, data TEXT, cliente_id TEXT, venda_id TEXT, valor REAL, pago INTEGER DEFAULT 0, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS orcamentos (id TEXT PRIMARY KEY, data TEXT, cliente_id TEXT, status TEXT, total REAL, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS entregas (id TEXT PRIMARY KEY, data TEXT, cliente_id TEXT, status TEXT, endereco TEXT, valor REAL, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS compras (id TEXT PRIMARY KEY, data TEXT, fornecedor_id TEXT, produto_id TEXT, quantidade REAL, custo REAL, total REAL, status TEXT, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS nfe_notas (id TEXT PRIMARY KEY, data TEXT, numero TEXT, serie TEXT, fornecedor_id TEXT, total REAL, payload_json TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS auditoria (id TEXT PRIMARY KEY, data TEXT, usuario TEXT, acao TEXT, payload_json TEXT)`,
  `CREATE TABLE IF NOT EXISTS acessos (id TEXT PRIMARY KEY, data TEXT, usuario TEXT, perfil TEXT, acao TEXT, extra TEXT, payload_json TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome)`,
  `CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo_barras)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome)`,
  `CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data)`,
  `CREATE INDEX IF NOT EXISTS idx_caixas_status ON caixas(status)`,
  `CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque_movimentos(produto_id)`
];

const ALTER_COLUMNS = [
  [`produtos`, `payload_json`, `TEXT`], [`clientes`, `payload_json`, `TEXT`], [`usuarios`, `payload_json`, `TEXT`],
  [`vendas`, `payload_json`, `TEXT`], [`vendas`, `updated_at`, `TEXT`], [`vendas_itens`, `payload_json`, `TEXT`],
  [`caixas`, `payload_json`, `TEXT`], [`caixas`, `updated_at`, `TEXT`], [`caixas`, `total_vendido`, `REAL DEFAULT 0`], [`caixas`, `vendas_qtd`, `INTEGER DEFAULT 0`], [`caixas`, `dinheiro_vendas`, `REAL DEFAULT 0`], [`caixas`, `pix_vendas`, `REAL DEFAULT 0`], [`caixas`, `debito_vendas`, `REAL DEFAULT 0`], [`caixas`, `credito_vendas`, `REAL DEFAULT 0`], [`caixas`, `fiado_vendas`, `REAL DEFAULT 0`], [`caixas`, `sangrias`, `REAL DEFAULT 0`], [`caixas`, `suprimentos`, `REAL DEFAULT 0`], [`estoque_movimentos`, `payload_json`, `TEXT`], [`estoque_movimentos`, `updated_at`, `TEXT`]
];

function safeCompanyId(value) {
  const base = String(value || 'empresa').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return base || 'empresa';
}
function readRegistry() {
  try {
    if (registryPath && fs.existsSync(registryPath)) {
      const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      if (Array.isArray(data.companies) && data.companies.length) return data;
    }
  } catch (_) {}
  return { currentCompanyId: 'default', companies: [{ id: 'default', name: 'Minha Empresa', document: '', active: true, createdAt: now(), updatedAt: now() }] };
}
function writeRegistry(registry) {
  if (!registryPath) return;
  registry.updatedAt = now();
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
}
function ensureRegistry() {
  const registry = readRegistry();
  if (!registry.companies.some(c => c.id === 'default')) {
    registry.companies.unshift({ id: 'default', name: 'Minha Empresa', document: '', active: true, createdAt: now(), updatedAt: now() });
  }
  if (!registry.currentCompanyId || !registry.companies.some(c => c.id === registry.currentCompanyId)) registry.currentCompanyId = registry.companies[0].id;
  writeRegistry(registry);
  return registry;
}
function openCompanyDatabase(companyId = 'default') {
  if (!sqlite3) return { ok: false, error: 'Dependência sqlite3 não instalada. Rode: npm install' };
  if (!dataDir) return { ok: false, error: 'Pasta de dados não inicializada' };
  const id = safeCompanyId(companyId);
  if (db) { try { db.close(); } catch (_) {} }
  currentCompanyId = id;
  dbPath = path.join(dataDir, id === 'default' ? 'nexagest.sqlite' : `nexagest-${id}.sqlite`);
  db = new sqlite3.Database(dbPath);
  db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    SCHEMA.forEach(sql => db.run(sql));
    ALTER_COLUMNS.forEach(([table, col, type]) => db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`, () => {}));
  });
  return { ok: true, path: dbPath, companyId: currentCompanyId };
}
function openDatabase(userDataPath) {
  userDataRoot = userDataPath;
  dataDir = path.join(userDataPath, 'dados');
  fs.mkdirSync(dataDir, { recursive: true });
  registryPath = path.join(dataDir, 'empresas.json');
  const registry = ensureRegistry();
  return openCompanyDatabase(registry.currentCompanyId || 'default');
}
function listCompanies() {
  const registry = ensureRegistry();
  const companies = registry.companies.map(c => ({ ...c, current: c.id === registry.currentCompanyId, dbFile: path.join(dataDir || '', c.id === 'default' ? 'nexagest.sqlite' : `nexagest-${c.id}.sqlite`) }));
  return { ok: true, currentCompanyId: registry.currentCompanyId, companies, dataDir };
}
async function switchCompany(companyId) {
  const registry = ensureRegistry();
  const id = safeCompanyId(companyId);
  if (!registry.companies.some(c => c.id === id && c.active !== false)) return { ok: false, error: 'Empresa não encontrada ou inativa' };
  registry.currentCompanyId = id;
  registry.companies = registry.companies.map(c => c.id === id ? { ...c, lastAccessAt: now(), updatedAt: now() } : c);
  writeRegistry(registry);
  openCompanyDatabase(id);
  const loaded = await loadAppData();
  return { ok: true, companyId: id, data: loaded.data, info: listCompanies() };
}
async function createCompany(payload = {}, baseData = null) {
  const registry = ensureRegistry();
  let id = safeCompanyId(payload.id || payload.name || 'empresa');
  let n = 2;
  const original = id;
  while (registry.companies.some(c => c.id === id)) id = `${original}-${n++}`;
  const item = { id, name: String(payload.name || 'Nova Empresa').trim() || 'Nova Empresa', document: payload.document || '', city: payload.city || '', phone: payload.phone || '', active: true, createdAt: now(), updatedAt: now() };
  registry.companies.push(item);
  registry.currentCompanyId = id;
  writeRegistry(registry);
  openCompanyDatabase(id);
  const data = baseData && payload.copyCurrent ? JSON.parse(JSON.stringify(baseData)) : {};
  data.session = null;
  data.settings = { ...(data.settings || {}), company: item.name, document: item.document || '', city: item.city || '', phone: item.phone || '' };
  if (!payload.copyCurrent) { data.products = []; data.clients = []; data.suppliers = []; data.sales = []; data.expenses = []; data.stockMoves = []; data.receivables = []; data.quotes = []; data.deliveries = []; data.nfeInvoices = []; data.purchases = []; data.audit = []; data.accessLogs = []; data.cashRegisters = []; }
  await saveAppData(data);
  return { ok: true, company: item, data: (await loadAppData()).data, info: listCompanies() };
}
function updateCompany(payload = {}) {
  const registry = ensureRegistry();
  const id = safeCompanyId(payload.id || currentCompanyId);
  let found = false;
  registry.companies = registry.companies.map(c => {
    if (c.id !== id) return c; found = true; return { ...c, name: payload.name ?? c.name, document: payload.document ?? c.document, city: payload.city ?? c.city, phone: payload.phone ?? c.phone, updatedAt: now() };
  });
  if (!found) return { ok: false, error: 'Empresa não encontrada' };
  writeRegistry(registry);
  return listCompanies();
}
function deleteCompany(companyId) {
  const registry = ensureRegistry();
  const id = safeCompanyId(companyId);
  if (id === 'default') return { ok: false, error: 'A empresa principal não pode ser excluída' };
  if (registry.currentCompanyId === id) return { ok: false, error: 'Troque para outra empresa antes de excluir esta' };
  registry.companies = registry.companies.map(c => c.id === id ? { ...c, active: false, updatedAt: now() } : c);
  writeRegistry(registry);
  return listCompanies();
}

function run(sql, params = []) { return new Promise((resolve, reject) => db.run(sql, params, function (err) { err ? reject(err) : resolve(this); })); }
function get(sql, params = []) { return new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))); }
function all(sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))); }
async function metaGet(key) { const r = await get('SELECT value FROM app_meta WHERE key=?', [key]); return parse(r?.value, null); }
async function metaSet(key, value) { await run(`INSERT INTO app_meta(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, [key, json(value), now()]); }

async function tableEmpty(table) { const r = await get(`SELECT COUNT(*) AS total FROM ${table}`); return !r || Number(r.total || 0) === 0; }

async function migrateOldAppStateIfNeeded() {
  try {
    if (!(await tableEmpty('produtos')) || !(await tableEmpty('usuarios'))) return;
    const old = await get(`SELECT value FROM app_kv WHERE key='app_db'`);
    const data = parse(old?.value, null);
    if (data && (data.products?.length || data.users?.length)) await saveAppData(data);
  } catch (_) {}
}

function byPayload(row, mapper) { return { ...(parse(row.payload_json, {}) || {}), ...mapper(row) }; }
function payload(row) { return parse(row.payload_json, {}) || {}; }
function firstText(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return '';
}
function firstNumber(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim?.() !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}
function normalizePaymentName(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('pix')) return 'Pix';
  if (s.includes('débito') || s.includes('debito')) return 'Cartão Débito';
  if (s.includes('crédito') || s.includes('credito')) return 'Cartão Crédito';
  if (s.includes('fiado')) return 'Fiado';
  return 'Dinheiro';
}
function summarizeCashRegister(c, sales = []) {
  const by = { Dinheiro:0, Pix:0, 'Cartão Débito':0, 'Cartão Crédito':0, Fiado:0 };
  (sales || []).filter(s => !s.cancelled && s.cashRegisterId === c.id).forEach(s => {
    const k = normalizePaymentName(s.payment);
    by[k] = (by[k] || 0) + Number(s.total || 0);
  });
  const movs = c.movements || [];
  const sangrias = movs.filter(m => String(m.type || '').toLowerCase().includes('sangria')).reduce((a,m)=>a+Number(m.value||0),0);
  const suprimentos = movs.filter(m => String(m.type || '').toLowerCase().includes('suprimento')).reduce((a,m)=>a+Number(m.value||0),0);
  const totalSales = Object.values(by).reduce((a,v)=>a+Number(v||0),0);
  const salesCount = (sales || []).filter(s => !s.cancelled && s.cashRegisterId === c.id).length;
  const expected = Number(c.initialAmount || 0) + Number(by.Dinheiro || 0) + suprimentos - sangrias;
  return {
    totalSales, salesCount, cashSales: by.Dinheiro || 0, pixSales: by.Pix || 0,
    debitSales: by['Cartão Débito'] || 0, creditSales: by['Cartão Crédito'] || 0, fiadoSales: by.Fiado || 0,
    sangrias, suprimentos, expectedAmount: expected
  };
}
function normalizeAppDataForSqlite(data) {
  data = data || {};
  data.sales = data.sales || [];
  data.cashRegisters = data.cashRegisters || [];
  data.products = data.products || [];
  const prodMap = new Map(data.products.map(p => [p.id, p]));
  for (const s of data.sales) {
    s.items = (s.items || []).map(it => {
      const pid = it.productId || it.id || it.produto_id || '';
      const p = prodMap.get(pid) || {};
      const qty = firstNumber(it.qty, it.quantidade, 1) || 1;
      const price = firstNumber(it.price, it.valor_unitario, it.unitPrice, it.sale, p.sale);
      const cost = firstNumber(it.cost, it.custo_unitario, it.unitCost, p.cost);
      const total = firstNumber(it.total, qty * price);
      const name = firstText(it.name, it.nome, it.productName, p.name);
      return { ...it, itemId: it.itemId || it.idItem || `${s.id}_${pid || Math.random().toString(36).slice(2,8)}`, id: pid, productId: pid, name, qty, price, cost, total };
    });
    s.subtotal = firstNumber(s.subtotal, s.items.reduce((a,it)=>a+Number(it.total||0),0));
    s.total = firstNumber(s.total, Math.max(0, Number(s.subtotal||0)-Number(s.discount||0)));
    s.cost = firstNumber(s.cost, s.items.reduce((a,it)=>a+Number(it.cost||0)*Number(it.qty||0),0));
  }
  for (const c of data.cashRegisters) {
    const sm = summarizeCashRegister(c, data.sales);
    c.totalSales = sm.totalSales; c.salesCount = sm.salesCount; c.cashSales = sm.cashSales; c.pixSales = sm.pixSales;
    c.debitSales = sm.debitSales; c.creditSales = sm.creditSales; c.fiadoSales = sm.fiadoSales; c.sangrias = sm.sangrias; c.suprimentos = sm.suprimentos;
    c.expectedAmount = sm.expectedAmount;
    if (c.status === 'Fechado') {
      c.finalAmount = firstNumber(c.finalAmount, c.valor_final);
      c.difference = Number(c.finalAmount || 0) - Number(c.expectedAmount || 0);
    }
  }
  return data;
}

async function loadAppData() {
  if (!db) return { ok: false, error: 'SQLite não inicializado' };
  await migrateOldAppStateIfNeeded();
  let data = {
    settings: (await metaGet('settings')) || undefined,
    session: (await metaGet('session')) || null,
    products: [], clients: [], users: [], suppliers: [], sales: [], expenses: [], stockMoves: [], receivables: [], quotes: [], deliveries: [], nfeInvoices: [], purchases: [], audit: [], accessLogs: [], cashRegisters: []
  };

  data.products = (await all('SELECT * FROM produtos ORDER BY nome COLLATE NOCASE')).map(r => byPayload(r, () => ({ id:r.id, name:r.nome||'', barcode:r.codigo_barras||'', category:r.categoria||'', unit:r.unidade||'un', brand:r.marca||'', supplierName:r.fornecedor||'', cost:+r.custo||0, sale:+r.venda||0, stock:+r.estoque||0, min:+r.minimo||0, image:r.imagem||'', active:r.ativo!==0 })));
  data.clients = (await all('SELECT * FROM clientes ORDER BY nome COLLATE NOCASE')).map(r => byPayload(r, () => ({ id:r.id, name:r.nome||'', phone:r.telefone||'', city:r.cidade||'', address:r.endereco||'', document:r.documento||'', email:r.email||'', creditLimit:+r.limite||0, active:r.ativo!==0 })));
  data.users = (await all('SELECT * FROM usuarios ORDER BY nome COLLATE NOCASE')).map(r => byPayload(r, () => ({ id:r.id, name:r.nome||'', user:r.usuario||'', passwordHash:r.senha_hash||'', role:r.perfil||'Caixa', active:r.ativo!==0 })));
  data.suppliers = (await all('SELECT * FROM fornecedores ORDER BY nome COLLATE NOCASE')).map(r => byPayload(r, () => ({ id:r.id, name:r.nome||'', phone:r.telefone||'', city:r.cidade||'', document:r.documento||'', email:r.email||'', active:r.ativo!==0 })));

  const salesRows = await all('SELECT * FROM vendas ORDER BY data DESC');
  const itemRows = await all('SELECT * FROM vendas_itens ORDER BY rowid');
  const itemsBySale = new Map();
  itemRows.forEach(r => {
    const p = payload(r);
    const qty = firstNumber(r.quantidade, p.qty, p.quantidade);
    const price = firstNumber(r.valor_unitario, p.price, p.valor_unitario, p.unitPrice);
    const cost = firstNumber(r.custo_unitario, p.cost, p.custo_unitario, p.unitCost);
    const name = firstText(r.nome, p.name, p.nome, p.productName);
    const it = { ...p, itemId:r.id || p.itemId, id:firstText(r.produto_id, p.id, p.productId), productId:firstText(r.produto_id, p.productId, p.id), name, qty, price, cost, total:firstNumber(r.total, p.total, qty*price) };
    (itemsBySale.get(r.venda_id) || itemsBySale.set(r.venda_id, []).get(r.venda_id)).push(it);
  });
  data.sales = salesRows.map(r => { const s = byPayload(r, () => ({ id:r.id, date:r.data||'', clientId:r.cliente_id||'', userId:r.usuario_id||'', cashRegisterId:r.caixa_id||'', payment:r.pagamento||'', subtotal:+r.subtotal||0, discount:+r.desconto||0, total:+r.total||0, cost:+r.custo||0, cancelled:r.cancelada===1 })); s.items = itemsBySale.get(r.id) || s.items || []; return s; });

  data.cashRegisters = (await all('SELECT * FROM caixas ORDER BY abertura DESC')).map(r => {
    const p = payload(r);
    return { ...p, id:r.id || p.id, number:firstNumber(r.numero, p.number), operatorId:firstText(r.operador_id, p.operatorId), operatorName:firstText(r.operador_nome, p.operatorName), openedAt:firstText(r.abertura, p.openedAt), closedAt:firstText(r.fechamento, p.closedAt), status:firstText(r.status, p.status), initialAmount:firstNumber(r.valor_inicial, p.initialAmount), finalAmount:firstNumber(r.valor_final, p.finalAmount), expectedAmount:firstNumber(r.valor_esperado, p.expectedAmount), difference:firstNumber(r.diferenca, p.difference), totalSales:firstNumber(r.total_vendido, p.totalSales), salesCount:firstNumber(r.vendas_qtd, p.salesCount), cashSales:firstNumber(r.dinheiro_vendas, p.cashSales), pixSales:firstNumber(r.pix_vendas, p.pixSales), debitSales:firstNumber(r.debito_vendas, p.debitSales), creditSales:firstNumber(r.credito_vendas, p.creditSales), fiadoSales:firstNumber(r.fiado_vendas, p.fiadoSales), sangrias:firstNumber(r.sangrias, p.sangrias), suprimentos:firstNumber(r.suprimentos, p.suprimentos), obs:firstText(r.observacao, p.obs) };
  });
  data = normalizeAppDataForSqlite(data);
  data.stockMoves = (await all('SELECT * FROM estoque_movimentos ORDER BY data DESC')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', productId:r.produto_id||'', type:r.tipo||'', qty:+r.quantidade||0, obs:r.observacao||'' })));
  data.expenses = (await all('SELECT * FROM despesas ORDER BY data DESC')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', description:r.descricao||'', category:r.categoria||'', value:+r.valor||0, paid:r.pago!==0 })));
  data.receivables = (await all('SELECT * FROM contas_receber ORDER BY data DESC')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', clientId:r.cliente_id||'', saleId:r.venda_id||'', value:+r.valor||0, paid:r.pago===1 })));
  data.quotes = (await all('SELECT * FROM orcamentos ORDER BY data DESC')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', clientId:r.cliente_id||'', status:r.status||'Aberto', total:+r.total||0 })));
  data.deliveries = (await all('SELECT * FROM entregas ORDER BY data DESC')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', clientId:r.cliente_id||'', status:r.status||'Pendente', address:r.endereco||'', value:+r.valor||0 })));
  data.purchases = (await all('SELECT * FROM compras ORDER BY data DESC')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', supplierId:r.fornecedor_id||'', productId:r.produto_id||'', qty:+r.quantidade||0, cost:+r.custo||0, total:+r.total||0, status:r.status||'Recebida' })));
  data.nfeInvoices = (await all('SELECT * FROM nfe_notas ORDER BY data DESC')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', number:r.numero||'', series:r.serie||'', supplierId:r.fornecedor_id||'', total:+r.total||0 })));
  data.audit = (await all('SELECT * FROM auditoria ORDER BY data DESC LIMIT 1000')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', user:r.usuario||'', action:r.acao||'' })));
  data.accessLogs = (await all('SELECT * FROM acessos ORDER BY data DESC LIMIT 1000')).map(r => byPayload(r, () => ({ id:r.id, date:r.data||'', user:r.usuario||'', role:r.perfil||'', action:r.acao||'', extra:r.extra||'' })));

  return { ok: true, data, path: dbPath, mode: 'sqlite-relacional', companyId: currentCompanyId, companies: listCompanies().companies };
}

async function replaceTable(table) { await run(`DELETE FROM ${table}`); }
async function saveAppData(data = {}) {
  if (!db) return { ok: false, error: 'SQLite não inicializado' };
  const n = now();
  await run('BEGIN TRANSACTION');
  try {
    await metaSet('settings', data.settings || {});
    await metaSet('session', data.session || null);
    for (const table of ['produtos','clientes','usuarios','fornecedores','vendas_itens','vendas','caixas','estoque_movimentos','despesas','contas_receber','orcamentos','entregas','compras','nfe_notas','auditoria','acessos']) await replaceTable(table);

    for (const p of data.products || []) await run(`INSERT OR REPLACE INTO produtos(id,nome,codigo_barras,categoria,unidade,marca,fornecedor,custo,venda,estoque,minimo,imagem,ativo,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [p.id,p.name||'',p.barcode||'',p.category||'',p.unit||'un',p.brand||'',p.supplierName||'',+p.cost||0,+p.sale||0,+p.stock||0,+p.min||0,p.image||'',p.active===false?0:1,json(p),n]);
    for (const c of data.clients || []) await run(`INSERT OR REPLACE INTO clientes(id,nome,telefone,cidade,endereco,documento,email,limite,ativo,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [c.id,c.name||'',c.phone||'',c.city||'',c.address||'',c.document||'',c.email||'',+c.creditLimit||0,c.active===false?0:1,json(c),n]);
    for (const u of data.users || []) await run(`INSERT OR REPLACE INTO usuarios(id,nome,usuario,senha_hash,perfil,ativo,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?)`, [u.id,u.name||'',u.user||'',u.passwordHash||'',u.role||'',u.active===false?0:1,json(u),n]);
    for (const s of data.suppliers || []) await run(`INSERT OR REPLACE INTO fornecedores(id,nome,telefone,cidade,documento,email,ativo,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`, [s.id,s.name||'',s.phone||'',s.city||'',s.document||'',s.email||'',s.active===false?0:1,json(s),n]);

    for (const s of data.sales || []) {
      await run(`INSERT OR REPLACE INTO vendas(id,data,cliente_id,usuario_id,caixa_id,pagamento,subtotal,desconto,total,custo,cancelada,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [s.id,s.date||'',s.clientId||'',s.userId||s.operatorId||'',s.cashRegisterId||'',s.payment||'',+s.subtotal||0,+s.discount||0,+s.total||0,+s.cost||0,s.cancelled?1:0,json(s),n]);
      for (const it of s.items || []) { const qty=+it.qty||+it.quantidade||0, price=+it.price||+it.valor_unitario||+it.unitPrice||0, cost=+it.cost||+it.custo_unitario||0, name=it.name||it.nome||it.productName||''; await run(`INSERT OR REPLACE INTO vendas_itens(id,venda_id,produto_id,nome,quantidade,valor_unitario,custo_unitario,total,payload_json) VALUES(?,?,?,?,?,?,?,?,?)`, [it.itemId || `${s.id}_${it.id||it.productId}`,s.id,it.id||it.productId||'',name,qty,price,cost,+it.total||qty*price,json({...it,name,qty,price,cost,total:+it.total||qty*price})]); }
    }
    for (const c of data.cashRegisters || []) await run(`INSERT OR REPLACE INTO caixas(id,numero,operador_id,operador_nome,abertura,fechamento,status,valor_inicial,valor_final,valor_esperado,diferenca,total_vendido,vendas_qtd,dinheiro_vendas,pix_vendas,debito_vendas,credito_vendas,fiado_vendas,sangrias,suprimentos,observacao,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [c.id,+c.number||0,c.operatorId||'',c.operatorName||'',c.openedAt||'',c.closedAt||'',c.status||'',+c.initialAmount||0,+c.finalAmount||0,+c.expectedAmount||0,+c.difference||0,+c.totalSales||0,+c.salesCount||0,+c.cashSales||0,+c.pixSales||0,+c.debitSales||0,+c.creditSales||0,+c.fiadoSales||0,+c.sangrias||0,+c.suprimentos||0,c.obs||'',json(c),n]);
    for (const m of data.stockMoves || []) await run(`INSERT OR REPLACE INTO estoque_movimentos(id,data,produto_id,tipo,quantidade,observacao,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?)`, [m.id,m.date||'',m.productId||'',m.type||'',+m.qty||0,m.obs||'',json(m),n]);
    for (const e of data.expenses || []) await run(`INSERT OR REPLACE INTO despesas(id,data,descricao,categoria,valor,pago,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?)`, [e.id,e.date||'',e.description||'',e.category||'',+e.value||0,e.paid===false?0:1,json(e),n]);
    for (const r of data.receivables || []) await run(`INSERT OR REPLACE INTO contas_receber(id,data,cliente_id,venda_id,valor,pago,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?)`, [r.id,r.date||'',r.clientId||'',r.saleId||'',+r.value||0,r.paid?1:0,json(r),n]);
    for (const q of data.quotes || []) await run(`INSERT OR REPLACE INTO orcamentos(id,data,cliente_id,status,total,payload_json,updated_at) VALUES(?,?,?,?,?,?,?)`, [q.id,q.date||'',q.clientId||'',q.status||'Aberto',+q.total||0,json(q),n]);
    for (const d of data.deliveries || []) await run(`INSERT OR REPLACE INTO entregas(id,data,cliente_id,status,endereco,valor,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?)`, [d.id,d.date||'',d.clientId||'',d.status||'Pendente',d.address||'',+d.value||0,json(d),n]);
    for (const p of data.purchases || []) await run(`INSERT OR REPLACE INTO compras(id,data,fornecedor_id,produto_id,quantidade,custo,total,status,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`, [p.id,p.date||'',p.supplierId||'',p.productId||'',+p.qty||0,+p.cost||0,+p.total||0,p.status||'Recebida',json(p),n]);
    for (const nf of data.nfeInvoices || []) await run(`INSERT OR REPLACE INTO nfe_notas(id,data,numero,serie,fornecedor_id,total,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?)`, [nf.id,nf.date||'',nf.number||nf.numero||'',nf.series||nf.serie||'',nf.supplierId||'',+nf.total||0,json(nf),n]);
    for (const a of (data.audit || []).slice(0,1000)) await run(`INSERT OR REPLACE INTO auditoria(id,data,usuario,acao,payload_json) VALUES(?,?,?,?,?)`, [a.id,a.date||'',a.user||'',a.action||'',json(a)]);
    for (const a of (data.accessLogs || []).slice(0,1000)) await run(`INSERT OR REPLACE INTO acessos(id,data,usuario,perfil,acao,extra,payload_json) VALUES(?,?,?,?,?,?,?)`, [a.id,a.date||'',a.user||'',a.role||'',a.action||'',a.extra||'',json(a)]);

    await run('COMMIT');
    return { ok: true, path: dbPath, mode: 'sqlite-relacional', companyId: currentCompanyId };
  } catch (e) {
    await run('ROLLBACK').catch(()=>{});
    throw e;
  }
}

async function info() {
  const tables = ['produtos','clientes','usuarios','fornecedores','vendas','caixas','estoque_movimentos','despesas','contas_receber','orcamentos','entregas','compras','nfe_notas','auditoria','acessos'];
  const counts = {};
  if (db) for (const t of tables) { try { const r = await get(`SELECT COUNT(*) AS total FROM ${t}`); counts[t] = r?.total || 0; } catch { counts[t] = 0; } }
  return { ok: true, path: dbPath, mode: 'sqlite-relacional', counts, companyId: currentCompanyId, companies: listCompanies().companies };
}

module.exports = { openDatabase, loadAppData, saveAppData, info, listCompanies, switchCompany, createCompany, updateCompany, deleteCompany };
