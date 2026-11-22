# FAISAL HOMES — Project Status

Last updated: 21 November 2026 · Version 1.0.0

## Test evidence
- **Backend integration tests:** 31/31 passing (`npm test` in `server/`). They run against a real PostgreSQL 16 database and HTTP server,
  covering setup/login/lockout/CSRF, role permissions, land area conversion, bulk plots, duplicate plot/CNIC, CNIC masking, booking with
  30% + 36 monthly + 6 half-yearly, **sequential and concurrent double-booking prevention**, partial payments (oldest due first), over-payment,
  future dates, cheque reference rule, **payment reversal**, SOLD ↔ BOOKED status, **schedule editing**, overdue detection, late fees
  (never automatic), charge payments, **transfer dues check + override**, transfer with fee, ledger balances, **cancellation with refund**
  and forfeiture, re-selling the plot, expenses + cancellation, financial-summary identities, every report as JSON/Excel/PDF, receipt reprint
  (duplicate), documents upload/permissions/soft delete, session expiry, and **backup + restore** (data and sessions).
- **Browser test:** 53/53 checks passing in headless Chrome (`tests/e2e/smoke.js`). It opens every page and every report, then runs
  registration, the booking wizard, payment, partial payment and reversal, over-payment refusal, schedule editor, expense, bulk plots, transfer dues
  check, reservation, backup, the mobile layout and viewer permissions. No console, page or server errors.
- **PDFs checked visually:** receipt (customer + office copy), booking confirmation with schedule, transfer letter, report PDFs.

## Completed modules
| # | Module | Status |
|---|---|---|
| 1 | Design/UI: dashboard with 13 statistics, sidebar, responsive (desktop/tablet/mobile), PKR formatting (million or lakh style) | Done |
| 2 | Land management: Kanal/Marla/sq ft, editable Marla conversion (global + per land/society), seller, ownership, registry/mutation, expected saleable area, investment | Done |
| 3 | Societies, blocks, streets, plots (single + bulk, decimal Marla, corner/main road/park, category, price, discount), 6 statuses, inventory filters, interactive plot map | Done |
| 4 | Customers: auto ID, CNIC validation/uniqueness, nominee, guarantor, photo + CNIC uploads, full profile with plots/schedule/payments/transfers/documents, search by name/CNIC/mobile/ID | Done |
| 5 | Booking & sales wizard with live schedule preview, booking receipt, booking confirmation PDF, double-booking protection | Done |
| 6 | Installments: monthly/quarterly/half-yearly/yearly/custom/full + balloon payments, rounding, admin schedule editor with history, partial payments, overdue & upcoming lists, WhatsApp reminder links, manual late fees | Done |
| 7 | Payments & receipts: unique numbers, 2-copy A4 receipt PDF, reprint marked DUPLICATE, history search, reversal with reason (never deleted), ledger | Done |
| 8 | Transfers: admin-only, dues verification with override reason, fee (paid now or later), witnesses, transfer letter PDF, ownership history | Done |
| 9 | Expenses: 12 categories with cost types, attachments, land/society links, edit (non-financial fields), cancellation with reversal, daily/monthly/yearly report | Done |
| 10 | Accounting & reports: financial summary (installment-method profit), collections, daily/monthly cash, overdue, upcoming, sales, receivables, expense summary/list, inventory, customer ledger, plot ledger. All export to Excel and PDF | Done |
| 11 | Documents linked to customer/plot/land/booking/transfer/expense, protected download, soft delete | Done |
| 12 | Roles (Admin/Accountant/Sales/Viewer), bcrypt, server sessions with idle timeout, login lockout, CSRF header, security headers, audit log with before/after data, CNIC masking | Done |
| 13 | Backups: automatic daily + catch-up at startup, manual, download, restore (stored or uploaded), safety backup before restore, off-site copy folder, full Excel export | Done |
| 14 | Deployment: Windows batch setup/start, LAN access, auto-start, Docker + Caddy for VPS, cost breakdown | Done (Docker files not executed in build environment) |

## Database changes
- `001_init.sql`: all tables, constraints and indexes (incl. one-active-booking-per-plot unique index)
- `002_reference_data.sql`: counters, expense categories, default settings
- `003_views.sql`: `v_booking_finance`, `v_charge_finance` (live balances)
- `004_land_saleable_area.sql`: `lands.saleable_marla` for cost-per-Marla while partly plotted

## Known limitations / next phase
1. **Import from your current software / Excel**: there is no bulk import yet. Existing customers, plots and past payments must be entered
   (bookings and payments can be back-dated). An Excel import tool is the recommended next step.
2. **Urdu**: translation layer and right-to-left switching are built in, but only some labels are translated.
   Printed PDFs are English-only (Urdu PDF needs a Nastaliq font with text shaping).
3. **Plot map** is an automatic block/street grid coloured by status. It is not a drawn copy of your surveyed site plan.
   Drawing the real layout (from your existing SVG/HTML plans) would be a future enhancement.
4. **Reminders**: WhatsApp reminder buttons open a pre-written message. There are no automatic SMS/WhatsApp sends (those need a paid gateway).
5. Payments are always applied to the oldest unpaid installment. Choosing a specific installment is done by editing the schedule.
6. Changing a booking's price after booking is not a direct action. Use the schedule editor (total must equal price), or cancel and re-book.
7. Two-factor login is not implemented.

## Next steps (suggested order)
1. Install on the office PC with your real company details and logo, and test with demo data for a few days.
2. Build the Excel import for existing customers, bookings and payment history.
3. Complete the Urdu translation.
4. Optional: drawn site-plan map, SMS gateway, multi-branch.
