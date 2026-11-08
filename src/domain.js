export const PRINTERS = Object.freeze([
  { id: 'P1', name: 'Printer 1', modes: ['BW'], speed: 30, reliable: true, description: 'Black & white · 30 pages/min · Reliable' },
  { id: 'P2', name: 'Printer 2', modes: ['BW'], speed: 20, reliable: false, description: 'Black & white · 20 pages/min · Jams often' },
  { id: 'P3', name: 'Printer 3', modes: ['COLOUR'], speed: 10, reliable: true, description: 'Colour · 10 pages/min · Only colour printer' }
]);

export const SHOP = Object.freeze({ opens: '08:00', closes: '18:00', openDays: [1, 2, 3, 4, 5, 6] });
export const PRICES = Object.freeze({ BW: 1, COLOUR: 8, spiralPerCopy: 30 });

export class BookingError extends Error {
  constructor(message, statusCode = 400, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'BookingError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const timeToMinutes = (time) => {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new BookingError('Start time must be in HH:MM format.');
  }
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
const minutesToTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function calculateJob(input, printer) {
  const pages = Number(input.pages);
  const copies = Number(input.copies);
  if (!Number.isInteger(pages) || pages < 1 || pages > 10000) throw new BookingError('Pages must be a whole number between 1 and 10,000.');
  if (!Number.isInteger(copies) || copies < 1 || copies > 100) throw new BookingError('Copies must be a whole number between 1 and 100.');
  if (!['BW', 'COLOUR'].includes(input.mode)) throw new BookingError('Choose either black & white or colour printing.');
  if (!['SIMPLEX', 'DUPLEX'].includes(input.sides)) throw new BookingError('Choose single-sided or double-sided printing.');
  if (input.mode === 'COLOUR' && input.sides === 'DUPLEX') throw new BookingError('Colour printing is single-sided only.');
  if (!['NONE', 'SPIRAL'].includes(input.binding)) throw new BookingError('Choose valid binding: none or spiral.');
  if (!printer.modes.includes(input.mode)) throw new BookingError(`${printer.id} cannot handle ${input.mode === 'COLOUR' ? 'colour' : 'black & white'} jobs.`);

  const printMinutes = Math.ceil((pages * copies) / printer.speed);
  const handlingMinutes = 2;
  const durationMinutes = printMinutes + handlingMinutes;
  const printCost = pages * copies * PRICES[input.mode];
  const bindingCost = input.binding === 'SPIRAL' ? copies * PRICES.spiralPerCopy : 0;
  return { printMinutes, handlingMinutes, durationMinutes, printCost, bindingCost, totalPrice: printCost + bindingCost };
}

export function validateBookingInput(input) {
  if (!input || typeof input !== 'object') throw new BookingError('Booking details are required.');
  const rollNumber = typeof input.rollNumber === 'string' ? input.rollNumber.trim().toUpperCase() : '';
  if (!/^[0-9]{2}[A-Z]{2,4}[0-9]{3}$/.test(rollNumber)) {
    throw new BookingError('Enter a valid roll number, for example 23CS045.');
  }
  const studentName = typeof input.studentName === 'string' ? input.studentName.trim() : '';
  if (studentName.length < 2 || studentName.length > 80) throw new BookingError('Student name must contain 2–80 characters.');
  const printerId = typeof input.printerId === 'string' ? input.printerId.toUpperCase() : '';
  const printer = PRINTERS.find((item) => item.id === printerId);
  if (!printer) throw new BookingError('Choose a valid printer (P1, P2 or P3).');
  if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new BookingError('Choose a valid booking date.');
  const [year, month, day] = input.date.split('-').map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) throw new BookingError('Choose a real calendar date.');
  if (!SHOP.openDays.includes(parsedDate.getUTCDay())) throw new BookingError('The shop is closed on Sundays. Choose Monday to Saturday.');
  const startMinutes = timeToMinutes(input.startTime);
  const opening = timeToMinutes(SHOP.opens);
  const closing = timeToMinutes(SHOP.closes);
  if (startMinutes < opening || startMinutes >= closing) throw new BookingError('Bookings must start between 08:00 AM and 06:00 PM.');

  const job = calculateJob(input, printer);
  const endMinutes = startMinutes + job.durationMinutes;
  if (endMinutes > closing) throw new BookingError('This job would finish after closing time (06:00 PM). Choose an earlier start time.');
  return {
    rollNumber, studentName, printer, date: input.date, startTime: input.startTime,
    endTime: minutesToTime(endMinutes), startMinutes, endMinutes,
    pages: Number(input.pages), copies: Number(input.copies), mode: input.mode,
    sides: input.sides, binding: input.binding, ...job
  };
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}
