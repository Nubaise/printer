import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { BookingStore } from '../src/store.js';

let server;
let base;
before(async () => {
  server = createServer({ store: new BookingStore({ seed: false }) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
async function request(path, options) {
  const response = await fetch(`${base}${path}`, options);
  return { status: response.status, body: await response.json() };
}
const payload = (overrides = {}) => ({ studentName: 'Meera K', rollNumber: '23CS045', printerId: 'P1', date: '2026-11-10', startTime: '09:00', pages: 60, copies: 1, mode: 'BW', sides: 'SIMPLEX', binding: 'NONE', ...overrides });

test('GET /api/health returns service health', async () => {
  const result = await request('/api/health');
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
});
test('GET /api/config exposes printer and pricing rules', async () => {
  const result = await request('/api/config');
  assert.equal(result.status, 200);
  assert.equal(result.body.printers.length, 3);
  assert.equal(result.body.prices.colourPerPage, 8);
});
test('GET /api/printers requires a date and returns all printers', async () => {
  assert.equal((await request('/api/printers')).status, 400);
  const result = await request('/api/printers?date=2026-11-10');
  assert.equal(result.status, 200);
  assert.equal(result.body.printers.length, 3);
});
test('POST /api/bookings/preview returns estimate without creating booking', async () => {
  const result = await request('/api/bookings/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
  assert.equal(result.status, 200);
  assert.equal(result.body.preview.endTime, '09:04');
});
test('POST /api/bookings creates a booking and GET student history returns it', async () => {
  const created = await request('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
  assert.equal(created.status, 201);
  assert.equal(created.body.booking.totalPrice, 60);
  const history = await request('/api/students/23CS045/bookings');
  assert.equal(history.status, 200);
  assert.equal(history.body.bookings.length, 1);
});
test('POST /api/bookings returns HTTP 409 for a conflicting slot', async () => {
  const result = await request('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload({ startTime: '09:02' })) });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'BOOKING_CONFLICT');
});
test('API returns clear validation errors and 404 for unknown routes', async () => {
  const invalid = await request('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload({ copies: 0 })) });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /Copies must be/);
  assert.equal((await request('/api/no-such-route')).status, 404);
});
test('GET / serves the frontend application', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Campus Xerox/);
});
