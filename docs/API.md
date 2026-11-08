# API reference

## `GET /api/printers?date=YYYY-MM-DD`
Returns the three printer definitions and their bookings for the requested date.

## `POST /api/bookings/preview`
Accepts the same JSON fields as create booking. Validates the request and returns `printerId`, `startTime`, `endTime`, `durationMinutes`, `totalPrice`, `printCost`, and `bindingCost`. Does not persist a booking.

## `POST /api/bookings`
Accepts:

```json
{
  "studentName": "Meera K",
  "rollNumber": "23CS045",
  "printerId": "P1",
  "date": "2026-11-10",
  "startTime": "09:00",
  "pages": 62,
  "copies": 1,
  "mode": "BW",
  "sides": "DUPLEX",
  "binding": "SPIRAL"
}
```

Returns `201` and the created booking. Returns `409 BOOKING_CONFLICT` when the selected printer has an overlapping booking.

## `GET /api/students/:rollNumber/bookings`
Returns all bookings for the normalized roll number. Roll number is the identifier because student names are not unique.
