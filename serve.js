const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists for local submission storage
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function appendSubmission(filename, record) {
  const filePath = path.join(DATA_DIR, filename);
  let records = [];
  try { records = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) {}
  records.push(record);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (_) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const host = (req.headers.host || '').split(':')[0];

  // www redirect — only fires on the real domain (not Replit dev domains)
  if (host === 'banproof.me') {
    res.writeHead(301, { Location: `https://www.banproof.me${req.url}` });
    res.end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const urlPath = req.url.split('?')[0];

  // ── API: /api/contact ──
  if (urlPath === '/api/contact') {
    if (req.method === 'OPTIONS') { jsonResponse(res, 204, {}); return; }
    if (req.method !== 'POST') { jsonResponse(res, 405, { ok: false, error: 'Method not allowed' }); return; }
    try {
      const { name, email, tier, notes } = await readBody(req);
      if (!name || !email) { jsonResponse(res, 422, { ok: false, error: 'Name and email are required.' }); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { jsonResponse(res, 422, { ok: false, error: 'Invalid email address.' }); return; }
      const record = { id: Date.now().toString(), name, email, tier: tier || '', notes: notes || '', submittedAt: new Date().toISOString() };
      appendSubmission('contacts.json', record);
      console.log(`[contact] ${name} <${email}> — plan: ${tier || 'n/a'}`);
      jsonResponse(res, 200, { ok: true });
    } catch (err) {
      console.error('[contact] error:', err);
      jsonResponse(res, 500, { ok: false, error: 'Server error.' });
    }
    return;
  }

  // ── API: /api/subscribe ──
  if (urlPath === '/api/subscribe') {
    if (req.method === 'OPTIONS') { jsonResponse(res, 204, {}); return; }
    if (req.method !== 'POST') { jsonResponse(res, 405, { ok: false, error: 'Method not allowed' }); return; }
    try {
      const { email, source } = await readBody(req);
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { jsonResponse(res, 422, { ok: false, error: 'A valid email address is required.' }); return; }
      // Dedup check
      const filePath = path.join(DATA_DIR, 'subscribers.json');
      let subscribers = [];
      try { subscribers = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) {}
      if (subscribers.find(s => s.email === email)) {
        jsonResponse(res, 200, { ok: true, already: true });
        return;
      }
      const record = { id: Date.now().toString(), email, source: source || 'landing-cta', subscribedAt: new Date().toISOString() };
      appendSubmission('subscribers.json', record);
      console.log(`[subscribe] ${email} — source: ${source || 'landing-cta'}`);
      jsonResponse(res, 200, { ok: true });
    } catch (err) {
      console.error('[subscribe] error:', err);
      jsonResponse(res, 500, { ok: false, error: 'Server error.' });
    }
    return;
  }

  // ── Static files ──
  const filePath = path.join(PUBLIC_DIR, urlPath);

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      serveFile(path.join(filePath, 'index.html'), res);
      return;
    }
    if (!err && stat.isFile()) {
      serveFile(filePath, res);
      return;
    }
    serveFile(path.join(PUBLIC_DIR, 'index.html'), res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
