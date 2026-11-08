# Design notes

## Scope and assumptions

The implementation follows the Full Stack track in the assessment. A student selects an eligible printer, date and start time. The server calculates duration and price, then checks the selected printer's schedule before persisting the booking in the in-memory store.

## Scheduling model

A booking occupies a half-open interval `[start, end)`. The overlap predicate is `newStart < existingEnd && newEnd > existingStart`. This allows a booking to begin exactly when the previous booking ends. Only bookings on the same printer and date conflict. Cancelled records would not block a slot; cancellation itself is outside this assessment build.

## Printer eligibility

- P1 and P2: `BW` only.
- P3: `COLOUR` only.
- Colour + duplex is rejected.

The student explicitly chooses between P1 and P2 for black-and-white work. The system does not silently move a booking to another printer because that would change the student's requested slot and is not required by the paper.

## Calculation

`printMinutes = ceil(pages × copies / pagesPerMinute)`

`durationMinutes = printMinutes + 2 handling minutes`

`printCost = pages × copies × ratePerPage`

`bindingCost = copies × ₹30` when spiral binding is selected; otherwise zero.

The assessment does not specify a duplex discount or half-sheet interpretation, so duplex affects the job specification but not the explicit page-count duration and per-page pricing formulas.

## Data lifecycle

`BookingStore` is an in-memory repository. The server creates it once at startup and passes it to the HTTP handler. This is sufficient because the assessment explicitly permits skipping permanent storage. A database repository can replace this class without changing the domain calculation functions or HTTP contract.
