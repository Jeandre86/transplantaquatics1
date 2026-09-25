# TRANSPLANT AQUATICS — UI Design Prompt
> Copy this entire prompt into any design AI (Figma AI / Make, Galileo AI, Framer AI, V0, Uizard, Lovable, or similar) to generate an updated frontend UI.

---

## PRODUCT OVERVIEW

**Transplant Aquatics** is a global digital platform for transplant swimming — the competitive swimming discipline for organ transplant recipients. It is the world's only dedicated platform for athletes, rankings, results, records and editorial content in this sport.

**Tagline:** EVERY SECOND COUNTS.  
**Secondary slogan:** LIMITS ARE FICTION.  
**Voice:** Confident, technical, exact. Never casual. Speak the language of absolute high performance and chronological precision. "Captured to 0.001s resolution." — not "A great companion for your morning swim."

---

## BRAND IDENTITY

### Colour Palette
| Token | Hex | Usage |
|---|---|---|
| **Dark Navy** | `#010410` | Primary canvas / page background (60% of UI) |
| **Navy Mid** | `#0d2438` | Card surfaces, panels, secondary backgrounds |
| **Navy Light** | `#1e3a52` | Borders, dividers, subtle separators |
| **Graphite** | `#354052` | Support base, inactive elements |
| **Signal Lime** | `#C7F368` | Primary accent — high-vis highlights, CTAs, records, PBs (5% of UI) |
| **Split Aqua** | `#00C2D7` | Digital interface, links, data overlays, timing boards (10% of UI) |
| **Split Blue** | `#155EEF` | Brand blue, badges, gradients (25% of UI) |
| **Ice** | `#E8F8FA` | Secondary text, muted labels |
| **White** | `#FFFFFF` | Primary body text, headings |

**Colour rule:** 60% dark navy + 25% split blue + 10% aqua + 5% signal lime. Never use white or light backgrounds — this is a dark-first, cinematic design system.

### Typography
| Role | Font | Weight | Style |
|---|---|---|---|
| **Display / Timing** | League Spartan | 800 (Heavy) | UPPERCASE, tight letter-spacing (-0.02em) |
| **Headlines** | League Spartan | 700 (Bold) | UPPERCASE |
| **Body / Interface** | Inter | 400 / 500 / 600 | Mixed case |
| **Data labels / mono** | JetBrains Mono or similar | 400 | UPPERCASE, wide tracking |

**Typography rule:** Timing readouts, hero headings, and stats always use League Spartan. All other text uses Inter. Data labels (event names, rank numbers, split times) use monospace.

### Pattern & Texture
- **Speed lines:** 15-degree diagonal line pattern in Split Blue at ~12% opacity — used as section backgrounds and hero overlays
- **Lane markers:** Vertical swim lane lines in white at 6% opacity — used in hero sections
- **Split rule:** A horizontal line that "splits" at its centre into a Signal Lime segment — used as section dividers
- **Photography:** High-contrast, moody underwater and poolside imagery. Dark, cinematic. Never bright or lifestyle-casual.

---

## DESIGN PRINCIPLES

1. **Cinematic dark stadium feel** — like looking at a scoreboard at 10pm in a floodlit arena
2. **Data precision** — every number matters. Times shown as `MM:SS.ss`, ranks shown as `#1`, improvements shown as `▼ 0.32s`
3. **Speed motifs everywhere** — diagonal lines, lane markers, timing grid overlays
4. **Signal Lime = important** — only use `#C7F368` for the most critical data: records, PBs, world rankings #1, CTAs
5. **Aqua = interactive** — links, hover states, focus rings, live data, digital readouts
6. **Never casual** — no rounded pastel cards, no soft shadows, no warm tones

---

## PAGES TO DESIGN (13 screens)

### 1. Homepage (`/`)
**Layout:** Full-screen sections stacked vertically

**Section 1 — Hero (full viewport height)**
- Dark black/navy background with diagonal swim lane lines (white, 6% opacity)
- TOP LEFT: Logo (white wordmark — geometric S-mark + "TRANSPLANT AQUATICS" stacked)
- Navigation bar: dark navy, `--navy-light` border-bottom, nav links in white/60% opacity, active link in Signal Lime
- Hero text centred-left: eyebrow "Global Transplant Swimming" in Signal Lime mono; Main heading "EVERY SECOND" line 1, "COUNTS." line 2 with "COUNTS." in Signal Lime — League Spartan 800, ~90px
- Sub-text: "The world platform for transplant swimming — athletes, results, rankings and records captured to 0.001s resolution." in Ice/65% opacity, Inter 18px
- Two CTAs: Primary = Signal Lime bg, black text, "EXPLORE RANKINGS →"; Secondary = white border, white text, "FIND AN ATHLETE"
- Background overlay: faint decorative timing numbers top-right (58.92, 1:01.14 etc.) in Signal Lime/35% opacity, mono font
- Bottom-left: "SPLIT 01 / 29.11 · SPLIT 02 / 29.81 · FINAL / 58.92" in Signal Lime/20% opacity mono

**Section 2 — Live Timing Widget**
- Navy bg with `--navy-light` border-bottom
- Eyebrow: "LIVE" in Signal Lime
- Heading: "REAL-TIME TIMING SYSTEM" League Spartan
- A simulated live race display: 4 lanes, each showing athlete name, lane number, live split time ticking up, progress bar in Aqua, "LIVE" pulsing red badge → "FINISHED" in Signal Lime when done
- Dark terminal-style UI, monospace times, lane lines in Aqua

**Section 3 — Stats Strip**
- Navy-mid background
- 4 stat blocks in a row: "12,482 Athletes" · "86 Countries" · "142,390 Results" · "68 Records"
- Each: large number in League Spartan/Signal Lime, label in mono/muted

**Section 4 — World Rankings Preview**
- Black background
- Heading: "WORLD RANKINGS" League Spartan
- Filter row: Age Group / Gender / Event / Course dropdowns in dark navy inputs with Aqua focus
- Rankings table: dark striped rows, rank# in Aqua mono, athlete name in white, flag emoji, time in Signal Lime mono, transplant type badge

**Section 5 — Fastest by Transplant Type**
- Navy background
- Discovery view disclaimer badge: "DISCOVERY VIEW — NOT AN OFFICIAL RANKING" in Navy-light border, muted text
- 6 cards (Kidney, Liver, Heart, Lung, Pancreas, Bone Marrow): dark navy cards, coloured dot, athlete name, flag, time in Signal Lime, event in mono

**Section 6 — Featured Athletes**
- Black background
- 4 athlete cards: dark navy-mid card, initials avatar (dark square), name in white, country, transplant badge, PB time in Signal Lime

**Section 7 — From the Pool Deck**
- Navy-mid background
- 3 article cards: horizontal thumbnail placeholder, category in Aqua, title in white Inter, excerpt in muted, date in mono

---

### 2. Rankings Page (`/rankings`)
- Page hero: "WORLD RANKINGS" League Spartan 72px, subtitle in muted
- Full filter bar: 4 dropdowns side by side, dark navy inputs with Aqua borders on focus
- Rankings table: full width, columns: Rank · Athlete · Country · Transplant Type · Time · Course · Age Group · WTG Std
- Each row: rank in Aqua mono, athlete name white, flag, time in Signal Lime mono for top 3, regular white for rest
- "WTG Standard" column: green checkmark "✓ Qualified" or Aqua "0.84s off standard"
- Transplant type filter pills above table
- Pagination or "Load more" in Aqua

---

### 3. Athletes Page (`/athletes`)
- Hero: "THE ATHLETES" heading, search bar (dark input, Aqua focus), 4 filter dropdowns
- Grid of athlete cards (3-4 columns): each card — dark navy-mid bg, initials square, name, country flag, transplant badge (coloured), age group mono, best PB time in Signal Lime

---

### 4. Athlete Profile (`/athletes/:id`)
**Profile hero (dark navy-mid bg):**
- Back breadcrumb in muted
- 80×80 avatar square (initials, dark navy-light bg)
- Name in League Spartan 48px white
- Transplant badge + age group badge + "#X World Ranking" badge in Signal Lime
- Country flag + country name
- 3 hero stats: World Rank (Aqua), Personal Best (Signal Lime), Results count (white)
- "Is this you? Claim this profile →" banner in Aqua

**Tabs:** Overview · Results · Medals · Media (Signal Lime underline on active)

**Overview tab layout (2-column):**
- Left column: PB table (event, time, course, date, WTG standard indicator), Season Progression table (years as columns, events as rows, PBs in cells, Signal Lime = overall PB)
- Right column: Athlete bio, stats (percentile "Top 12% in age group" bar), Donor tribute card (heart icon, "In honour of [name]"), recent results

---

### 5. Results Page (`/results`)
- Full results database table
- Search input + 4 filters (event, course, age group, gender)
- Table: Date · Athlete · Event · Time · Course · Meet · Age Group · Transplant Type
- Times in Signal Lime mono, dates in muted mono

---

### 6. Records Page (`/records`)
- "WORLD RECORDS" heading
- Filter: by event, course, age group
- Record cards: Signal Lime left border, event name in League Spartan, record time in Signal Lime large, athlete name, date set, "Record history" expandable

---

### 7. Calendar Page (`/calendar`)
- "RACE CALENDAR" heading
- WTG Countdown featured card at top: "WORLD TRANSPLANT GAMES 2027 — LEUVEN, BELGIUM" with live countdown DAYS / HRS / MINS / SECS in League Spartan, Split Blue background with speed-lines overlay
- Month grouped list view of meets: each row = date chip (Aqua bg) + meet name + location + course badge + status badge (Upcoming/Completed)
- Filter: year, month, country

---

### 8. WTG Hub (`/games`)
- Hero: "WORLD TRANSPLANT GAMES" full-width, speed-lines dark bg
- Countdown timer: massive League Spartan numbers, Signal Lime, for Leuven 2027
- Medal table: dark table, gold/silver/bronze columns with coloured dots, rank numbers in Aqua
- Past games grid: 4 cards (2023, 2019, 2017, 2015) — dark cards, city, year

---

### 9. Compare Athletes (`/compare`)
- "COMPARE ATHLETES" heading
- Search + select up to 4 athletes: each selected athlete appears as a column header with their name, flag, transplant badge
- Comparison table: event rows, athlete columns — PB time in each cell, fastest in each row highlighted in Signal Lime
- "Clear all" button in muted

---

### 10. Submit Result (`/submit`)
- Multi-step form (4 steps) with progress bar in Signal Lime
- Step 1: Meet details; Step 2: Swim details; Step 3: Proof upload; Step 4: Success
- All inputs: dark navy bg, navy-light border, Aqua focus ring, white text
- "Result submitted — Pending verification" success state with reference number

---

### 11. Login / Register / Profile (`/login`)
**Full-page layout (no main nav):**
- Left: dark navy-mid panel with form
- Right (desktop): brand panel — dark navy bg, speed-lines overlay, "EVERY SECOND COUNTS." in League Spartan, Signal Lime, large
- Sign In / Register tabs (Signal Lime underline on active)
- All inputs: dark navy bg, navy-light borders, Aqua focus
- CTA: Signal Lime bg, black text, League Spartan uppercase

**Profile page (logged in):**
- Header shows avatar initials circle (navy-light bg) + dropdown with "My Profile", "My Results", "Sign Out"
- Profile completeness bar in Signal Lime/Aqua
- Editable fields inline, transplant details marked "Private by default"

---

### 12. From the Pool Deck (`/from-the-pool-deck`)
- "FROM THE POOL DECK" heading
- Category filter pills: All · Performance · Medical · Community · Profiles · Records
- Article grid: 3 columns, each card — dark placeholder image (speed-lines pattern), Aqua category label, white title, muted excerpt, date + read time in mono
- Newsletter section at bottom: "STAY IN THE WATER." League Spartan, email input + Signal Lime CTA

---

### 13. 404 Page
- Large "404" in League Spartan, Signal Lime, ~200px
- "THIS PAGE DOESN'T EXIST." sub-heading in white
- "Every split matters. This one doesn't." tagline in muted
- 3 nav links: Home · Rankings · Athletes
- Speed-lines bg

---

## COMPONENT SPECIFICATIONS

### Navigation Header
- Fixed top, `#010410` bg, `#1e3a52` border-bottom, height 56px
- Left: Logo (white wordmark)
- Centre: Nav links (Rankings · Athletes · Results · Records · Countries · From the Pool Deck) — white/60% inactive, Signal Lime active
- Right: "Press / to search" hint in muted mono + Search icon + User/Avatar icon + "JOIN" button (Signal Lime bg, black text, League Spartan uppercase)

### Cards — Dark style
- Background: `#0d2438`
- Border: `#1e3a52` (1px solid), hover → `#00C2D7` (Aqua)
- No box shadows — use borders only
- No rounded corners (or very subtle: 2px max)
- Internal padding: 20px

### Buttons
- **Primary:** `#C7F368` bg, `#000` text, League Spartan 700 uppercase, no border-radius (or 2px)
- **Secondary:** transparent bg, `#E8F8FA` border, white text
- **Ghost:** no bg, `#00C2D7` text, hover underline
- **Danger:** `#1e3a52` bg, `#ef4444` text

### Data Tables
- Background: `#010410`
- Header row: `#0d2438` bg, white text, mono uppercase tracking-widest
- Data rows: alternating `#010410` / `#0d2438`, white text
- Times: `#C7F368` mono — top 3; white mono — rest
- Rank numbers: `#00C2D7` mono
- Borders: `#1e3a52` row separators

### Badges / Pills
- Transplant type: coloured dot + mono text on `#0d2438` bg, `#1e3a52` border
- Verified: `#22c55e` — "✓ VERIFIED"
- Pending: `#f59e0b` — "◐ PENDING"
- Live: `#ef4444` pulsing — "● LIVE"
- WTG Qualified: `#22c55e` — "✓ WTG QUALIFIED"

### Form Inputs
- Background: `#010410`
- Border: `#1e3a52` (1px)
- Focus border: `#00C2D7` (Aqua)
- Text: white
- Placeholder: white/30% opacity
- Label: mono uppercase tracking-widest, `#8fa5b5` colour

---

## DESIGN DELIVERABLES REQUESTED

Please generate:
1. **Homepage** — full-page desktop + mobile
2. **Rankings page** — desktop with full table
3. **Athlete profile page** — desktop, Overview tab active
4. **Login page** — desktop with sign-in form visible
5. **Calendar page** — with WTG countdown featured
6. **Compare athletes** — with 2 athletes loaded

**Screen sizes:**
- Desktop: 1440px wide
- Mobile: 390px wide (iPhone 15 proportions)

**File format:** Figma frames preferred. PNG/JPG acceptable.

---

## REFERENCE AESTHETIC

Think: **F1 timing board + Oura Ring dark UI + Nike Training app + Whoop dashboard** — high-performance, data-dense, cinematic dark.

NOT: fitness lifestyle app, health tracker, community forum, social network.

The Transplant Aquatics UI should feel like a professional sports federation platform. Every pixel communicates precision, speed and the extraordinary achievement of competing after an organ transplant.
