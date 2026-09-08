# Party Rental App — Project Status

> Last updated: 2026-09-07
> Stack: Next.js 14 · Firebase (Auth / Firestore / Storage / Functions) · Square · Tailwind CSS · nodemailer (Gmail SMTP)
> Deployed: Firebase App Hosting (`apphosting.yaml`)

---

## What This Is

A full-stack rental order management PWA for **La Poblanita 2** (party supply rental). Handles the entire job lifecycle: quote → digital contract signing → crew dispatch → setup photos → payment collection → customer gallery → video testimonial → receipts.

No third-party CRM. Everything lives in Firestore with a custom Next.js admin.

---

## User Roles

| Role | Entry Point | Auth |
|---|---|---|
| Owner / Staff | `/admin` | Firebase email + password |
| Customer | `/order/[id]` (signing), `/gallery/[id]`, `/testimonial/[id]` | None — order ID is the token |
| Crew | `/job/[id]`, `/setup/[id]` | None — order ID is the token |
| Content Creator | `/producer/[id]` | None — order ID is the token |

---

## Feature Status

### Core Order Flow
| Feature | Status | Notes |
|---|---|---|
| Create / edit order form | ✅ Live | Tables, chairs, jumpers, bathrooms, helium, tablecloths, seat covers, balloons, tents, heaters + custom "Other" items |
| Auto-calculated totals (subtotal, tax, deposit, balance) | ✅ Live | Tax rate from Settings; manual overrides allowed |
| Delivery fee + miles | ✅ Live | |
| Google Places address autocomplete | ✅ Live | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` required |
| Referral source tracking | ✅ Live | 29 sources + free-text "Other" |
| Order status lifecycle (9 states) | ✅ Live | draft → sent → signed → deposit_paid → delivered → picked_up → balance_paid → completed |
| Order dashboard with search + filter tabs | ✅ Live | Search by name/phone/email; tabs per status |
| Monthly calendar with inventory load | ✅ Live | Shows booked qty per item per day |
| Inventory management | ✅ Live | Owner sets qty owned per item variant; availability badges on order form |
| Print / PDF contract | ✅ Live | Records `printedAt`; "not yet printed" badge on dashboard |
| Archive / soft-delete | ✅ Live | Signed orders can only be archived; unsigned orders can be hard-deleted |

### Digital Signing
| Feature | Status | Notes |
|---|---|---|
| Bilingual signing email | ✅ Live | English + Spanish in one email |
| Scrollable waiver gate | ✅ Live | Agree checkbox disabled until scrolled to bottom |
| Driver's license photo capture | ✅ Live | Required/optional toggle in Settings; stored server-side via Admin SDK |
| Signature pad | ✅ Live | `react-signature-canvas`; base64 PNG saved to Firestore |
| Social media consent checkbox | ✅ Live | Hidden on public-property jobs |
| Waiver text snapshot at signing | ✅ Live | Full waiver + order state frozen on signature record; versioned |
| DL photo purge (auto) | ✅ Live | Cloud Function deletes DL photos 30 days after event date |
| DL retake email | ✅ Live | Owner can trigger a retake link from the order detail page |

### Payments
| Feature | Status | Notes |
|---|---|---|
| Zelle / Cash / Square payment methods | ✅ Live | |
| Square deposit payment link (auto-create) | ✅ Live | Requires `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` |
| Square balance link (auto-create, on delivery) | ✅ Live | Uses `amountOwed()` at time of crew page load |
| Square manual balance link | ✅ Live | Owner pastes link when auto is off |
| Square webhook → auto-mark paid | ✅ Live | HMAC-SHA256 verified; maps to deposit or balance |
| Square sandbox / production toggle | ✅ Live | `SQUARE_ENV=sandbox` or `production` |
| Receipt email | ✅ Live | HTML receipt via `buildReceiptHtml`; records `receiptSentAt` |

### Crew & Field Operations
| Feature | Status | Notes |
|---|---|---|
| Crew job ticket (`/job/[id]`) | ✅ Live | Delivery details, balance collection, pre-composed "paid" SMS to owner |
| Crew photo upload (`/setup/[id]`) | ✅ Live | PhotoCapture (downscaled to 1400px) + walkthrough video upload |
| Send crew job ticket (email + text QR + copy link) | ✅ Live | Multi-recipient email; staff picker for text |
| Send crew upload link | ✅ Live | Email + text QR |
| Video purge (auto) | ✅ Live | Cloud Function deletes video clips 20 days after upload |

### Marketing & Media
| Feature | Status | Notes |
|---|---|---|
| Owner photo/video curation (MediaGrid) | ✅ Live | `selected` and `producerSelected` toggles per photo/video |
| Customer gallery (`/gallery/[id]`) | ✅ Live | Signed URLs; Google review CTA; testimonial invite |
| Video testimonial recorder (`/testimonial/[id]`) | ✅ Live | Up to 3 minutes; release text agreement + snapshot |
| Content creator / producer page (`/producer/[id]`) | ✅ Live | Shows only producer-selected media; download links |
| Referral source analytics (`/admin/marketing`) | ✅ Live | Date-range filter; bar chart by count + revenue |

### Settings & Configuration
| Feature | Status | Notes |
|---|---|---|
| Business info (name, phone, address, website) | ✅ Live | Via `.env.local` env vars |
| Tax rate, DL toggle, Square auto-links toggle | ✅ Live | Firestore `settings/business` |
| Waiver text editor (Markdown + Preview) | ✅ Live | Versioned; snapshot on each signing |
| Staff list (name / email / phone) | ✅ Live | Used in crew email picker + text staff picker |
| Google review URL | ✅ Live | Shown on customer gallery page |
| Producer emails list | ✅ Live | Pre-fills content creator email form |
| Video release text + media consent text | ✅ Live | Markdown; shown to customer at signing + testimonial |
| Password change | ✅ Live | Firebase `updatePassword` |

### PWA
| Feature | Status | Notes |
|---|---|---|
| Service worker registration | ✅ Live | `InstallProvider` |
| Add to Home Screen prompt | ✅ Live | `InstallButton` in admin header |
| Standalone mode auto-redirect to `/admin` | ✅ Live | `StandaloneRedirect` |

---

## Known Gaps & Issues

| Area | Issue |
|---|---|
| No autosave on order form | Closing tab = lost work; no draft recovery |
| No duplicate order | No "Clone" button for repeat customers |
| No date search on dashboard | Can't find "all orders for next Saturday" by date |
| Dashboard tab counts missing | Tabs show status names but not how many orders are in each |
| No sort controls on dashboard | Default order is Firestore insertion order |
| No bulk actions | Can't archive multiple completed orders at once |
| Gallery URLs expire | Signed Storage URLs expire; bookmarked gallery links eventually break |
| No download-all on gallery | Customer must download photos one at a time |
| Crew job ticket has no setup notes callout | Special notes (e.g., stairs, surface type) not visually prominent |
| No upload progress on video | Slow/large uploads give no progress feedback |
| Signature pad has no minimum stroke check | A dot would pass as a signature |
| Settings page is unorganized | All settings on one long page with no sections |
| Email errors are silent to user in some paths | Firestore write succeeds but email failure only shows as inline text |
| No offline/fallback state | If Firestore is unreachable, pages go blank silently |
| Crew upload has no photo guidance | No instructions on which photos to take or minimum count |

---

## Environment Variables Required

```
# Business identity (public)
NEXT_PUBLIC_BUSINESS_NAME=
NEXT_PUBLIC_BUSINESS_PHONE=
NEXT_PUBLIC_BUSINESS_ADDRESS=
NEXT_PUBLIC_BUSINESS_WEBSITE=
NEXT_PUBLIC_ZELLE_NUMBER=
NEXT_PUBLIC_OWNER_CELL=
NEXT_PUBLIC_APP_URL=

# Firebase (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-only)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Email (server-only)
GMAIL_USER=
GMAIL_APP_PASSWORD=
MAIL_FROM_NAME=

# Square (server-only)
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=
SQUARE_ENV=sandbox          # or production
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_WEBHOOK_URL=

# Google Maps (public)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

---

## Architecture Notes

- **Auth model**: Firebase email/password for owner/staff. Public pages use the Firestore order ID as an implicit token (anyone with the link can access). DL photos are always served through a server API route that validates the Firebase auth token — they never have public signed URLs.
- **Storage rules**: DL photos require owner auth for direct access. All other storage paths also require auth. Customer/crew uploads always go through server API routes (Admin SDK), never direct client writes to Storage.
- **Square webhook**: Returns HTTP 200 even on internal errors to prevent Square retry storms. Errors are logged server-side only.
- **Video purge**: Cloud Functions handle deletion on a schedule. `purgeAfter` timestamps are set at upload time (DL: 30d after event, video clips: 20d after upload).
- **Waiver versioning**: Every save of the waiver text bumps `WaiverSettings.version`. Each signed order's `signature.waiverVersion` + `waiverTextSnapshot` captures exactly what the customer agreed to.

---

## Potential Next Steps

- [ ] Autosave / draft recovery on order form (localStorage or Firestore draft)
- [ ] Duplicate order ("Clone for repeat customer")
- [ ] Dashboard: date range search + status tab counts + sort controls
- [ ] Crew upload: photo count minimum + shot guide (front/back/left/right)
- [ ] Gallery: persistent signed URLs or a server proxy that refreshes tokens on load
- [ ] Crew job ticket: surface type + stairs + notes callout at the top
- [ ] Toast notification system (replace inline red text)
- [ ] Settings page: tabbed or sectioned layout
- [ ] Upload progress indicator for video uploads
