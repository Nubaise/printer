import { randomUUID } from 'node:crypto';
import { PRINTERS, validateBookingInput, intervalsOverlap, BookingError } from './domain.js';

const sampleDate = '2026-11-09';
const sampleRows = [
  ['P1', '23CS018', 'Divya', '08:00', 25, 1, 'BW', 'SIMPLEX', 'NONE', 'READY', 'UNPAID'],
  ['P1', '23CS077', 'Rohit', '08:03', 300, 1, 'BW', 'SIMPLEX', 'NONE', 'QUEUED', 'UNPAID'],
  ['P1', '23CS045', 'Meera K', '08:15', 62, 1, 'BW', 'DUPLEX', 'SPIRAL', 'QUEUED', 'UNPAID'],
  ['P1', '23ME020', 'Arjun', '08:20', 12, 5, 'BW', 'SIMPLEX', 'NONE', 'QUEUED', 'UNPAID'],
  ['P2', '23EC112', 'Meera K', '08:00', 30, 1, 'BW', 'SIMPLEX', 'SPIRAL', 'QUEUED', 'UNPAID'],
  ['P2', '23CE033', 'Hari', '08:10', 120, 1, 'BW', 'SIMPLEX', 'NONE', 'JAMMED', 'UNPAID'],
  ['P2', '23ME020', 'Arjun', '08:21', 14, 5, 'BW', 'SIMPLEX', 'NONE', 'QUEUED', 'UNPAID'],
  ['P3', '23CS101', 'Fathima', '08:00', 4, 1, 'COLOUR', 'SIMPLEX', 'NONE', 'QUEUED', 'UNPAID'],
  ['P3', '22EE009', 'Nikhil', '08:03', 2, 3, 'COLOUR', 'SIMPLEX', 'NONE', 'QUEUED', 'UNPAID']
];

function makeSampleBookings() {
  return sampleRows.map((row) => {
    const [printerId, rollNumber, studentName, startTime, pages, copies, mode, sides, binding, status, paymentStatus] = row;
    const printer = PRINTERS.find((p) => p.id === printerId);
    const start = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
    const durationMinutes = Math.ceil((pages * copies) / printer.speed) + 2;
    const end = start + durationMinutes;
    const printCost = pages * copies * (mode === 'BW' ? 1 : 8);
    const bindingCost = binding === 'SPIRAL' ? copies * 30 : 0;
    return {
      id: randomUUID(), printerId, rollNumber, studentName, date: sampleDate, startTime,
      endTime: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
      startMinutes: start, endMinutes: end, pages, copies, mode, sides, binding,
      durationMinutes, printMinutes: durationMinutes - 2, handlingMinutes: 2,
      printCost, bindingCost, totalPrice: printCost + bindingCost, status, paymentStatus, createdAt: new Date().toISOString()
    };
  });
}

export class BookingStore {
  constructor({ seed = true } = {}) {
    this.bookings = seed ? makeSampleBookings() : [];
  }

  listPrinters(date) {
    return PRINTERS.map((printer) => ({
      ...printer,
      bookings: this.bookings
        .filter((booking) => booking.date === date && booking.printerId === printer.id && booking.status !== 'CANCELLED')
        .sort((a, b) => a.startMinutes - b.startMinutes)
        .map(({ startMinutes, endMinutes, ...booking }) => booking)
    }));
  }

  listStudentBookings(rollNumber) {
    const normalized = String(rollNumber || '').trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{2,4}[0-9]{3}$/.test(normalized)) throw new BookingError('Enter a valid roll number, for example 23CS045.');
    return this.bookings.filter((booking) => booking.rollNumber === normalized).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  }

  preview(input) {
    const validated = validateBookingInput(input);
    return this.#checkConflict(validated, null);
  }

  create(input) {
    const validated = validateBookingInput(input);
    this.#checkConflict(validated, null);
    const booking = {
      id: randomUUID(), printerId: validated.printer.id, rollNumber: validated.rollNumber,
      studentName: validated.studentName, date: validated.date, startTime: validated.startTime,
      endTime: validated.endTime, pages: validated.pages, copies: validated.copies,
      mode: validated.mode, sides: validated.sides, binding: validated.binding,
      durationMinutes: validated.durationMinutes, printMinutes: validated.printMinutes,
      handlingMinutes: validated.handlingMinutes, printCost: validated.printCost,
      bindingCost: validated.bindingCost, totalPrice: validated.totalPrice,
      status: 'BOOKED', paymentStatus: 'UNPAID', createdAt: new Date().toISOString()
    };
    this.bookings.push(booking);
    return booking;
  }

  #checkConflict(validated, excludeId) {
    const conflict = this.bookings.find((booking) =>
      booking.id !== excludeId && booking.date === validated.date &&
      booking.printerId === validated.printer.id && booking.status !== 'CANCELLED' &&
      intervalsOverlap(validated.startMinutes, validated.endMinutes, booking.startMinutes ?? this.#toMinutes(booking.startTime), booking.endMinutes ?? this.#toMinutes(booking.endTime))
    );
    if (conflict) throw new BookingError(`${validated.printer.id} is already booked from ${conflict.startTime} to ${conflict.endTime}. Choose another time or printer.`, 409, 'BOOKING_CONFLICT');
    return { printerId: validated.printer.id, startTime: validated.startTime, endTime: validated.endTime, durationMinutes: validated.durationMinutes, totalPrice: validated.totalPrice, printCost: validated.printCost, bindingCost: validated.bindingCost };
  }

  #toMinutes(time) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
}
