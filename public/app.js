const $ = (selector) => document.querySelector(selector);
const form = $('#booking-form');
const boardDate = $('#board-date');
const bookingDate = $('#booking-date');
const modeSelect = $('#mode-select');
const printerSelect = $('#printer-select');
const formMessage = $('#form-message');
let previewTimer;
let previewSequence = 0;
const today = new Date();
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const firstOpenDay = new Date(today);
if (firstOpenDay.getDay() === 0) firstOpenDay.setDate(firstOpenDay.getDate() + 1);
const defaultDate = localDate(firstOpenDay);
boardDate.value = defaultDate;
bookingDate.value = defaultDate;

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Something went wrong.');
  return payload;
}
function money(amount) { return `₹${Number(amount).toFixed(2)}`; }
function time12(time) {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${String(hour % 12 || 12).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${suffix}`;
}
function getValues() {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}
function estimateLocally() {
  const data = getValues();
  const colour = data.mode === 'COLOUR';
  printerSelect.querySelector('option[value="P1"]').disabled = colour;
  printerSelect.querySelector('option[value="P2"]').disabled = colour;
  printerSelect.querySelector('option[value="P3"]').disabled = !colour;
  if (colour && data.printerId !== 'P3') printerSelect.value = 'P3';
  if (!colour && data.printerId === 'P3') printerSelect.value = 'P1';
  data.printerId = printerSelect.value;
  const speeds = { P1: 30, P2: 20, P3: 10 };
  const speed = speeds[data.printerId];
  const pages = Math.max(0, Number(data.pages) || 0);
  const copies = Math.max(0, Number(data.copies) || 0);
  const printMinutes = Math.ceil((pages * copies) / speed);
  const duration = printMinutes + 2;
  const start = data.startTime || '09:00';
  const [h,m] = start.split(':').map(Number);
  const end = h * 60 + m + duration;
  const printCost = pages * copies * (data.mode === 'COLOUR' ? 8 : 1);
  const bindingCost = data.binding === 'SPIRAL' ? copies * 30 : 0;
  $('#estimate-printer').textContent = `${data.printerId} · ${data.mode === 'COLOUR' ? 'Colour' : 'Black & white'}`;
  $('#estimate-speed').textContent = `${speed} pages per minute`;
  $('#estimate-job').textContent = `${pages} pages × ${copies} ${copies === 1 ? 'copy' : 'copies'}`;
  $('#estimate-duration').textContent = `${duration} minutes`;
  $('#estimate-end').textContent = end < 1440 ? time12(`${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`) : 'After closing';
  $('#estimate-print-cost').textContent = money(printCost);
  $('#estimate-binding').textContent = money(bindingCost);
  $('#estimate-total').textContent = money(printCost + bindingCost);
  const duplex = form.querySelector('input[name="sides"][value="DUPLEX"]');
  duplex.disabled = colour;
  if (colour) form.querySelector('input[name="sides"][value="SIMPLEX"]').checked = true;
}

function applyServerPreview(preview) {
  $('#estimate-printer').textContent = `${preview.printerId} · ${getValues().mode === 'COLOUR' ? 'Colour' : 'Black & white'}`;
  $('#estimate-duration').textContent = `${preview.durationMinutes} minutes`;
  $('#estimate-end').textContent = time12(preview.endTime);
  $('#estimate-print-cost').textContent = money(preview.printCost);
  $('#estimate-binding').textContent = money(preview.bindingCost);
  $('#estimate-total').textContent = money(preview.totalPrice);
  $('#estimate-server-status').textContent = 'Server estimate updated · booking not yet confirmed.';
  $('#estimate-server-status').classList.remove('estimate-error');
}

function scheduleServerPreview() {
  clearTimeout(previewTimer);
  const sequence = ++previewSequence;
  const data = getValues();
  if (!data.studentName?.trim() || !data.rollNumber?.trim() || !data.date || !data.startTime || !data.pages || !data.copies) {
    $('#estimate-server-status').textContent = 'Complete the booking details for a server estimate.';
    $('#estimate-server-status').classList.remove('estimate-error');
    return;
  }
  $('#estimate-server-status').textContent = 'Checking estimate with the server…';
  previewTimer = setTimeout(async () => {
    try {
      const { preview } = await api('/api/bookings/preview', { method: 'POST', body: JSON.stringify(data) });
      if (sequence !== previewSequence) return;
      applyServerPreview(preview);
    } catch (error) {
      if (sequence !== previewSequence) return;
      $('#estimate-server-status').textContent = `Server estimate unavailable: ${error.message}`;
      $('#estimate-server-status').classList.add('estimate-error');
    }
  }, 250);
}

function showMessage(message, type) {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
  formMessage.hidden = false;
}
function hideMessage() { formMessage.hidden = true; }

async function loadBoard(date) {
  const board = $('#printer-board');
  board.innerHTML = '<div class="loading-card">Loading printer schedule…</div>';
  try {
    const { printers } = await api(`/api/printers?date=${encodeURIComponent(date)}`);
    board.innerHTML = printers.map((printer) => {
      const active = printer.bookings;
      const isBusy = active.length > 0;
      const jammed = active.some((booking) => booking.status === 'JAMMED');
      const status = jammed ? 'Jam in sample data' : isBusy ? `${active.length} booking${active.length === 1 ? '' : 's'}` : 'No bookings';
      let cursor = 8 * 60;
      const schedule = [];
      for (const booking of active) {
        const [sh, sm] = booking.startTime.split(':').map(Number);
        const [eh, em] = booking.endTime.split(':').map(Number);
        const start = sh * 60 + sm; const end = eh * 60 + em;
        if (start > cursor) schedule.push(`<div class="booking-row free-row"><span>Available</span><strong>${minutesLabel(cursor)}–${minutesLabel(start)}</strong></div>`);
        schedule.push(`<div class="booking-row"><span>${escapeHtml(booking.studentName)} · ${booking.pages}p × ${booking.copies}</span><strong>${booking.startTime}–${booking.endTime}</strong></div>`);
        cursor = Math.max(cursor, end);
      }
      if (cursor < 18 * 60) schedule.push(`<div class="booking-row free-row"><span>Available</span><strong>${minutesLabel(cursor)}–18:00</strong></div>`);
      return `<article class="printer-card"><div class="printer-card-head"><span class="printer-id">${printer.id}</span><span class="printer-status ${isBusy ? 'busy' : ''}">${status}</span></div><h3 class="printer-title">${printer.name}</h3><p class="printer-desc">${printer.description}</p><div class="booking-list">${schedule.length ? schedule.map((item) => item).join('') : '<span class="empty-slot">No availability remaining</span>'}</div></article>`;
    }).join('');
  } catch (error) { board.innerHTML = `<div class="loading-card">${escapeHtml(error.message)}</div>`; }
}
function minutesLabel(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }

form.addEventListener('input', () => { estimateLocally(); scheduleServerPreview(); });
form.addEventListener('change', () => { estimateLocally(); scheduleServerPreview(); });
boardDate.addEventListener('change', () => loadBoard(boardDate.value));
bookingDate.addEventListener('change', () => { boardDate.value = bookingDate.value; loadBoard(bookingDate.value); });
form.addEventListener('submit', async (event) => {
  event.preventDefault(); hideMessage();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; button.querySelector('span').textContent = 'Checking slot…';
  try {
    const booking = await api('/api/bookings', { method: 'POST', body: JSON.stringify(getValues()) });
    const b = booking.booking;
    $('#estimate-printer').textContent = `${b.printerId} · ${b.mode === 'COLOUR' ? 'Colour' : 'Black & white'}`;
    $('#estimate-job').textContent = `${b.pages} pages × ${b.copies} ${b.copies === 1 ? 'copy' : 'copies'}`;
    $('#estimate-duration').textContent = `${b.durationMinutes} minutes`;
    $('#estimate-end').textContent = time12(b.endTime);
    $('#estimate-print-cost').textContent = money(b.printCost);
    $('#estimate-binding').textContent = money(b.bindingCost);
    $('#estimate-total').textContent = money(b.totalPrice);
    $('#estimate-server-status').textContent = 'Booking confirmed by the server.';
    $('#estimate-server-status').classList.remove('estimate-error');
    showMessage(`Booking confirmed! ${b.printerId} is reserved from ${b.startTime} to ${b.endTime}. Server-confirmed total: ${money(b.totalPrice)}. Booking ID: ${b.id.slice(0,8)}.`, 'success');
    boardDate.value = b.date; bookingDate.value = b.date; await loadBoard(b.date);
    $('#history-roll').value = b.rollNumber;
    await loadHistory(b.rollNumber);
  } catch (error) { showMessage(error.message, 'error'); }
  finally { button.disabled = false; button.querySelector('span').textContent = 'Confirm booking'; }
});

async function loadHistory(roll) {
  const target = $('#history-results'); target.innerHTML = '<p class="history-empty">Looking up bookings…</p>';
  try {
    const { bookings } = await api(`/api/students/${encodeURIComponent(roll)}/bookings`);
    if (!bookings.length) { target.innerHTML = '<p class="history-empty">No bookings found for this roll number.</p>'; return; }
    target.innerHTML = bookings.map((b) => `<article class="history-item"><div><strong>${b.printerId} · ${b.date} · ${b.startTime}–${b.endTime}</strong><small>${b.mode === 'BW' ? 'Black & white' : 'Colour'} · ${b.pages} pages × ${b.copies} · ${b.binding === 'SPIRAL' ? 'Spiral binding' : 'No binding'} · ${b.status}</small></div><span class="history-price">${money(b.totalPrice)}</span></article>`).join('');
  } catch (error) { target.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`; }
}
$('#history-form').addEventListener('submit', (event) => { event.preventDefault(); loadHistory($('#history-roll').value.trim()); });

estimateLocally();
scheduleServerPreview();
loadBoard(defaultDate);
