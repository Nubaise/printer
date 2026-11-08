import test from 'node:test';
import assert from 'node:assert/strict';
import { BookingStore } from '../src/store.js';
import { BookingError } from '../src/domain.js';

const booking = (overrides = {}) => ({
  studentName: 'Test Student', rollNumber: '23CS045', printerId: 'P1', date: '2026-11-10',
  startTime: '09:00', pages: 60, copies: 1, mode: 'BW', sides: 'SIMPLEX', binding: 'NONE', ...overrides
});

test('starts empty when sample data is disabled', () => {
  assert.equal(new BookingStore({ seed: false }).bookings.length, 0);
});
test('loads the nine sample bookings from the assessment sign-up sheet', () => {
  const store = new BookingStore();
  assert.equal(store.bookings.length, 9);
  assert.equal(store.listPrinters('2026-11-09').map((p) => p.bookings.length).reduce((a,b) => a+b, 0), 9);
});
test('marks the 120-page Hari job as jammed, matching the incident in the paper', () => {
  const store = new BookingStore();
  const jammed = store.bookings.find((booking) => booking.rollNumber === '23CE033');
  assert.equal(jammed.pages, 120);
  assert.equal(jammed.status, 'JAMMED');
});
test('keeps Divya’s printed counter bundle marked unpaid as shown on the sheet', () => {
  const store = new BookingStore();
  const divya = store.bookings.find((booking) => booking.rollNumber === '23CS018');
  assert.equal(divya.status, 'READY');
  assert.equal(divya.paymentStatus, 'UNPAID');
});
test('creates a booking and calculates the expected result', () => {
  const store = new BookingStore({ seed: false });
  const result = store.create(booking());
  assert.equal(result.printerId, 'P1');
  assert.equal(result.endTime, '09:04');
  assert.equal(result.totalPrice, 60);
  assert.equal(result.status, 'BOOKED');
});
test('rejects overlapping bookings on the same printer', () => {
  const store = new BookingStore({ seed: false });
  store.create(booking());
  assert.throws(() => store.create(booking({ startTime: '09:03' })), (error) => error instanceof BookingError && error.statusCode === 409 && error.code === 'BOOKING_CONFLICT');
});
test('allows adjacent bookings on the same printer', () => {
  const store = new BookingStore({ seed: false });
  store.create(booking());
  const second = store.create(booking({ startTime: '09:04', pages: 1 }));
  assert.equal(second.startTime, '09:04');
});
test('allows overlapping times on different printers', () => {
  const store = new BookingStore({ seed: false });
  store.create(booking());
  assert.equal(store.create(booking({ printerId: 'P2' })).printerId, 'P2');
});
test('returns a student booking history by roll number, not name', () => {
  const store = new BookingStore();
  const rows = store.listStudentBookings('23me020');
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.rollNumber === '23ME020'));
});
test('rejects colour jobs on P1/P2 and black-and-white jobs on P3', () => {
  const store = new BookingStore({ seed: false });
  assert.throws(() => store.create(booking({ mode: 'COLOUR', sides: 'SIMPLEX' })), /cannot handle colour/);
  assert.throws(() => store.create(booking({ printerId: 'P3' })), /cannot handle black & white/);
});
test('preview calculates but does not persist a booking', () => {
  const store = new BookingStore({ seed: false });
  const preview = store.preview(booking());
  assert.equal(preview.endTime, '09:04');
  assert.equal(store.bookings.length, 0);
});
test('sample schedule has no accidental overlaps', () => {
  const store = new BookingStore();
  for (const printer of store.listPrinters('2026-11-09')) {
    for (let i = 1; i < printer.bookings.length; i++) {
      const previous = printer.bookings[i - 1];
      assert.ok(previous.endTime <= printer.bookings[i].startTime, `${printer.id} has overlapping sample rows`);
    }
  }
});
