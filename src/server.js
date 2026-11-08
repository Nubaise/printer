import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookingError, PRINTERS, SHOP } from './domain.js';
import { BookingStore } from './store.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new BookingError('Request body is too large.', 413, 'PAYLOAD_TOO_LARGE');
  }
  try { return JSON.parse(raw || '{}'); }
  catch { throw new BookingError('Request body must be valid JSON.'); }
}
function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function validDateQuery(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BookingError('Provide a date query parameter in YYYY-MM-DD format.');
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new BookingError('Provide a real calendar date.');
  return date;
}

export function createServer({ store = new BookingStore() } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, service: 'campus-xerox-shop' });
      }
      if (req.method === 'GET' && url.pathname === '/api/config') {
        return sendJson(res, 200, { printers: PRINTERS, shop: SHOP, prices: { blackAndWhitePerPage: 1, colourPerPage: 8, spiralPerCopy: 30 } });
      }
      if (req.method === 'GET' && url.pathname === '/api/printers') {
        const date = validDateQuery(url.searchParams.get('date'));
        return sendJson(res, 200, { date, printers: store.listPrinters(date) });
      }
      if (req.method === 'POST' && url.pathname === '/api/bookings/preview') {
        const body = await readJson(req);
        return sendJson(res, 200, { preview: store.preview(body) });
      }
      if (req.method === 'POST' && url.pathname === '/api/bookings') {
        const body = await readJson(req);
        const booking = store.create(body);
        return sendJson(res, 201, { booking });
      }
      const studentMatch = url.pathname.match(/^\/api\/students\/([^/]+)\/bookings$/);
      if (req.method === 'GET' && studentMatch) {
        const rollNumber = decodeURIComponent(studentMatch[1]);
        return sendJson(res, 200, { rollNumber: rollNumber.toUpperCase(), bookings: store.listStudentBookings(rollNumber) });
      }
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname.startsWith('/assets/'))) {
        const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice('/assets/'.length);
        const safePath = normalize(requested).replace(/^([.][.][/\\])+/, '');
        const filePath = join(PUBLIC, safePath);
        if (!filePath.startsWith(PUBLIC)) return sendJson(res, 403, { error: 'Forbidden', code: 'FORBIDDEN' });
        try {
          const data = await readFile(filePath);
          res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
          return res.end(data);
        } catch { return sendJson(res, 404, { error: 'File not found', code: 'NOT_FOUND' }); }
      }
      return sendJson(res, 404, { error: 'Route not found', code: 'NOT_FOUND' });
    } catch (error) {
      if (error instanceof BookingError) return sendJson(res, error.statusCode, { error: error.message, code: error.code });
      console.error(error);
      return sendJson(res, 500, { error: 'An unexpected server error occurred.', code: 'INTERNAL_ERROR' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.listen(port, () => console.log(`Campus Xerox Shop running at http://localhost:${port}`));
}
