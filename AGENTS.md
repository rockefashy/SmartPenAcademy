# Project Instructions & Directives

## Feature Status
- **No Flows Frozen**: All flows, including enrollment and booking flows, are subject to iterative enhancement and modification as directed by the user.

## Core Development Guidelines
- **No Fallbacks**: In development mode, do not inject fallback values, silent catches, or default data mocks when fields or constraints fail. Capture errors at the source so issues surface immediately.
- **No Hardcoded Data**: Keep properties externalized in property files or fetched dynamically from the database.
- **Demo Booking Requirements**: Demo bookings strictly use `preferredDate` (YYYY-MM-DD) and `preferredTimeSlot` (e.g., "04:00 PM").
