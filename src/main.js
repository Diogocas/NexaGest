const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const database = require('./database');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const pkg = require('../package.json');

let mainWindow = null;
let updaterState = {
  ok: true,
  status: 'Pronto',
  currentVersion: pkg.version,
  latestVersion: pkg.version,
  updateAvailable: false,
  progress: 0,
  checkedAt: null,
  downloaded: false,
  error: ''
};

let networkServer = null;
let networkServerState = {
  data: null,
  company: 'NexaGest',
  port: 3333,
  startedAt: null,
  clients: {},
  requests: 0,
  lastRequestAt: null,
  revision: 0,
  conflicts: []
};

function localIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return '127.0.0.1';
}

function networkUrl(port = networkServerState.port) {
  return `http://${localIp()}:${Number(port || 3333) || 3333}`;
}

function normalizeServerAddress(base) {
  let value = String(base || '').trim();
  if (!value) value = 'http://127.0.0.1:3333';
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  return value.replace(/\/+$/, '');
}

function clientIdFromRequest(req) {
  const address = req.socket?.remoteAddress || 'local';
  const agent = req.headers['user-agent'] || 'NexaGest';
  return `${address}|${agent}`;
}

function touchClient(req) {
  const id = clientIdFromRequest(req);
  networkServerState.clients[id] = {
    id,
    address: req.socket?.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
    lastSeenAt: new Date().toISOString()
  };
  networkServerState.requests += 1;
  networkServerState.lastRequestAt = new Date().toISOString();
}

function activeClientCount() {
  const limit = Date.now() - 1000 * 60 * 5;
  return Object.values(networkServerState.clients || {}).filter(c => Date.parse(c.lastSeenAt || '') >= limit).length;
}


function getMachineId() {
  try {
    const raw = [os.hostname(), os.userInfo().username, os.platform(), os.arch()].join('|');
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  } catch (_) {
    return crypto.createHash('sha256').update(os.hostname() || 'nexagest').digest('hex').slice(0, 32);
  }
}

function postJsonToUrl(url, payload = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(String(url || ''));
      const lib = parsed.protocol === 'https:' ? require('https') : require('http');
      const body = JSON.stringify(payload || {});
      const req = lib.request(parsed, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'NexaGest-License/9.2.0',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: timeoutMs
      }, res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error('Servidor de licença retornou HTTP ' + res.statusCode));
            return;
          }
          try { resolve(data ? JSON.parse(data) : { ok: true }); }
          catch (error) { reject(new Error('Resposta de licença inválida: ' + error.message)); }
        });
      });
      req.on('timeout', () => req.destroy(new Error('Tempo esgotado no servidor de licença.')));
      req.on('error', reject);
      req.write(body);
      req.end();
    } catch (error) { reject(error); }
  });
}

function normalizeLicenseResponse(response = {}, fallback = {}) {
  const ok = response.ok === true || response.active === true || response.status === 'active' || response.status === 'trial';
  return {
    ok,
    online: true,
    status: response.status || (ok ? 'active' : 'invalid'),
    label: response.label || (ok ? 'Licença online ativa' : 'Licença online inválida'),
    plan: response.plan || fallback.plan || 'Profissional',
    owner: response.owner || fallback.owner || '',
    email: response.email || fallback.email || '',
    expiresAt: response.expiresAt || response.expires_at || '',
    message: response.message || response.notes || '',
    token: response.token || fallback.token || '',
    checkedAt: new Date().toISOString(),
    deviceId: fallback.deviceId || getMachineId()
  };
}

function networkStatusPayload(extra = {}) {
  return {
    ok: true,
    app: 'NexaGest',
    version: require('../package.json').version,
    company: networkServerState.company,
    running: !!networkServer,
    host: localIp(),
    port: networkServerState.port,
    url: networkUrl(networkServerState.port),
    localhostUrl: `http://127.0.0.1:${networkServerState.port}`,
    startedAt: networkServerState.startedAt,
    clientsConnected: activeClientCount(),
    requests: networkServerState.requests,
    lastRequestAt: networkServerState.lastRequestAt,
    revision: networkServerState.revision || 0,
    conflicts: networkServerState.conflicts || [],
    serverTime: new Date().toISOString(),
    ...extra
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload muito grande'));
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(new Error('JSON inválido recebido.')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, obj, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(obj));
}


const CATALOG_SYNC_KEYS = ['products', 'clients', 'suppliers'];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function catalogRecordKey(item, type) {
  if (!item || typeof item !== 'object') return '';
  if (item.id) return `id:${item.id}`;
  if (type === 'products' && item.barcode) return `barcode:${item.barcode}`;
  if (item.name) return `name:${String(item.name).trim().toLowerCase()}`;
  if (item.phone) return `phone:${String(item.phone).replace(/\D/g, '')}`;
  return '';
}

function catalogSnapshot(data = {}) {
  const snapshot = {
    products: safeArray(data.products).map(x => ({ ...x })),
    clients: safeArray(data.clients).map(x => ({ ...x })),
    suppliers: safeArray(data.suppliers).map(x => ({ ...x })),
    meta: {
      company: data.settings?.company || networkServerState.company || 'NexaGest',
      version: require('../package.json').version,
      generatedAt: new Date().toISOString()
    }
  };
  snapshot.counts = catalogCounts(snapshot);
  return snapshot;
}

function catalogCounts(data = {}) {
  return {
    products: safeArray(data.products).length,
    clients: safeArray(data.clients).length,
    suppliers: safeArray(data.suppliers).length
  };
}

function rowTimestampValue(item) {
  const v = item?.updatedAt || item?.modifiedAt || item?.syncedAt || item?.date || item?.createdAt || '';
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}
function rowsDiffer(a, b) {
  try { return JSON.stringify({ ...a, syncedAt: undefined }) !== JSON.stringify({ ...b, syncedAt: undefined }); }
  catch (_) { return true; }
}
function registerServerConflict(type, key, current, incoming, winner = 'servidor') {
  networkServerState.conflicts = Array.isArray(networkServerState.conflicts) ? networkServerState.conflicts : [];
  networkServerState.conflicts.unshift({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    type, key, winner, at: new Date().toISOString(),
    localName: current?.name || current?.desc || current?.id || '',
    remoteName: incoming?.name || incoming?.desc || incoming?.id || ''
  });
  networkServerState.conflicts = networkServerState.conflicts.slice(0, 50);
}
function mergeCatalogArray(current = [], incoming = [], type = '') {
  const map = new Map();
  for (const item of safeArray(current)) {
    const key = catalogRecordKey(item, type) || `local:${map.size}`;
    map.set(key, { ...item });
  }
  let added = 0, updated = 0, conflicts = 0;
  for (const item of safeArray(incoming)) {
    const key = catalogRecordKey(item, type) || `remote:${map.size}`;
    const existing = map.get(key);
    if (existing) {
      updated += 1;
      if (rowsDiffer(existing, item) && rowTimestampValue(existing) > 0 && rowTimestampValue(item) > 0 && rowTimestampValue(existing) !== rowTimestampValue(item)) {
        conflicts += 1;
        registerServerConflict(type, key, existing, item, 'servidor');
      }
    } else added += 1;
    map.set(key, { ...(existing || {}), ...item, syncedAt: new Date().toISOString() });
  }
  return { rows: Array.from(map.values()), added, updated, conflicts };
}

function mergeCatalogsIntoData(currentData = {}, incomingCatalog = {}) {
  const next = { ...currentData, settings: { ...(currentData.settings || {}) } };
  const stats = {};
  for (const key of CATALOG_SYNC_KEYS) {
    const merged = mergeCatalogArray(currentData[key], incomingCatalog[key], key);
    next[key] = merged.rows;
    stats[key] = {
      added: merged.added,
      updated: merged.updated,
      total: merged.rows.length,
      conflicts: merged.conflicts || 0
    };
  }
  next.settings.lastSyncAt = new Date().toISOString();
  next.settings.lastCatalogSyncAt = next.settings.lastSyncAt;
  next.settings.lastCatalogSyncStats = stats;
  return { data: next, stats, counts: catalogCounts(next) };
}



const BUSINESS_SYNC_KEYS = ['sales', 'stockMoves', 'cashRegisters', 'receivables', 'expenses'];

function businessSnapshot(data = {}) {
  const snapshot = {
    sales: safeArray(data.sales).map(x => ({ ...x })),
    stockMoves: safeArray(data.stockMoves).map(x => ({ ...x })),
    cashRegisters: safeArray(data.cashRegisters).map(x => ({ ...x })),
    receivables: safeArray(data.receivables).map(x => ({ ...x })),
    expenses: safeArray(data.expenses).map(x => ({ ...x })),
    products: safeArray(data.products).map(x => ({ ...x })),
    meta: {
      company: data.settings?.company || networkServerState.company || 'NexaGest',
      version: require('../package.json').version,
      generatedAt: new Date().toISOString()
    }
  };
  snapshot.counts = businessCounts(snapshot);
  return snapshot;
}

function businessCounts(data = {}) {
  return {
    sales: safeArray(data.sales).length,
    stockMoves: safeArray(data.stockMoves).length,
    cashRegisters: safeArray(data.cashRegisters).length,
    receivables: safeArray(data.receivables).length,
    expenses: safeArray(data.expenses).length,
    products: safeArray(data.products).length
  };
}

function genericRecordKey(item, fallbackPrefix = 'row') {
  if (!item || typeof item !== 'object') return '';
  if (item.id) return `id:${item.id}`;
  if (item.saleId) return `sale:${item.saleId}`;
  if (item.productId && item.date && item.type) return `${item.productId}:${item.date}:${item.type}`;
  if (item.number && item.openedAt) return `cash:${item.number}:${item.openedAt}`;
  if (item.date && (item.desc || item.description) && item.value) return `${item.date}:${item.desc || item.description}:${item.value}`;
  return `${fallbackPrefix}:${JSON.stringify(item).slice(0, 120)}`;
}

function mergeBusinessArray(current = [], incoming = [], type = '') {
  const map = new Map();
  for (const item of safeArray(current)) {
    const key = genericRecordKey(item, type) || `${type}:local:${map.size}`;
    map.set(key, { ...item });
  }
  let added = 0, updated = 0, conflicts = 0;
  for (const item of safeArray(incoming)) {
    const key = genericRecordKey(item, type) || `${type}:remote:${map.size}`;
    const existing = map.get(key);
    if (existing) {
      updated += 1;
      if (rowsDiffer(existing, item) && rowTimestampValue(existing) > 0 && rowTimestampValue(item) > 0 && rowTimestampValue(existing) !== rowTimestampValue(item)) {
        conflicts += 1;
        registerServerConflict(type, key, existing, item, 'servidor');
      }
    } else added += 1;
    map.set(key, { ...(existing || {}), ...item, syncedAt: new Date().toISOString() });
  }
  return { rows: Array.from(map.values()), added, updated, conflicts };
}

function mergeBusinessProducts(current = [], incoming = []) {
  const map = new Map();
  for (const item of safeArray(current)) {
    const key = catalogRecordKey(item, 'products') || `product:${map.size}`;
    map.set(key, { ...item });
  }
  let added = 0, updated = 0, conflicts = 0;
  for (const item of safeArray(incoming)) {
    const key = catalogRecordKey(item, 'products') || `product:${map.size}`;
    const existing = map.get(key);
    if (existing) {
      updated += 1;
      if (rowsDiffer(existing, item) && rowTimestampValue(existing) > 0 && rowTimestampValue(item) > 0 && rowTimestampValue(existing) !== rowTimestampValue(item)) {
        conflicts += 1;
        registerServerConflict('products', key, existing, item, 'servidor');
      }
    } else added += 1;
    map.set(key, { ...(existing || {}), ...item, syncedAt: new Date().toISOString() });
  }
  return { rows: Array.from(map.values()), added, updated, conflicts };
}

function mergeBusinessIntoData(currentData = {}, incomingBusiness = {}) {
  const next = { ...currentData, settings: { ...(currentData.settings || {}) } };
  const stats = {};
  for (const key of BUSINESS_SYNC_KEYS) {
    const merged = mergeBusinessArray(currentData[key], incomingBusiness[key], key);
    next[key] = merged.rows;
    stats[key] = { added: merged.added, updated: merged.updated, total: merged.rows.length, conflicts: merged.conflicts || 0 };
  }
  if (incomingBusiness.products) {
    const mergedProducts = mergeBusinessProducts(currentData.products, incomingBusiness.products);
    next.products = mergedProducts.rows;
    stats.products = { added: mergedProducts.added, updated: mergedProducts.updated, total: mergedProducts.rows.length, conflicts: mergedProducts.conflicts || 0 };
  }
  next.settings.lastSyncAt = new Date().toISOString();
  next.settings.lastBusinessSyncAt = next.settings.lastSyncAt;
  next.settings.lastBusinessSyncStats = stats;
  return { data: next, stats, counts: businessCounts(next) };
}

async function requestJson(base, action, payload) {
  const started = Date.now();
  return new Promise((resolve) => {
    try {
      const normalizedBase = normalizeServerAddress(base);
      const u = new URL(`/nexagest-${action}`, normalizedBase);
      const body = payload ? JSON.stringify(payload) : '';
      const req = http.request({
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: payload ? 'POST' : 'GET',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'NexaGest-Desktop'
        }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data || '{}');
            resolve({ ...parsed, httpStatus: res.statusCode, pingMs: Date.now() - started, address: normalizedBase });
          } catch (e) {
            resolve({ ok: false, error: 'Resposta inválida do servidor', pingMs: Date.now() - started, address: normalizedBase });
          }
        });
      });
      req.on('timeout', () => req.destroy(new Error('Tempo de conexão esgotado.')));
      req.on('error', e => resolve({ ok: false, error: e.message, pingMs: Date.now() - started, address: normalizedBase }));
      if (body) req.write(body);
      req.end();
    } catch (e) {
      resolve({ ok: false, error: e.message, pingMs: Date.now() - started });
    }
  });
}


function sendUpdaterEvent(channel, payload = {}) {
  updaterState = { ...updaterState, ...payload, currentVersion: pkg.version };
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('nexagest-updater-event', { channel, ...updaterState });
    }
  } catch (_) {}
}

function configureAutoUpdater(payload = {}) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = console;

  const owner = String(payload.githubOwner || payload.owner || 'Diogocas').trim();
  const repo = String(payload.githubRepo || payload.repo || 'NexaGest').trim();
  if (owner && repo) {
    autoUpdater.setFeedURL({ provider: 'github', owner, repo, releaseType: 'release' });
  }
}

function normalizeUpdaterInfo(info = {}) {
  const latestVersion = String(info.version || updaterState.latestVersion || pkg.version);
  return {
    ok: true,
    source: 'electron-updater',
    app: 'NexaGest',
    currentVersion: pkg.version,
    latestVersion,
    version: latestVersion,
    updateAvailable: compareVersions(latestVersion, pkg.version) > 0,
    notes: info.releaseNotes || info.releaseName || '',
    releaseUrl: '',
    installer: 'NexaGest-Setup.exe',
    checkedAt: new Date().toISOString(),
    downloaded: !!updaterState.downloaded,
    progress: updaterState.progress || 0,
    status: updaterState.status || 'Pronto'
  };
}


let startupUpdatePromptShown = false;
let downloadedUpdatePromptShown = false;
let startupUpdateCheckDone = false;

function updaterRepoConfigFromPackage() {
  try {
    const publish = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build?.publish;
    return {
      owner: publish?.owner || 'Diogocas',
      repo: publish?.repo || 'NexaGest'
    };
  } catch (_) {
    return { owner: 'Diogocas', repo: 'NexaGest' };
  }
}

function runStartupUpdateCheck() {
  if (startupUpdateCheckDone) return;
  startupUpdateCheckDone = true;
  if (!app.isPackaged) {
    sendUpdaterEvent('dev-skip', {
      ok: true,
      status: 'Atualização automática ativa apenas no app instalado.',
      checkedAt: new Date().toISOString()
    });
    return;
  }
  try {
    const cfg = updaterRepoConfigFromPackage();
    configureAutoUpdater(cfg);
    sendUpdaterEvent('startup-check', {
      ok: true,
      status: 'Verificando atualização automaticamente...',
      checkedAt: new Date().toISOString()
    });
    autoUpdater.checkForUpdates().catch(error => {
      sendUpdaterEvent('startup-error', {
        ok: false,
        status: 'Não foi possível verificar atualização automática.',
        error: String(error && error.message || error),
        checkedAt: new Date().toISOString()
      });
    });
  } catch (error) {
    sendUpdaterEvent('startup-error', {
      ok: false,
      status: 'Falha ao preparar atualização automática.',
      error: String(error && error.message || error),
      checkedAt: new Date().toISOString()
    });
  }
}

function askUserToDownloadUpdate(info = {}) {
  if (startupUpdatePromptShown || !mainWindow || mainWindow.isDestroyed()) return;
  startupUpdatePromptShown = true;
  const version = info.version || updaterState.latestVersion || 'nova';
  const detail = 'Versão instalada: ' + pkg.version + '\nVersão disponível: ' + version + '\n\nO NexaGest pode baixar a atualização agora e instalar em seguida.';
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Atualização disponível',
    message: 'NexaGest ' + version + ' disponível',
    detail,
    buttons: ['Baixar agora', 'Depois'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      sendUpdaterEvent('download-started', { status: 'Iniciando download da atualização...', progress: 0, ok: true });
      autoUpdater.downloadUpdate().catch(error => sendUpdaterEvent('error', {
        status: 'Falha ao baixar atualização',
        ok: false,
        error: String(error && error.message || error)
      }));
    }
  }).catch(() => {});
}

function askUserToInstallUpdate(info = {}) {
  if (downloadedUpdatePromptShown || !mainWindow || mainWindow.isDestroyed()) return;
  downloadedUpdatePromptShown = true;
  const version = info.version || updaterState.latestVersion || 'nova';
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Atualização pronta',
    message: 'Atualização do NexaGest baixada',
    detail: 'A versão ' + version + ' foi baixada. Deseja reiniciar agora para instalar?',
    buttons: ['Reiniciar e instalar', 'Instalar ao sair'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) autoUpdater.quitAndInstall(false, true);
  }).catch(() => {});
}

autoUpdater.on('checking-for-update', () => sendUpdaterEvent('checking', { status: 'Verificando atualização...', ok: true, error: '' }));
autoUpdater.on('update-available', info => { sendUpdaterEvent('available', { status: 'Nova versão disponível', ok: true, updateAvailable: true, latestVersion: String(info.version || ''), checkedAt: new Date().toISOString(), info }); askUserToDownloadUpdate(info); });
autoUpdater.on('update-not-available', info => sendUpdaterEvent('not-available', { status: 'Sistema atualizado', ok: true, updateAvailable: false, latestVersion: String(info.version || pkg.version), checkedAt: new Date().toISOString(), info }));
autoUpdater.on('download-progress', progress => sendUpdaterEvent('progress', { status: 'Baixando atualização...', ok: true, progress: Math.round(progress.percent || 0), bytesPerSecond: progress.bytesPerSecond, transferred: progress.transferred, total: progress.total }));
autoUpdater.on('update-downloaded', info => { sendUpdaterEvent('downloaded', { status: 'Atualização baixada. Pronta para instalar.', ok: true, downloaded: true, progress: 100, latestVersion: String(info.version || updaterState.latestVersion || pkg.version), info }); askUserToInstallUpdate(info); });
autoUpdater.on('error', error => sendUpdaterEvent('error', { status: 'Falha na atualização', ok: false, error: String(error && error.message || error) }));

// Mantém os dados sempre em AppData/Roaming/nexagest, independente do nome da pasta/versão.
app.setName('NexaGest');
app.setPath('userData', path.join(app.getPath('appData'), 'nexagest')); // preserva dados das versões anteriores

function appIconPath() {
  const ico = path.join(__dirname, 'assets', 'icons', 'icon.png');
  const fallback = path.join(__dirname, 'assets', 'nexagest-logo.png');
  return fs.existsSync(ico) ? ico : fallback;
}

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 520,
    height: 420,
    frame: false,
    resizable: false,
    show: true,
    transparent: false,
    center: true,
    title: 'NexaGest',
    icon: appIconPath(),
    backgroundColor: '#020617',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false
    }
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  return splash;
}

function createWindow() {
  const splash = createSplashWindow();
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: 'NexaGest',
    icon: appIconPath(),
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  mainWindow = win;

  win.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.shift && input.key.toUpperCase() === 'I') {
      win.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
    if (input.key === 'F12') {
      win.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
  });

  win.once('ready-to-show', () => {
    setTimeout(() => {
      if (!win.isDestroyed()) win.show();
      if (splash && !splash.isDestroyed()) splash.close();
      setTimeout(runStartupUpdateCheck, 2500);
    }, 900);
  });

  win.on('closed', () => {
    if (splash && !splash.isDestroyed()) splash.close();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  database.openDatabase(app.getPath('userData'));
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });





ipcMain.handle('generate-qr-code', async (_event, text) => {
  try {
    const QRCode = require('qrcode');
    const dataUrl = await QRCode.toDataURL(String(text || ''), { errorCorrectionLevel: 'M', margin: 2, width: 260 });
    return { ok: true, dataUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('open-external-url', async (_event, url) => {
  try {
    const value = String(url || '');
    if (!/^https?:\/\//i.test(value) && !/^whatsapp:\/\//i.test(value)) {
      return { ok: false, error: 'URL externa inválida.' };
    }
    await shell.openExternal(value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error && error.message || error) };
  }
});

ipcMain.handle('db-load', async () => {
  try { return await database.loadAppData(); }
  catch (error) { return { ok: false, error: String(error && error.message || error) }; }
});

ipcMain.handle('db-save', async (_event, data) => {
  try { return await database.saveAppData(data); }
  catch (error) { return { ok: false, error: String(error && error.message || error) }; }
});

ipcMain.handle('db-info', async () => {
  try { return await database.info(); }
  catch (error) { return { ok: false, error: String(error && error.message || error) }; }
});

ipcMain.handle('companies-list', async () => {
  try { return database.listCompanies(); }
  catch (error) { return { ok: false, error: String(error && error.message || error) }; }
});

ipcMain.handle('company-switch', async (_event, companyId) => {
  try { return await database.switchCompany(companyId); }
  catch (error) { return { ok: false, error: String(error && error.message || error) }; }
});

ipcMain.handle('company-create', async (_event, payload, baseData) => {
  try { return await database.createCompany(payload, baseData); }
  catch (error) { return { ok: false, error: String(error && error.message || error) }; }
});

ipcMain.handle('company-update', async (_event, payload) => {
  try { return database.updateCompany(payload); }
  catch (error) { return { ok: false, error: String(error && error.message || error) }; }
});

ipcMain.handle('company-delete', async (_event, companyId) => {
  try { return database.deleteCompany(companyId); }
  catch (error) { return { ok: false, error: String(error && error.message || error) }; }
});


ipcMain.handle('network-start-server', async (_event, payload = {}) => {
  try {
    const port = Number(payload.port || 3333) || 3333;
    if (networkServer) {
      return { ...networkStatusPayload(), alreadyRunning: true };
    }

    networkServerState = {
      data: payload.data || null,
      company: payload.company || payload.data?.settings?.company || 'NexaGest',
      port,
      startedAt: new Date().toISOString(),
      clients: {},
      requests: 0,
      lastRequestAt: null,
      revision: Date.now(),
      conflicts: []
    };

    networkServer = http.createServer(async (req, res) => {
      if (req.method === 'OPTIONS') return sendJson(res, { ok: true });
      touchClient(req);
      try {
        if (req.url === '/nexagest-status' || req.url === '/nexagest-ping') {
          return sendJson(res, networkStatusPayload({ message: 'Servidor NexaGest ativo.' }));
        }
        if (req.url === '/nexagest-pull') {
          const loaded = await database.loadAppData();
          return sendJson(res, {
            ...networkStatusPayload(),
            data: loaded.data || networkServerState.data,
            updatedAt: new Date().toISOString()
          });
        }
        if (req.url === '/nexagest-catalogs') {
          const loaded = await database.loadAppData();
          const data = loaded.data || networkServerState.data || {};
          return sendJson(res, {
            ...networkStatusPayload(),
            catalog: catalogSnapshot(data),
            counts: catalogCounts(data),
            updatedAt: new Date().toISOString()
          });
        }
        if (req.url === '/nexagest-catalogs-push' && req.method === 'POST') {
          const body = await readBody(req);
          const incoming = body.catalog || body.data || {};
          const loaded = await database.loadAppData();
          const current = loaded.data || networkServerState.data || {};
          const merged = mergeCatalogsIntoData(current, incoming);
          networkServerState.data = merged.data;
          networkServerState.company = body.company || merged.data?.settings?.company || networkServerState.company;
          await database.saveAppData(merged.data);
          networkServerState.revision = Date.now();
          return sendJson(res, {
            ...networkStatusPayload(),
            synced: true,
            scope: 'catalogs',
            stats: merged.stats,
            counts: merged.counts,
            updatedAt: new Date().toISOString()
          });
        }
        if (req.url === '/nexagest-business') {
          const loaded = await database.loadAppData();
          const data = loaded.data || networkServerState.data || {};
          return sendJson(res, {
            ...networkStatusPayload(),
            business: businessSnapshot(data),
            counts: businessCounts(data),
            updatedAt: new Date().toISOString()
          });
        }
        if (req.url === '/nexagest-business-push' && req.method === 'POST') {
          const body = await readBody(req);
          const incoming = body.business || body.data || {};
          const loaded = await database.loadAppData();
          const current = loaded.data || networkServerState.data || {};
          const merged = mergeBusinessIntoData(current, incoming);
          networkServerState.data = merged.data;
          networkServerState.company = body.company || merged.data?.settings?.company || networkServerState.company;
          await database.saveAppData(merged.data);
          networkServerState.revision = Date.now();
          return sendJson(res, {
            ...networkStatusPayload(),
            synced: true,
            scope: 'business',
            stats: merged.stats,
            counts: merged.counts,
            updatedAt: new Date().toISOString()
          });
        }
        if (req.url === '/nexagest-push' && req.method === 'POST') {
          const body = await readBody(req);
          if (!body.data) return sendJson(res, { ok: false, error: 'Nenhum dado recebido' }, 400);
          networkServerState.data = body.data;
          networkServerState.company = body.company || body.data?.settings?.company || networkServerState.company;
          await database.saveAppData(body.data);
          networkServerState.revision = Date.now();
          return sendJson(res, { ...networkStatusPayload(), updatedAt: new Date().toISOString() });
        }
        return sendJson(res, { ok: false, error: 'Rota não encontrada' }, 404);
      } catch (error) {
        return sendJson(res, { ok: false, error: String(error && error.message || error) }, 500);
      }
    });

    await new Promise((resolve, reject) => {
      networkServer.once('error', reject);
      networkServer.listen(port, '0.0.0.0', resolve);
    });
    return networkStatusPayload({ started: true });
  } catch (error) {
    networkServer = null;
    return { ok: false, error: String(error && error.message || error) };
  }
});

ipcMain.handle('network-stop-server', async () => {
  try {
    if (!networkServer) return { ok: true, stopped: true, running: false };
    await new Promise(resolve => networkServer.close(resolve));
    networkServer = null;
    return { ok: true, stopped: true, running: false, port: networkServerState.port };
  } catch (error) {
    return { ok: false, error: String(error && error.message || error) };
  }
});

ipcMain.handle('network-request', async (_event, base, action, payload) => requestJson(base, action, payload));

ipcMain.handle('network-status', async () => networkStatusPayload());

ipcMain.handle('network-self-test', async (_event, payload = {}) => {
  try {
    const port = Number(payload.port || networkServerState.port || 3333) || 3333;
    let startedHere = false;
    if (!networkServer) {
      networkServerState = {
        data: payload.data || null,
        company: payload.company || payload.data?.settings?.company || 'NexaGest',
        port,
        startedAt: new Date().toISOString(),
        clients: {},
        requests: 0,
        lastRequestAt: null,
        revision: Date.now(),
        conflicts: []
      };
      networkServer = http.createServer(async (req, res) => {
        if (req.method === 'OPTIONS') return sendJson(res, { ok: true });
        touchClient(req);
        try {
          if (req.url === '/nexagest-status' || req.url === '/nexagest-ping') return sendJson(res, networkStatusPayload({ message: 'Servidor NexaGest ativo.' }));
          if (req.url === '/nexagest-pull') {
            const loaded = await database.loadAppData();
            return sendJson(res, { ...networkStatusPayload(), data: loaded.data || networkServerState.data, updatedAt: new Date().toISOString() });
          }
          if (req.url === '/nexagest-catalogs') {
            const loaded = await database.loadAppData();
            const data = loaded.data || networkServerState.data || {};
            return sendJson(res, { ...networkStatusPayload(), catalog: catalogSnapshot(data), counts: catalogCounts(data), updatedAt: new Date().toISOString() });
          }
          if (req.url === '/nexagest-catalogs-push' && req.method === 'POST') {
            const body = await readBody(req);
            const incoming = body.catalog || body.data || {};
            const loaded = await database.loadAppData();
            const current = loaded.data || networkServerState.data || {};
            const merged = mergeCatalogsIntoData(current, incoming);
            networkServerState.data = merged.data;
            networkServerState.company = body.company || merged.data?.settings?.company || networkServerState.company;
            await database.saveAppData(merged.data);
            networkServerState.revision = Date.now();
            return sendJson(res, { ...networkStatusPayload(), synced: true, scope: 'catalogs', stats: merged.stats, counts: merged.counts, updatedAt: new Date().toISOString() });
          }
          if (req.url === '/nexagest-business') {
            const loaded = await database.loadAppData();
            const data = loaded.data || networkServerState.data || {};
            return sendJson(res, { ...networkStatusPayload(), business: businessSnapshot(data), counts: businessCounts(data), updatedAt: new Date().toISOString() });
          }
          if (req.url === '/nexagest-business-push' && req.method === 'POST') {
            const body = await readBody(req);
            const incoming = body.business || body.data || {};
            const loaded = await database.loadAppData();
            const current = loaded.data || networkServerState.data || {};
            const merged = mergeBusinessIntoData(current, incoming);
            networkServerState.data = merged.data;
            networkServerState.company = body.company || merged.data?.settings?.company || networkServerState.company;
            await database.saveAppData(merged.data);
            networkServerState.revision = Date.now();
            return sendJson(res, { ...networkStatusPayload(), synced: true, scope: 'business', stats: merged.stats, counts: merged.counts, updatedAt: new Date().toISOString() });
          }
          return sendJson(res, { ok: false, error: 'Rota não encontrada' }, 404);
        } catch (error) { return sendJson(res, { ok: false, error: String(error && error.message || error) }, 500); }
      });
      await new Promise((resolve, reject) => {
        networkServer.once('error', reject);
        networkServer.listen(port, '0.0.0.0', resolve);
      });
      startedHere = true;
    }
    const local = await requestJson(`http://127.0.0.1:${networkServerState.port}`, 'status');
    return { ok: !!local.ok, startedHere, local, server: networkStatusPayload(), error: local.ok ? '' : local.error };
  } catch (error) {
    return { ok: false, error: String(error && error.message || error) };
  }
});

ipcMain.handle('auto-backup', async (_event, data) => {
  try {
    const dir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const filePath = path.join(dir, `nexagest-auto-${day}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    return { ok: true, path: filePath };
  } catch (error) {
    return { ok: false, error: String(error && error.message || error) };
  }
});



function ensureDir(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); }
function cloudDefaultDir(provider){
  const name = String(provider||'Local').toLowerCase().replace(/\s+/g,'-');
  const dir = path.join(app.getPath('userData'),'cloud-backups',name);
  ensureDir(dir);
  return dir;
}
function encodeBackup(data, meta={}){
  const payload = { meta:{ app:'NexaGest', version: require('../package.json').version, createdAt:new Date().toISOString(), ...meta }, data };
  return 'NEXAGEST-CLOUD-BACKUP-V1\n' + Buffer.from(JSON.stringify(payload,null,2),'utf8').toString('base64');
}
function decodeBackup(raw){
  const text = String(raw||'');
  let decoded;
  if(text.startsWith('NEXAGEST-CLOUD-BACKUP-V1\n')){
    const b64 = text.split('\n').slice(1).join('\n');
    decoded = JSON.parse(Buffer.from(b64,'base64').toString('utf8'));
  }else{
    decoded = { meta:{ app:'NexaGest', createdAt:new Date().toISOString(), importedLegacy:true }, data: JSON.parse(text) };
  }
  if(!decoded || typeof decoded !== 'object' || !decoded.data || typeof decoded.data !== 'object'){
    throw new Error('Arquivo de backup inválido ou vazio.');
  }
  if(!decoded.data.settings && !decoded.data.products && !decoded.data.sales){
    throw new Error('Este arquivo não parece ser um backup do NexaGest.');
  }
  return decoded;
}

ipcMain.handle('cloud-pick-folder', async () => {
  const r = await dialog.showOpenDialog({ title:'Escolher pasta sincronizada', properties:['openDirectory','createDirectory'] });
  if(r.canceled || !r.filePaths?.[0]) return { ok:false };
  return { ok:true, path:r.filePaths[0] };
});

ipcMain.handle('cloud-backup', async (_event, payload={}) => {
  try{
    const provider = payload.provider || 'Local';
    const folder = payload.folder || cloudDefaultDir(provider);
    ensureDir(folder);
    const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const company = (payload.company || payload.data?.settings?.company || 'NexaGest').replace(/[\\/:*?"<>|]/g,'-');
    const filename = `NexaGest-${company}-${provider.replace(/\s+/g,'-')}-${stamp}.ngbackup`;
    const filePath = path.join(folder, filename);
    fs.writeFileSync(filePath, encodeBackup(payload.data, { provider, company }), 'utf8');
    return { ok:true, path:filePath, filename, provider, size:fs.statSync(filePath).size, createdAt:new Date().toISOString() };
  }catch(error){ return { ok:false, error:String(error && error.message || error) }; }
});

ipcMain.handle('cloud-list-backups', async (_event, payload={}) => {
  try{
    const provider = payload.provider || 'Local';
    const folder = payload.folder || cloudDefaultDir(provider);
    ensureDir(folder);
    const files = fs.readdirSync(folder).filter(f=>/\.(ngbackup|json)$/i.test(f)).map(filename=>{
      const filePath=path.join(folder,filename), st=fs.statSync(filePath);
      return { filename, path:filePath, size:st.size, modifiedAt:st.mtime.toISOString(), provider };
    }).sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
    return { ok:true, folder, files };
  }catch(error){ return { ok:false, error:String(error && error.message || error) }; }
});

ipcMain.handle('cloud-restore-backup', async (_event, payload={}) => {
  try{
    let filePath = payload.path;
    if(!filePath){
      const r = await dialog.showOpenDialog({ title:'Restaurar backup em nuvem', filters:[{name:'Backups NexaGest', extensions:['ngbackup','json']}], properties:['openFile'] });
      if(r.canceled || !r.filePaths?.[0]) return { ok:false };
      filePath = r.filePaths[0];
    }
    const raw = fs.readFileSync(filePath,'utf8');
    const decoded = decodeBackup(raw);
    return { ok:true, data:decoded.data, meta:decoded.meta, path:filePath };
  }catch(error){ return { ok:false, error:String(error && error.message || error) }; }
});


function compareVersions(a, b) {
  const pa = String(a || '0').split(/[.-]/).map(x => parseInt(x, 10) || 0);
  const pb = String(b || '0').split(/[.-]/).map(x => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function normalizeUpdateManifest(manifest = {}, source = 'local') {
  const pkg = require('../package.json');
  const latestVersion = String(manifest.latestVersion || manifest.version || pkg.version);
  return {
    ok: true,
    source,
    app: 'NexaGest',
    currentVersion: pkg.version,
    latestVersion,
    version: latestVersion,
    updateAvailable: compareVersions(latestVersion, pkg.version) > 0,
    channel: manifest.channel || 'stable',
    notes: manifest.notes || manifest.description || manifest.body || '',
    installer: manifest.installer || manifest.fileName || 'NexaGest-Setup.exe',
    portable: manifest.portable || 'NexaGest-Portable.exe',
    downloadUrl: manifest.downloadUrl || manifest.installerUrl || '',
    portableUrl: manifest.portableUrl || '',
    releaseUrl: manifest.releaseUrl || manifest.html_url || manifest.url || '',
    sha256: manifest.sha256 || '',
    publishedAt: manifest.publishedAt || manifest.date || '',
    checkedAt: new Date().toISOString()
  };
}


function normalizeGitHubRelease(release = {}, source = 'github') {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const installerAsset = assets.find(a => /NexaGest-Setup\.exe$/i.test(a.name || '')) || assets.find(a => /setup.*\.exe$/i.test(a.name || '')) || assets.find(a => /\.exe$/i.test(a.name || '')) || null;
  const portableAsset = assets.find(a => /NexaGest-Portable\.exe$/i.test(a.name || '')) || assets.find(a => /portable.*\.exe$/i.test(a.name || '')) || null;
  const tag = String(release.tag_name || release.name || '').replace(/^v/i, '');
  return normalizeUpdateManifest({
    latestVersion: tag || release.version,
    channel: release.prerelease ? 'beta' : 'stable',
    notes: release.body || release.name || '',
    installer: installerAsset?.name || 'NexaGest-Setup.exe',
    portable: portableAsset?.name || 'NexaGest-Portable.exe',
    downloadUrl: installerAsset?.browser_download_url || '',
    portableUrl: portableAsset?.browser_download_url || '',
    releaseUrl: release.html_url || '',
    publishedAt: release.published_at || release.created_at || ''
  }, source);
}

function buildGitHubLatestApiUrl(owner, repo) {
  owner = String(owner || '').trim();
  repo = String(repo || '').trim();
  if (!owner || !repo) return '';
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
}

function parseGitHubRepoInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const m1 = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (m1) return { owner: m1[1], repo: m1[2].replace(/\.git$/i, '') };
  const m2 = raw.match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+)(?:[\/\s#?]|$)/i);
  if (m2) return { owner: m2[1], repo: m2[2].replace(/\.git$/i, '') };
  return null;
}

function readLocalUpdateManifest(){
  const pkg = require('../package.json');
  const candidates = [
    path.join(__dirname, '..', 'updates', 'latest.json'),
    path.join(process.cwd(), 'updates', 'latest.json')
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
        return normalizeUpdateManifest(manifest, 'local');
      }
    } catch (error) {
      return { ok:false, source:'local', currentVersion:pkg.version, error:String(error && error.message || error), checkedAt:new Date().toISOString() };
    }
  }
  return normalizeUpdateManifest({ version: pkg.version, notes:'Nenhum manifesto local encontrado.' }, 'local');
}

function getJsonFromUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    try {
      if (redirectCount > 5) return reject(new Error('Muitos redirecionamentos ao verificar atualização.'));
      const parsed = new URL(String(url || ''));
      const lib = parsed.protocol === 'https:' ? require('https') : require('http');
      const req = lib.get(parsed, {
        headers: {
          'User-Agent': 'NexaGest-Updater',
          'Accept': 'application/json, application/vnd.github+json'
        },
        timeout: 15000
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const nextUrl = new URL(res.headers.location, parsed).toString();
          getJsonFromUrl(nextUrl, redirectCount + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error('Servidor retornou HTTP ' + res.statusCode));
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (error) { reject(new Error('Manifesto inválido: ' + error.message)); }
        });
      });
      req.on('timeout', () => { req.destroy(new Error('Tempo esgotado ao verificar atualização.')); });
      req.on('error', reject);
    } catch (error) { reject(error); }
  });
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(String(url || ''));
      const lib = parsed.protocol === 'https:' ? require('https') : require('http');
      ensureDir(path.dirname(destination));
      const file = fs.createWriteStream(destination);
      const req = lib.get(parsed, { headers: { 'User-Agent': 'NexaGest-Updater' }, timeout: 60000 }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close(); fs.rmSync(destination, { force:true });
          return downloadFile(res.headers.location, destination).then(resolve, reject);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          file.close(); fs.rmSync(destination, { force:true });
          reject(new Error('Download retornou HTTP ' + res.statusCode));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve({ ok:true, path:destination, size:fs.existsSync(destination)?fs.statSync(destination).size:0 })));
      });
      req.on('timeout', () => { req.destroy(new Error('Tempo esgotado no download.')); });
      req.on('error', err => { try{ file.close(); fs.rmSync(destination,{force:true}); }catch(e){} reject(err); });
    } catch (error) { reject(error); }
  });
}


ipcMain.handle('license-device-info', async () => ({ ok: true, deviceId: getMachineId(), hostname: os.hostname(), platform: os.platform(), arch: os.arch(), appVersion: pkg.version }));

ipcMain.handle('license-online-activate', async (_event, payload = {}) => {
  try {
    const endpoint = String(payload.licenseServerUrl || payload.endpoint || '').trim();
    if (!endpoint) return { ok: false, online: false, error: 'Informe a URL do servidor de licenças para ativação online.' };
    const deviceId = getMachineId();
    const body = {
      app: 'NexaGest',
      version: pkg.version,
      action: 'activate',
      licenseKey: payload.licenseKey || '',
      owner: payload.licenseOwner || payload.owner || '',
      email: payload.licenseEmail || payload.email || '',
      plan: payload.licensePlan || payload.plan || '',
      deviceId,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch()
    };
    const response = await postJsonToUrl(endpoint.replace(/\/+$/, '') + '/activate', body);
    return normalizeLicenseResponse(response, { ...body, deviceId });
  } catch (error) {
    return { ok: false, online: false, status: 'offline', label: 'Servidor de licença indisponível', error: String(error && error.message || error), checkedAt: new Date().toISOString(), deviceId: getMachineId() };
  }
});

ipcMain.handle('license-online-validate', async (_event, payload = {}) => {
  try {
    const endpoint = String(payload.licenseServerUrl || payload.endpoint || '').trim();
    if (!endpoint) return { ok: false, online: false, error: 'URL do servidor de licenças não configurada.' };
    const deviceId = getMachineId();
    const body = {
      app: 'NexaGest',
      version: pkg.version,
      action: 'validate',
      licenseKey: payload.licenseKey || '',
      token: payload.licenseToken || payload.token || '',
      email: payload.licenseEmail || payload.email || '',
      deviceId,
      hostname: os.hostname()
    };
    const response = await postJsonToUrl(endpoint.replace(/\/+$/, '') + '/validate', body);
    return normalizeLicenseResponse(response, { ...body, deviceId });
  } catch (error) {
    return { ok: false, online: false, status: 'offline', label: 'Validação online indisponível', error: String(error && error.message || error), checkedAt: new Date().toISOString(), deviceId: getMachineId() };
  }
});

ipcMain.handle('commercial-check-update', async (_event, payload = {}) => {
  try {
    configureAutoUpdater(payload || {});
    if (!app.isPackaged) {
      const dev = {
        ok: true,
        source: 'electron-updater-dev',
        app: 'NexaGest',
        currentVersion: pkg.version,
        latestVersion: pkg.version,
        version: pkg.version,
        updateAvailable: false,
        status: 'Modo desenvolvimento: gere/instale o Setup para testar atualização real. Se a Release tiver a mesma versão instalada, nenhuma atualização aparece.',
        notes: 'O electron-updater verifica atualizações apenas no aplicativo empacotado.',
        checkedAt: new Date().toISOString()
      };
      updaterState = { ...updaterState, ...dev };
      return dev;
    }
    const result = await autoUpdater.checkForUpdates();
    const info = result && result.updateInfo ? result.updateInfo : {};
    const normalized = normalizeUpdaterInfo(info);
    updaterState = { ...updaterState, ...normalized };
    return normalized;
  } catch (error) {
    const result = { ok: false, source: 'electron-updater', currentVersion: pkg.version, latestVersion: pkg.version, updateAvailable: false, status: 'Falha ao verificar atualização', error: String(error && error.message || error), checkedAt: new Date().toISOString() };
    updaterState = { ...updaterState, ...result };
    return result;
  }
});

ipcMain.handle('commercial-download-update', async (_event, payload = {}) => {
  try {
    configureAutoUpdater(payload || {});
    if (!app.isPackaged) {
      return { ok: false, source: 'electron-updater-dev', error: 'A instalação automática só funciona no aplicativo instalado pelo Setup.' };
    }
    if (!updaterState.updateAvailable && payload.updateAvailable !== true) {
      const checked = await autoUpdater.checkForUpdates();
      const info = checked && checked.updateInfo ? checked.updateInfo : {};
      updaterState = { ...updaterState, ...normalizeUpdaterInfo(info) };
    }
    if (!updaterState.updateAvailable && payload.updateAvailable !== true) {
      return { ok: false, source: 'electron-updater', error: 'Nenhuma atualização disponível.' };
    }
    sendUpdaterEvent('download-started', { status: 'Iniciando download da atualização...', progress: 0, ok: true });
    await autoUpdater.downloadUpdate();
    setTimeout(() => {
      try { autoUpdater.quitAndInstall(false, true); } catch (_) {}
    }, 1200);
    return { ok: true, source: 'electron-updater', status: 'Atualização baixada. Reiniciando para instalar...', installing: true };
  } catch (error) {
    return { ok: false, source: 'electron-updater', error: String(error && error.message || error) };
  }
});

ipcMain.handle('commercial-install-update', async () => {
  try {
    if (!app.isPackaged) return { ok:false, error:'Instalação automática disponível apenas no app instalado.' };
    autoUpdater.quitAndInstall(false, true);
    return { ok:true };
  } catch (error) {
    return { ok:false, error:String(error && error.message || error) };
  }
});

ipcMain.handle('commercial-update-status', async () => ({ ...updaterState, currentVersion: pkg.version }));

ipcMain.handle('commercial-open-docs', async () => {
  const doc = path.join(process.cwd(), 'docs', 'PRIMEIRO_USO.md');
  if (fs.existsSync(doc)) {
    await shell.openPath(doc);
    return { ok:true, path:doc };
  }
  return { ok:false, error:'Documentação não encontrada.' };
});

ipcMain.handle('commercial-open-downloads', async () => {
  const dir = app.getPath('downloads');
  await shell.openPath(dir);
  return { ok:true, path:dir };
});

ipcMain.handle('get-app-info', async () => {
  const pkg = require('../package.json');
  return {
    version: pkg.version,
    dataPath: app.getPath('userData'),
    sqlite: await database.info()
  };
});

ipcMain.handle('save-backup', async (_event, data) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = await dialog.showSaveDialog({
    title: 'Salvar backup do NexaGest',
    defaultPath: `nexagest-backup-${stamp}.json`,
    filters: [{ name: 'Backup JSON', extensions: ['json'] }]
  });
  if (file.canceled || !file.filePath) return { ok: false };
  fs.writeFileSync(file.filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, path: file.filePath };
});

ipcMain.handle('load-backup', async () => {
  const file = await dialog.showOpenDialog({
    title: 'Restaurar backup do NexaGest',
    filters: [{ name: 'Backup JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (file.canceled || !file.filePaths?.[0]) return { ok: false };
  const raw = fs.readFileSync(file.filePaths[0], 'utf8');
  return { ok: true, data: JSON.parse(raw) };
});

ipcMain.handle('export-html', async (_event, payload) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = await dialog.showSaveDialog({
    title: payload.title || 'Exportar relatório',
    defaultPath: `${payload.filename || 'nexagest-relatorio'}-${stamp}.html`,
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });
  if (file.canceled || !file.filePath) return { ok: false };
  fs.writeFileSync(file.filePath, payload.html, 'utf8');
  return { ok: true, path: file.filePath };
});
