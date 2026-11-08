# Campus Xerox Shop — Printer Booking System

A clean, dependency-free Full Stack implementation of **Question 2: Paper Jam — The Campus Xerox Shop**. The project uses Node.js' built-in HTTP server for the API and a responsive browser frontend. It requires no database or external package installation, which keeps setup reliable during an assessment.

## Requirements

- Node.js 20 or newer
- npm (included with Node.js)

## Run locally

```bash
npm start
```

Open **http://localhost:3000**. For automatic server restarts during development:

```bash
npm run dev
```

## Run tests

```bash
npm test
npm run test:coverage
```

The automated suite covers business rules, calculations, validation, scheduling conflicts, sample data, and HTTP API integration. No third-party test framework is required; tests use `node:test` and `node:assert`.

## Assessment requirements covered

- Book a printer slot with roll number, student name, date, start time, pages, copies, print mode, sides, and binding.
- P1 and P2 accept black-and-white jobs only. P3 accepts colour jobs only.
- Colour printing is single-sided only.
- The server calculates price, duration, and estimated end time.
- A day board shows each printer's bookings and currently unbooked schedule.
- A booking cannot overlap another active booking on the same printer. Adjacent slots are allowed.
- Invalid input, closed days, out-of-hours jobs, and jobs that finish after closing are rejected with a readable reason.
- Students can look up bookings using their unique roll number (names are not used as identifiers).
- The booking form calls the real API for live price and end-time estimates; server-side validation and conflict errors are displayed in the UI.

## Business rules from the paper

| Rule | Implementation |
|---|---|
| P1 | Black & white, 30 pages/minute, reliable |
| P2 | Black & white, 20 pages/minute, jams often |
| P3 | Colour, 10 pages/minute, only colour printer |
| Black & white | ₹1 per page, single- or double-sided |
| Colour | ₹8 per page, single-sided only |
| Spiral binding | ₹30 per copy |
| Duration | `ceil(pages × copies ÷ printer speed) + 2 minutes` |
| Shop hours | 08:00–18:00, Monday–Saturday |

The page count is the document's page count; duplex does not halve the number of printed page impressions or the quoted price. This follows the assessment's stated duration formula (`pages × copies`) and per-page pricing.

## Sample data

The board is seeded with the nine entries from the Monday sign-up sheet in the paper, dated **Monday, 9 November 2026** (the next Monday relative to the assessment build date). The seed data is in-memory and resets when the server restarts. The jammed P2 Meera entry is marked `JAMMED` to make the incident visible; the system does not attempt to model printer repair or infer which pages physically printed.

## API

All endpoints are served from the same origin.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/config` | Printer, shop-hour and price configuration |
| GET | `/api/printers?date=YYYY-MM-DD` | Printers and bookings for a date |
| POST | `/api/bookings/preview` | Validate a proposed booking and return price/end-time estimate without saving |
| POST | `/api/bookings` | Validate and create a booking |
| GET | `/api/students/:rollNumber/bookings` | List bookings for a student |

### Create booking example

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "studentName":"Meera K",
    "rollNumber":"23CS045",
    "printerId":"P1",
    "date":"2026-11-10",
    "startTime":"09:00",
    "pages":62,
    "copies":1,
    "mode":"BW",
    "sides":"DUPLEX",
    "binding":"SPIRAL"
  }'
```

Expected estimate: 5 minutes, finish at 09:05, ₹92 total (₹62 printing + ₹30 spiral binding).

### Error response

```json
{
  "error": "P1 is already booked from 09:00 to 09:04. Choose another time or printer.",
  "code": "BOOKING_CONFLICT"
}
```

Conflict responses use HTTP `409`; invalid input uses HTTP `400`; unknown routes use HTTP `404`.

## Project structure

```text
campus-xerox-shop/
├── docs/
│   ├── API.md
│   └── DESIGN.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── domain.js
│   ├── server.js
│   └── store.js
├── tests/
│   ├── api.test.js
│   ├── domain.test.js
│   └── store.test.js
├── .gitignore
├── package.json
└── README.md
```

## Known scope boundaries

This is intentionally scoped to the paper's minimum Full Stack requirements. It uses in-memory storage, has no login/payment integration, and does not implement printer repair, page-level jam recovery, cancellation, or ready-notification delivery. The paper lists reminders and ready notifications as a stretch goal, not a core requirement. A production deployment would replace the in-memory store with a database and add authentication, durable jobs, and operational monitoring.

## Git history

The repository includes staged commits for project setup, scheduling/business rules, API and sample data, frontend, and automated verification. The `.git` directory is included in the delivered ZIP so the commit history is preserved.
