import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINTERS, BookingError, calculateJob, intervalsOverlap, validateBookingInput } from '../src/domain.js';

const valid = {
  studentName: 'Meera K', rollNumber: '23CS045', printerId: 'P1', date: '2026-11-10',
  startTime: '09:00', pages: 62, copies: 1, mode: 'BW', sides: 'DUPLEX', binding: 'SPIRAL'
};

test('printer catalogue matches the paper', () => {
  assert.deepEqual(PRINTERS.map((p) => [p.id, p.speed, p.modes[0]]), [['P1',30,'BW'],['P2',20,'BW'],['P3',10,'COLOUR']]);
});
test('calculates duration, print cost and binding cost', () => {
  const result = calculateJob(valid, PRINTERS[0]);
  assert.equal(result.printMinutes, 3);
  assert.equal(result.durationMinutes, 5);
  assert.equal(result.printCost, 62);
  assert.equal(result.bindingCost, 30);
  assert.equal(result.totalPrice, 92);
});
test('copies affect duration and print price', () => {
  const result = calculateJob({ ...valid, pages: 12, copies: 5, binding: 'NONE' }, PRINTERS[0]);
  assert.equal(result.durationMinutes, 4);
  assert.equal(result.totalPrice, 60);
});
test('colour pricing is eight rupees per page and is single-sided', () => {
  const result = calculateJob({ ...valid, pages: 4, copies: 3, mode: 'COLOUR', sides: 'SIMPLEX', binding: 'NONE' }, PRINTERS[2]);
  assert.equal(result.totalPrice, 96);
  assert.throws(() => calculateJob({ ...valid, mode: 'COLOUR', sides: 'DUPLEX' }, PRINTERS[2]), /single-sided only/);
});
test('rejects a printer that cannot handle the requested mode', () => {
  assert.throws(() => calculateJob({ ...valid, mode: 'COLOUR', sides: 'SIMPLEX' }, PRINTERS[0]), /cannot handle colour/);
});
test('rejects zero, fractional and out-of-range page/copy values', () => {
  for (const pages of [0, -1, 1.5, 10001]) assert.throws(() => calculateJob({ ...valid, pages }, PRINTERS[0]), BookingError);
  for (const copies of [0, -2, 1.2, 101]) assert.throws(() => calculateJob({ ...valid, copies }, PRINTERS[0]), BookingError);
});
test('validates roll number, student name, date, time and binding', () => {
  for (const input of [
    { ...valid, rollNumber: 'Meera' }, { ...valid, studentName: ' ' },
    { ...valid, date: '2026-02-30' }, { ...valid, date: '2026-11-08' },
    { ...valid, startTime: '07:59' }, { ...valid, startTime: '18:00' },
    { ...valid, binding: 'GLUE' }
  ]) assert.throws(() => validateBookingInput(input), BookingError);
});
test('rejects jobs that finish after shop closing', () => {
  assert.throws(() => validateBookingInput({ ...valid, startTime: '17:58', pages: 1, copies: 1 }), /finish after closing/);
});
test('allows a job to finish exactly at closing', () => {
  const result = validateBookingInput({ ...valid, startTime: '17:57', pages: 1, copies: 1 });
  assert.equal(result.endTime, '18:00');
});
test('date validation is timezone-independent for India and other positive offsets', () => {
  const result = validateBookingInput({ ...valid, date: '2026-11-09' });
  assert.equal(result.date, '2026-11-09');
});
test('interval overlap allows adjacent bookings but rejects intersections', () => {
  assert.equal(intervalsOverlap(480, 490, 490, 500), false);
  assert.equal(intervalsOverlap(480, 491, 490, 500), true);
  assert.equal(intervalsOverlap(490, 500, 480, 491), true);
});
