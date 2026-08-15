# Deva Construction — Feature Roadmap

All 15 professional features identified from a full project audit.
Build for both **web (Next.js)** and **Android (Kotlin Compose)** in each pass.

---

## Completed

### 1. Data Backup & Restore (Owner-only)
- In-app manual backup download (ZIP of all 13 tables as JSON)
- `/admin/backup` page with row counts and download button
- GitHub Actions daily cron backup to `backups` orphan branch
- Google Drive upload via rclone
- Restore script (`scripts/restore.mjs`) for disaster recovery

### 2. Budget Alerts & Overspend Warning
- Amber warning at 80% budget utilization, red alert at 100%+
- `BudgetAlert` banner on project detail and costs pages
- Color-coded Spent/Remaining `CostBox` components
- "Over Budget" metric card on admin overview
- Android: `WarningBanner` on project detail and admin overview

### 3. Profit & Loss / Project Profitability View
- `/admin/profitloss` page with per-project P&L breakdown
- Revenue (from `client_payments`) vs Spending (materials + labour + wages)
- Summary stats: total budget, received, spent, net P/L
- Revenue vs Spending horizontal bar chart
- DataTable with Profit/Loss and Collected % columns
- Android: `AdminProfitLoss` composable in Reports tab

### 4. Global Search
- `/admin/search` page with server-side Supabase `ilike` queries
- Searches across 6 tables: projects, clients, suppliers, labourers, materials, payments
- Type badge, title, subtitle with links to detail pages
- Search icon added to sidebar navigation
- Android: client-side filtering composable (`AdminSearch`) across all entity lists

### 5. Dashboard Trends (Month-over-Month)
- Overview stat cards show ↑/↓ trend badges vs last month
- Tracks: new projects, spending, attendance month-over-month
- Color-coded arrows: green (up), red (down), grey (neutral)
- Android: `TrendData` in `AdminMetrics`, trend labels on `StatCard`

### 6. Invoice PDF Generation
- Professional invoice with Deva Construction letterhead (green header)
- Client details, project info, itemized materials table
- Labour payments, change orders sections
- GST calculation (18%), subtotal, grand total, amount paid/due
- Web: `DownloadInvoiceButton` on project detail page
- Android: `PdfExporter.exportInvoice()` with share intent

---

## Pending

### 7. Document Management per Project
- File upload/organize per project (contracts, blueprints, permits, bills)
- Supabase Storage bucket per project or folder structure
- Drag-and-drop upload on web, camera/gallery picker on Android
- File type icons, preview for images/PDFs
- Download and share functionality
- Optional: folder categorization (contracts, drawings, invoices, photos)

### 8. Activity / Audit Log
- Track who changed what and when across all tables
- New `activity_log` table: user_id, action, entity_type, entity_id, details, created_at
- Postgres triggers or application-level logging on INSERT/UPDATE/DELETE
- `/admin/activity` page with filterable timeline view
- Filter by: user, entity type, action type, date range
- Android: scrollable activity feed screen

### 9. Photo Gallery / Visual Timeline
- Organized gallery of project update photos
- Grid/masonry layout with lightbox preview
- Filter by project, date range, stage
- Timeline view showing project progression through photos
- Web: image grid with zoom modal
- Android: LazyVerticalGrid with full-screen image viewer
- Optional: before/after comparison view per stage

### 10. Role-based Dashboard Customization
- Different default views per role (admin vs manager vs client)
- Manager: sees only assigned projects, no team access
- Client: sees project progress, payment history, photo updates
- Configurable widget layout on overview page
- Pin/unpin metric cards

### 11. Offline Mode for Android
- Queue form submissions (create project, add material, mark attendance) when offline
- Local Room database for caching recently viewed data
- Sync queue: retry pending operations when connectivity returns
- Visual indicator: offline banner, pending sync count badge
- Conflict resolution: server wins, notify user of conflicts
- Priority tables: attendance (daily use), materials, payments

### 12. Multi-language Support (Kannada/Hindi)
- i18n framework for web (next-intl or similar)
- Android: strings.xml resource files for kn/hi locales
- Language picker in settings/sidebar
- Translate: navigation labels, form labels, status values, button text
- Keep data (project names, descriptions) in original language
- RTL not needed (Kannada and Hindi are LTR)

### 13. Client Portal Enhancements
- Client can view project timeline with milestones
- Payment history with receipts/invoices
- Request change orders from client side
- Photo gallery filtered to their project
- Push notifications for project updates (stage changes, payment requests)

### 14. Supplier Portal Enhancements
- Delivery schedule view
- Payment status tracking
- Material order confirmations
- Outstanding balance summary
- Upload delivery photos/receipts

### 15. Labour Attendance QR/Geofence Check-in
- QR code per project site for attendance marking
- Optional GPS geofence validation (within X meters of site)
- Self-service attendance for labourers via their phone
- Admin approval workflow for self-marked attendance
- Reduces manual data entry for daily attendance
- Android: QR scanner + location check composable
