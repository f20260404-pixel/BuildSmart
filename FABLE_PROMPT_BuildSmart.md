# Prompt for Claude Fable — Construction Planning & Estimation SaaS (working name: "BuildSmart")

> Paste everything below this line into Fable. Replace anything in `[square brackets]` before sending.

---

## 0. Your role and how I want you to work

You are a senior full-stack engineer, product designer and construction-tech domain expert. You are building a production-quality MVP of a SaaS web app for architects, small and mid-size builders and contractors in **India**.

How we will work:
1. **Do not write code first.** Start by sending me (a) your understanding of the product in 10 bullet points, (b) the proposed architecture and folder structure, (c) the full data model (TypeScript types), (d) the Phase 1 task list, and (e) every question or assumption you have. Wait for my "go" before coding.
2. Build **phase by phase** (Section 12). Finish each phase with working, tested code and a short demo walkthrough before starting the next one.
3. After each phase, give me: what was built, how to run it, what's still missing or stubbed, and known limitations.
4. When something is ambiguous, pick the most reasonable default, write it down in `docs/ASSUMPTIONS.md`, and keep going. Stop and ask only for decisions that are expensive to undo.
5. Keep a running `docs/CHANGELOG.md` and a `README.md` with setup steps.
6. Never invent regulation values or prices and present them as facts. See Sections 8 and 13.

---

## 1. Problem statement (verbatim — this is what we are solving)

> Construction projects routinely suffer from massive cost overruns caused by manual estimation and fragmented design approvals. How can we leverage an integrated software platform to analyze blueprints, generating instant cost estimates, precise zero-waste material quantities, streamlined builder tender evaluations?

Our original (fuller) problem statement, which the product must also satisfy:

> Construction projects still face huge budget overruns and permit delays just because estimating costs, approving a building's design rules, and comparing builder bids are being done manually. How can we use a **personalised AI model integrated into a software** that gives the estimated costs, precise material quantity **including buffer (to minimise the waste)**, the **legal violations** with the plan, and additionally gives **design optimisations to reduce the costs and match personal and terrain conditions**, finalising builder tenders?

Every feature must trace back to one of these outcomes:
- **A. Instant cost estimates** from the design
- **B. Precise material quantities with a smart buffer**: total and per day, with just enough extra to cover real-world loss and nothing more
- **C. Fewer approval problems**: catch legal/bylaw violations at design time, before the plan is submitted to the municipality
- **D. Streamlined tender evaluation, ending in a final recommended bidder**
- **E. A personalised AI design copilot**: gives design optimisations that cut cost and fit the owner's personal needs and the site's terrain/climate. It suggests things proactively while the user builds, and on demand when the user asks ("optimise this area for …").

---

## 2. Product vision in one paragraph

The user **designs the building inside the app**: draws the floor plan, places walls, lifts them to the heights they need, adds doors, windows, columns, beams and slabs, and stacks floors. Every element has a **material** chosen from a library (brick, AAC block, wood, RCC of a given grade, and so on). The user enters **their own vendor's prices**. Because the app *knows* every element precisely, rather than guessing from an uploaded PDF, it computes exact quantities, a full Bill of Quantities (BOQ) and cost, live, as the user draws. It then turns the design into a **day-by-day site plan** ("today: 4 masons, 9 helpers; mix 18 bags of cement; lay 4,200 bricks on Wall W3–W7") based on the workforce the user enters. While the user draws, a **compliance engine** flags violations of the local building bylaws (starting with Mumbai), and an **optimisation layer** suggests ways to save space, material and money. Finally, the user can upload **builder tenders/quotations** and the app compares them line by line against its own estimate.

**Why this beats existing tools (keep this positioning in mind):**
- AI takeoff tools (Togal.AI, Beam AI, STACK, Kreo, Autodesk Forma Takeoff) read uploaded drawings, are mostly US-focused, and don't do design, Indian bylaws or daily site planning.
- AutoDCR / BMC CivitTwin check plans **after submission**, for the municipality. We check **while drawing**, for the designer.
- No single tool combines design + Indian quantities + the user's own vendor prices + a daily schedule + rebar optimisation + tender comparison for small and mid-size Indian builders.

---

## 3. Non-negotiable engineering principles

1. **All quantity, cost, schedule and compliance math is deterministic TypeScript code with unit tests.** An LLM must never compute a number that appears in an estimate, BOQ, schedule or compliance verdict.
2. **AI is a first-class part of the product.** It is the design copilot (Section 6.13): proactive suggestions while drawing, on-demand "optimise this area", layout and structural recommendations, personalised and terrain-aware advice, plain-language explanations, tender extraction, a final tender recommendation, a what-if assistant and plan auto-trace. The one rule: **AI proposes, the deterministic engine measures.** AI proposals become typed model edits. The engine then recomputes cost, quantities and compliance, and those engine numbers are what the user sees as the impact. AI never types a number straight into a BOQ, schedule or compliance verdict. The user previews and accepts each change (one click, undoable).
3. **Every constant is editable data, not hard-coded logic.** Densities, mix ratios, wastage %, labour productivity, steel thumb rules and bylaw values live in JSON/DB config with a `source` field and a `verified: boolean` flag.
4. **Single source of truth:** one building model (Section 5). The 2D view, 3D view, BOQ, schedule and compliance checks are all *derived* from it. Nothing is stored twice.
5. **Units:** SI metric internally (metres, m², m³, kg). Display in the user's chosen units. Currency is INR with Indian digit grouping (₹12,34,567) and lakh/crore shorthand.
6. **Reproducibility:** the same model + the same prices + the same settings always gives the same estimate. Every estimate is versioned and timestamped.
7. **Give real recommendations, confidently.** The app actively recommends: column grids, preliminary beam/column/slab/footing sizes, foundation type for the soil, material choices and layout changes. No nagging banners or disclaimers on every screen. Each recommendation shows its basis (rule of thumb, standard clause, or engine result), its confidence level and its impact. Two light touches only: (a) each recommendation is tagged with what it's based on, so the user can judge it; (b) the exported **approval/construction drawing package** carries a single line reserving the structural engineer's sign-off. In India the stability certificate for a building plan has to come from a licensed engineer, so the app prepares the sizes and the engineer finalises them. Compliance flags cite their clause and rule-pack version.
8. **Undo/redo everywhere**, autosave, and no data loss.

---

## 4. Tech stack (use this unless you have a strong reason not to; justify any change)

- **Frontend:** React 18 + TypeScript + Vite
- **2D editor:** `react-konva` (Konva) for the plan canvas
- **3D preview:** `@react-three/fiber` + `drei` (read-only extrusion of the model in Phase 1; editable later if feasible)
- **State:** Zustand (with an undo/redo middleware, e.g. a command pattern or `zundo`)
- **Validation:** Zod schemas for every model type and config file
- **Styling/UI:** Tailwind CSS + shadcn/ui (or Radix), lucide icons
- **Charts:** Recharts (cost breakdown, daily material usage, tender comparison)
- **Persistence (Phase 1):** local-first in IndexedDB (via `idb` or Dexie), with JSON project export/import
- **Backend (Phase 3+):** Supabase (Postgres + Auth + Storage) for accounts, multi-project storage, vendor price lists and team sharing. Keep a repository/adapter layer so we can switch from IndexedDB to Supabase without touching the UI.
- **Exports:** BOQ to Excel (`exceljs` or SheetJS) and PDF (`@react-pdf/renderer` or `pdfmake`); schedule to Excel/PDF; plan to PNG/SVG
- **Optimisation:** a pure TypeScript solver for 1D cutting stock (heuristic + optional ILP via `javascript-lp-solver` / `glpk.js`)
- **AI layer (Phase 4):** server-side calls to the Claude API through a small backend route. The API key lives in env vars only and never reaches the client. Provide a mock AI provider for offline dev and tests.
- **Testing:** Vitest (unit, mainly for all calculators), React Testing Library (components), Playwright (end-to-end flows)
- **Quality:** ESLint + Prettier, strict TypeScript, GitHub Actions CI (lint + typecheck + test)

---

## 5. Core data model (draft — refine it, then show me before coding)

```ts
Project { id, name, city: CityCode, plotId, floors: Floor[], settings: ProjectSettings,
          materialLibraryId, priceListId, workforce: WorkforcePlan,
          owner: OwnerProfile, site: SiteConditions, createdAt, updatedAt, version }

OwnerProfile {   // drives personalisation
  budget: { target, hardCap }, priority: 'lowest_cost'|'balanced'|'premium'|'fastest_build',
  household: { adults, children, elderly, pets, futureGrowth: boolean },
  needs: { workFromHome, accessibility (wheelchair/no-steps), parkingCount, rentalUnit, shop?: boolean },
  style: { vastuPreference: 'none'|'prefer'|'strict', naturalLight: 'low'|'med'|'high', openPlan: boolean },
  materialPreferences: { prefer: MaterialId[], avoid: MaterialId[] }, notes: string }

SiteConditions { // drives terrain/climate-aware design
  soilType: 'rock'|'hard_murum'|'medium_clay'|'soft_clay'|'black_cotton'|'sandy'|'filled'|'unknown',
  safeBearingCapacity?: kN/m², waterTableDepth?: m, slopePct?, slopeDirection?,
  seismicZone: 'II'|'III'|'IV'|'V', windZone?, floodProne: boolean, coastal: boolean,
  climate: 'hot_dry'|'warm_humid'|'composite'|'temperate'|'cold', annualRainfall?,
  northDirectionDeg, neighbouringBuildings?: Polygon[], treesToKeep?: Point[], soilReportUploaded?: FileRef }

Plot { boundary: Polygon (m), area, roadWidth, roadSides: Side[], frontSide, zone?: string }

Floor { id, level (0 = ground), name, floorToFloorHeight (m), slab: Slab, walls: Wall[],
        openings: Opening[], columns: Column[], beams: Beam[], rooms: Room[] }

Node  { id, x, y }                     // wall endpoints; walls form a graph so joints/corners are exact
Wall  { id, startNodeId, endNodeId, thickness, height, baseOffset, materialId,
        type: 'load_bearing' | 'partition' | 'parapet' | 'boundary',
        finishes: { inner?: FinishId, outer?: FinishId }, reinforcementBandIds?: [] }
Opening { id, wallId, kind: 'door'|'window'|'ventilator'|'opening', offsetAlongWall, width,
          height, sillHeight, lintel: boolean, materialId? }
Column { id, x, y, width, depth, height, concreteGrade, steelRule }   // rectangular first
Beam   { id, fromColumnId|nodeId, toColumnId|nodeId, width, depth, concreteGrade, steelRule }
Slab   { thickness, concreteGrade, steelRule, polygon? (defaults to floor outline) }
Room   { id, name, type: RoomType, polygon (auto-detected from closed wall loops), area, carpetArea }
Footing{ id, columnId, length, width, depth, concreteGrade, steelRule }  // simple isolated footings in Phase 1

Material { id, name, category: 'masonry'|'concrete'|'steel'|'timber'|'mortar'|'plaster'|'finish'|'aggregate'|'binder',
           unit, density?, dimensions?, mixRatio?, wastagePct, source, verified }
PriceItem { materialId, vendorName, unit, pricePerUnit (INR), gstPct, validFrom, notes }
WorkforcePlan { crews: Crew[], workingDaysPerWeek, holidays: Date[], startDate, shiftHours }
Crew  { trade: 'mason'|'helper'|'bar_bender'|'carpenter'|'shuttering'|'plasterer'|...,
        count, productivity: { activity: ActivityType, outputPerDay, unit }[] }
```

Requirements on the model:
- Walls are a **graph** (shared nodes), so joints, T-junctions and corners are handled correctly and corner volume is never double-counted.
- Room polygons are **auto-detected** from closed wall loops (planar graph face detection).
- Openings are **deducted** from wall quantities following IS 1200 measurement conventions. Make the deduction rules configurable, since IS 1200 has thresholds for small openings.

---

## 6. Module specs

### 6.1 Floor-plan & building editor (the heart of the product)
- Grid canvas with snapping (to grid, endpoints, midpoints, perpendicular, extensions), adjustable grid size, zoom/pan, and a scale bar.
- **Wall tool:** click-click to draw a polyline of walls. Type exact lengths and angles while drawing. Set thickness and height per wall or for many walls at once.
- **"Lift walls" control:** select walls and drag or type their height. Default comes from the floor-to-floor height minus slab thickness.
- **Live dimensions** on every wall, plus room areas shown inside each room.
- Tools for doors and windows (dragged along a wall), columns, beams, staircase (simple straight/dog-legged with rise/tread inputs), and slab.
- **Floors:** add, duplicate ("copy floor plan to floors 2–7") and edit per floor. A ghost overlay of the floor below helps align columns.
- **Material painting:** select elements → choose a material from the library. Colour-code the plan by material.
- **Properties panel** for the selected element. **Layers panel** (walls, openings, structure, dimensions, flags, suggestions).
- **3D preview** toggle: walls extruded, openings cut, slabs stacked, coloured by material.
- **Templates** to start from: 1BHK/2BHK/3BHK apartment units, an independent house and a G+3 building.
- **Upload as underlay (Phase 4):** import a PNG/PDF plan as a scaled background image to trace over. Later, AI-assisted auto-trace that proposes walls for the user to confirm.
- Recommendations appear **inline on the canvas** as soft badges (Section 6.7) and can be accepted with one click.
- It must feel smooth: 60 fps while drawing on a 500-wall model, keyboard shortcuts, and no jank.

### 6.2 Materials library
- Ships with editable Indian defaults: modular clay brick (190×90×90 mm) and conventional brick (230×110×75 mm), fly-ash brick, AAC block (600×200×100/150/200), concrete block, OPC 43/53 and PPC cement (50 kg bag), river sand / M-sand, 10/20 mm aggregate, TMT Fe500/Fe500D/Fe550 in diameters 8/10/12/16/20/25/32 mm, cement mortar mixes (1:4, 1:5, 1:6), concrete grades (M10, M15, M20, M25, M30), plaster, and timber (common species with density).
- Each material has: unit, density, dimensions, mix ratio (where relevant), default wastage %, `source`, `verified`.
- The user can add custom materials and override any value per project.
- Concrete grades: nominal mix ratios for M10/M15/M20 (e.g. M20 ≈ 1:1.5:3). M25 and above are **design mixes**, so the user enters the mix proportions or cement content per m³ from their mix design.

### 6.3 Vendor price lists
- The user creates price lists (per vendor) with price per unit, GST % and validity date.
- Unit conversion is handled automatically (bag ↔ kg ↔ m³ for cement; tonne ↔ kg for steel; per 1000 bricks ↔ per brick; brass ↔ m³ for sand/aggregate, where 1 brass = 100 cft ≈ 2.83 m³).
- Several vendors per material, with a "cheapest / preferred vendor" toggle.
- Price history, plus a warning when a price is older than N days (default 30).
- Optional "reference rates" import (e.g. a CSV the user downloads from the CPWD Schedule of Rates or a state SOR) to use as defaults or for sanity checks.

### 6.4 Quantity engine (deterministic — the most important code in the app)
Compute, per element, per floor and for the whole project:
- **Masonry:** net wall volume (after opening and lintel deductions) → number of bricks/blocks + mortar volume → cement bags + sand.
- **Concrete (RCC/PCC):** per footing, column, beam, slab, lintel and staircase → wet volume → dry volume → cement bags, sand and aggregate.
- **Steel (TMT):** Phase 1 uses kg-per-m³ thumb rules per element type (editable). Phase 2 uses a bar-level **Bar Bending Schedule (BBS)** with user-defined reinforcement per element (bar diameter, spacing, cover, number of bars, laps, hooks, bends), using unit weight = D²/162 kg/m (D in mm).
- **Plaster** (internal/external, thickness, mix), **flooring/finishes** (area based), **shuttering/formwork** area for concrete elements, and **excavation** volume for footings.
- Starting defaults (all editable and flagged for verification in config):
  - Modular brick with 10 mm joints → ~500 bricks per m³ of brickwork
  - Dry-volume factor: ~1.54 for concrete, ~1.27–1.33 for mortar
  - Cement: 1 bag = 50 kg ≈ 0.0347 m³ (density ~1440 kg/m³)
  - Steel thumb rules (kg/m³ of concrete; rough guides only): slabs ~80–100, beams ~120–160, columns ~150–220, footings ~70–90
  - Default wastage: bricks 3–5 %, cement 2–3 %, sand 5–10 %, aggregate 3–5 %, steel 3–5 % (before cut optimisation)
- **Smart buffer (not blind wastage):** every material shows three numbers — *net quantity* (exact from the design), *buffer* and *order quantity* (net + buffer, rounded to vendor pack sizes). The buffer % is computed, not fixed. It depends on material, activity, crew experience (a user setting), site storage/handling conditions, the monsoon season for cement/sand, and the waste reductions the optimiser already achieved (e.g. after rebar cut optimisation the steel buffer drops to ~1–2 %). Show why each buffer is what it is. As the project runs, actual-vs-planned consumption feeds back into buffers for the remaining work and for the user's future projects (personalisation, Section 6.13).
- Output a **BOQ** with item no., description, unit, quantity, rate, amount, and grouping by trade/floor/element. It must follow an IS 1200-style item structure.
- **Live update:** BOQ totals refresh within ~100 ms of any edit. Show a sticky "Project cost: ₹ X" in the header with Δ vs the last saved version.
- Every number in the BOQ must be **traceable**: clicking a line shows the formula, the inputs and the elements it came from.

### 6.5 Cost estimation
- BOQ × vendor prices → material cost, plus labour cost (from crew day-rates × schedule days), plus user-defined overheads (contingency %, contractor margin %, GST, transport, site overheads).
- Cost breakdown charts by trade, floor and material. Cost per sq ft / sq m of built-up and carpet area.
- **Scenario comparison:** duplicate a project version, swap materials (e.g. clay brick → AAC block, M20 → M25) and compare cost, quantity and schedule side by side.
- **Sensitivity:** "if steel price rises 10 %, total cost rises ₹ X (Y %)".

### 6.6 Daily site plan & scheduler
- Activities are generated from the model in construction order: site clearance → excavation → PCC → footings → plinth beam → columns per floor → beams + slab per floor → masonry per floor → lintels → plastering → flooring/finishes.
- Each activity has quantity (from the quantity engine) ÷ (crew count × productivity per day) = duration. Dependencies are honoured, including curing waits (e.g. a minimum wait after casting before de-shuttering or loading). All waits are configurable.
- The user enters workforce per trade (how many people today/this week) and productivity. Defaults are editable, e.g. a mason with helpers ~1 m³ brickwork/day, plastering ~8–10 m²/day per mason.
- **Daily view:** for each day — activities, which walls/elements, crews needed, and **materials to mix/issue today** (e.g. "mix 18 bags cement + 1.3 m³ sand for 1:6 mortar; issue 4,200 bricks; cut and bend 312 kg of 10 mm bars"). Mixing is broken into batch sizes (e.g. per 1-bag mixer batch) so nothing is over-mixed. Mortar and concrete must be used within their workable time, so don't schedule mixing that can't be used the same day.
- **"Today" mode** for the site supervisor: a simple mobile-friendly screen showing today's tasks, materials and a checkbox to mark progress (actual vs planned). Re-plan the remaining schedule when actual progress differs.
- **Procurement plan:** when to order what, given vendor lead times and on-site storage limits. Avoid overstocking (cement shelf life, steel rusting, sand theft/loss).
- Gantt chart view and an Excel/PDF export.

### 6.7 Optimisation & recommendations — rule-based layer (fast, offline; the AI copilot in 6.13 builds on top of it)
Deterministic checks that produce suggestions with quantified impact:
- Rooms below the minimum area/width for their type, and rooms far above typical sizes (wasted area)
- Corridor/passage width above what's needed → area that could be reclaimed
- Carpet-area efficiency (carpet ÷ built-up) per unit and for the building, with a target band
- Wall lengths that don't fit whole bricks/blocks → suggest a dimension adjustment to cut brick wastage (modular coordination)
- Spans that suggest an extra column/beam would cut slab thickness or steel (flagged only as "discuss with structural engineer")
- Doors clashing with each other, windows too close to corners or columns, and missing ventilation openings for habitable rooms/kitchens/toilets (per the city rule pack)
- Material swaps with cost/time impact (AAC vs clay brick: fewer joints, lighter, different mortar)
- Stacking checks: toilets/kitchens not stacked above each other (plumbing cost), and columns not aligned across floors (marked as a high-severity warning)
- Each suggestion shows: what, why, impact (₹, m², kg, days) and **Apply / Dismiss**. Applying changes the model through the normal undo-able command system.

### 6.8 Near-zero-waste engine
- **Rebar cut optimisation (1D cutting-stock):** from the BBS, combine the required cut lengths into standard 12 m bars (stock length configurable) so offcuts are as small as possible. Reuse offcuts above a usable minimum length across elements and floors. Output a cutting plan per diameter ("Bar #1: 4.2 + 4.2 + 3.4 = 11.8 m, offcut 0.2 m"), the total bars to buy, and the waste % vs the naive approach. Respect lap and development lengths (configurable, e.g. as multiples of bar diameter) and laps at staggered locations.
- **Brick/block course planning:** per wall, count whole vs cut units given the opening positions. Suggest dimension nudges to reduce cuts.
- **Batch-size optimisation** for daily mortar/concrete mixing (Section 6.6).
- **Ordering optimisation:** round purchases to vendor pack sizes (bags, bundles, truckloads) with the least overbuy.
- A dashboard tile shows "material saved vs naive estimate: X kg steel, Y bricks, ₹ Z".

### 6.9 Compliance / violation flagger
- **Rule engine with rule packs as data.** One JSON (or DB) rule pack per authority, e.g. `rules/IN-MH-MUMBAI-DCPR2034.json`, `rules/IN-NBC2016.json` as the national fallback. Each rule has: `id`, `title`, `appliesTo` (building/floor/room/wall/opening/plot), `condition` (a small, safe expression DSL or a typed rule config — no arbitrary code execution), `params` (which may depend on road width, plot area, zone or building height), `severity` (error/warning/info), `message`, `clause` reference, `sourceUrl`, `verified: boolean`, `lastReviewed`.
- **Phase 3 rule coverage for Mumbai (DCPR 2034) + NBC 2016:** maximum building height and its dependence on road width, floor-to-floor/ceiling height ranges for habitable and non-habitable rooms, setbacks/marginal open spaces, FSI/FAR and ground coverage, minimum room sizes and widths, minimum stair/corridor widths, riser/tread limits, ventilation/light opening ratios, parapet height, lift requirement above a height threshold, and fire-related triggers for high-rise status. Plus a hook for an airport-height (CCZM/NOC) check where the user enters the permissible height manually.
- **IMPORTANT — do not fabricate values.** Create the rule schema and the Mumbai/NBC rule files with each value marked `verified: false` and a `TODO: confirm from official DCPR 2034 / NBC 2016 text, clause X` note, unless you are certain of the value *and* cite the clause. I will verify and fill the values from the official documents. The UI must show an "unverified rule" badge on flags produced by unverified rules.
- **Live flagging on the canvas:** red/amber outlines on offending elements, a violations panel listing each flag with its clause and how to fix it, and a "compliance score" per floor and for the building.
- **Region picker:** state → city/authority. If no pack exists for the chosen city, fall back to NBC 2016 and show a clear banner saying so. Rule packs are versioned so a project records which version it was checked against.
- Architecture for scale: adding a new city = adding a rule-pack file plus tests, with no code changes. Include a small internal "rule pack editor" page for admins.

### 6.10 Tender evaluation
- Generate a **tender BOQ document** (Excel/PDF) from our BOQ, with blank rate columns, to send to builders.
- Import builders' filled quotes: Excel/CSV directly (Phase 4: PDFs via AI extraction, with the user confirming every extracted line).
- Map bid line items to our BOQ items (auto-match by description/unit, manual fix-ups).
- **Comparison table:** our estimate vs each bidder, per line and in total, with the deviation % highlighted. Flag rates far below our estimate (risk of under-quoting and later claims) or far above it. Thresholds are configurable (e.g. ±15 %).
- Flag missing items, unit mismatches, quantity changes the bidder made, and arithmetic errors in the bid (rate × qty ≠ amount).
- A weighted scoring model (price, timeline, past performance, compliance with terms) with user-set weights. Output a ranked summary and a printable comparison report.
- **Tender finalisation:** the AI copilot produces a final recommendation ("Award to Bidder B; negotiate items 4.2 and 7.1 down by ~₹X; ask Bidder B to confirm cement brand and steel grade"). It gives the reasoning, the risks per bidder, negotiation points and a draft award/negotiation letter. The numbers in the recommendation come from the comparison engine, and the user makes the final award with one click, which locks the contract BOQ baseline for cost tracking.

### 6.11 AI assistant utilities (Phase 4; the main design copilot is 6.13)
- A chat side panel with project context: "What if I switch all internal walls to 100 mm AAC?" → the assistant proposes a change. The **deterministic engine** recalculates. The assistant explains the delta.
- Explain any compliance flag or BOQ line in simple English (and later Hindi).
- Tender PDF line-item extraction into a structured table that the user reviews.
- (Stretch) Auto-trace an uploaded plan image into proposed walls/openings for the user to confirm.
- Guardrails: the AI can only *propose* model edits through typed commands; the user confirms; every AI suggestion is logged. There is a server-side rate limit and a per-user usage cap.

### 6.13 AI design copilot — personalised, terrain-aware, proactive + on-demand (core feature)
This is a headline feature. Build it to feel like a smart architect + estimator sitting next to the user.

**A. On-demand: "Optimise this"**
- The user lasso-selects an area (a room, a group of rooms, a whole floor or the building), or just types in the copilot panel. Examples:
  - "Optimise this area for cost, keep 2 bedrooms."
  - "Make this kitchen bigger without changing the outer walls."
  - "Reduce the steel in this floor."
  - "Fit a home office here for my wife who works from home."
  - "Rearrange this flat so the master bedroom gets morning sun."
  - "Make this wheelchair-friendly for my father."
  - "Vastu-compliant layout for this floor, but don't increase cost."
  - "This plot slopes 8 % to the east — what should I change?"
- The user can also set goals with sliders/chips: cost ↓, carpet area ↑, natural light ↑, ventilation ↑, construction time ↓, steel ↓, keep-these-walls (lock icon), budget cap.
- The copilot returns **2–3 alternative options** for each request (e.g. "Option A: cheapest", "Option B: most space", "Option C: balanced"). Each option is shown as:
  - a **visual diff on the canvas** (ghost overlay: green = added, red = removed, blue = moved), with a before/after toggle and a 3D preview
  - an **impact card computed by the deterministic engine**: Δ cost ₹, Δ carpet area, Δ steel/cement/bricks, Δ schedule days, compliance status (still compliant? new flags?)
  - a short plain-language rationale
  - **Apply / Tweak / Discard**. "Tweak" lets the user say "like Option B but keep the balcony", and the copilot iterates.

**B. Proactive: suggestions while the user builds**
- After each meaningful edit (debounced, with the cheap rule-based checks first and the AI call only when useful), the copilot shows small, non-intrusive suggestion chips on the canvas and in a "Suggestions" feed. Examples:
  - "This 1.8 m corridor could be 1.2 m → +4.3 m² for the bedroom, ₹18k saved."
  - "Wall W12 is 3.07 m. Make it 3.00 m to use whole blocks."
  - "Columns C4 and C9 don't align with the floor below. Align them to avoid a transfer beam (≈₹1.2 L saving)."
  - "Your soil is black cotton. Consider under-reamed piles or a raft instead of shallow isolated footings."
  - "West-facing glazing in the living room will heat up in Mumbai afternoons. Add a 600 mm chajja or move the window."
  - "Stack Toilet T2 above T1 to share the plumbing shaft."
- The user controls how chatty it is: Off / Only important / All. Suggestions can be snoozed or dismissed ("don't suggest this again"), and dismissals teach the personalisation layer.
- Priority ranking: compliance-fixing > big cost savings > comfort/space > minor polish.

**C. Recommendation domains the copilot must cover**
1. **Layout & space:** room sizing and proportions, circulation, carpet efficiency, furniture-fit checks (bed/wardrobe/dining clearances), storage, future expansion (stairs and columns ready for an extra floor).
2. **Cost & material:** material swaps (clay brick ↔ AAC ↔ fly-ash; RCC grade; filler slabs; rat-trap bond where suitable), modular dimensions, fewer wall types, standard door/window sizes, vendor/price-aware choices.
3. **Structural recommendations:** column grid layout, span optimisation, preliminary sizing of slab thickness (span/depth rules), beams (span/depth ratios), columns (from tributary load and storeys) and footings (from load + safe bearing capacity), foundation type for the soil/water table, seismic-zone detailing reminders (IS 1893 / IS 13920 ductile detailing), avoiding floating columns and soft storeys. Show these as concrete recommended sizes with their basis, e.g. "Slab S1: 125 mm (span 4.2 m, two-way, L/d rule)". The sizes feed straight into the quantity engine.
4. **Terrain & site:** slope handling (stepped foundations, split levels, retaining walls), flood-prone plinth height, drainage/rainwater harvesting, coastal corrosion (cover, concrete grade, epoxy/CRS bars), expansive soils, high water table (waterproofing), preserving trees.
5. **Climate & comfort:** sun path from `northDirectionDeg` and latitude, orientation of rooms, shading devices, cross-ventilation, window-to-wall ratios, thermal mass and insulation by climate zone, daylight.
6. **Personal fit:** household needs from `OwnerProfile` (elderly → ground-floor bedroom, no-step entry, grab bars; kids → safe stairs; WFH → quiet office away from the street; pets; parking count; rental unit for income; optional Vastu preference).
7. **Compliance-driven fixes:** for every flag, a one-click proposed fix that resolves it with the least cost/area impact.
8. **Buildability & schedule:** fewer formwork variations, repetitive floors, sequencing that shortens the schedule.

**D. Personalisation — what "personalised AI model" means here**
- Phase 4 does not train a custom model from scratch. Personalisation = **profile + memory + retrieval**:
  - `OwnerProfile` + `SiteConditions` (explicit inputs, gathered by a friendly onboarding questionnaire the copilot runs in chat)
  - An org/user **preference memory**: accepted vs dismissed suggestions, preferred materials and vendors, typical room sizes they keep choosing, crew productivity and actual wastage from past projects. All stored in the DB and editable/clearable by the user.
  - **Retrieval (RAG)** over the rule packs, the materials/price data, the user's past projects and an internal design-guidelines knowledge base (NBC, IS codes summaries and good-practice notes), so recommendations cite sources.
- Later (Phase 5+): optionally fine-tune or train a small ranking model on accepted/dismissed suggestions to rank suggestions better. Design the logging schema for this now.
- Each user/org's data stays isolated. Their data is used to personalise their own copilot only, unless they opt in to anonymised improvement.

**E. How it works technically**
- The copilot is given a compact JSON summary of the model + profile + site + current BOQ/compliance state + the user's request. It returns **typed edit commands** (e.g. `moveWall`, `resizeRoom`, `setMaterial`, `addColumn`, `setSlabThickness`, `addShading`), validated with Zod. Invalid commands are rejected and the copilot retries once.
- Each option is applied to a **sandbox copy** of the model. The engines compute its impact before the user sees it.
- Constraint locks (walls/rooms the user locked, plot boundary, setbacks, budget cap) are passed to the AI and also enforced in validation.
- Streaming responses, with a visible "thinking" state; and when no API key is configured, it falls back to rule-based suggestions plus a mock provider.
- Log every request, option, accepted/dismissed decision and its engine-computed impact (this is the personalisation data and an audit trail).

### 6.12 Projects, users, sharing (Phase 3+)
- Auth (email/Google via Supabase), organisations/teams, roles (owner, architect, estimator, site supervisor, viewer).
- Project list, versions/snapshots, a comments-on-elements thread, and a read-only share link for clients.
- Audit log of estimate changes.

---

## 7. UX & design requirements
- Clean, modern, professional. Think Figma's polish meets a construction tool. Light and dark themes.
- Layout: top bar (project, floor switcher, live cost, compliance score), left toolbar (tools), centre canvas, right panel (properties / BOQ / flags / suggestions tabs), and a bottom drawer for the schedule/Gantt.
- Onboarding: a 60-second interactive tour, plus a "start from template" option.
- Everything explains itself: hovering any number shows its formula; every flag links to its rule.
- Responsive: the editor is desktop-first, and the "Today" site view and the dashboards are mobile-first.
- Accessibility: keyboard navigable, sufficient contrast, readable font sizes.
- Performance budgets: first load < 3 s on average broadband; editing interactions < 16 ms per frame; BOQ recompute < 100 ms for a 10-floor building.

---

## 8. Indian standards & references to model on (cite, don't copy)
- IS 456:2000 — plain and reinforced concrete (grades, nominal mixes, cover)
- IS 1200 — method of measurement of building works (BOQ item structure, deduction rules)
- IS 2502 — bending and fixing of bars (BBS conventions)
- IS 1786 — TMT/HSD steel bars
- IS 1077 / IS 12894 / IS 2185 — clay / fly-ash bricks / concrete and AAC blocks
- NBC 2016 — National Building Code (national fallback rules)
- Mumbai DCPR 2034 — the first city rule pack
- CPWD / state Schedules of Rates — optional reference price import

Where you use a value from one of these, put the standard and clause in the config `source` field. If you are not sure of a value, mark it `verified: false`.

---

## 9. Folder structure (suggested)
```
/src
  /app            routes, layout, providers
  /editor         canvas, tools, snapping, selection, commands (undo/redo)
  /model          types, zod schemas, graph utils, room detection
  /engines
    /quantity     masonry, concrete, steel, plaster, finishes, boq builder
    /cost         pricing, unit conversion, overheads, scenarios
    /schedule     activity generation, durations, dependencies, daily plan
    /optimise     cutting-stock, course planning, batch sizing, suggestions
    /compliance   rule engine, DSL evaluator, rule loader
    /tender       import, mapping, comparison, scoring
  /ai             provider interface, prompts, mock provider (server-calls only)
  /config         materials.json, productivity.json, wastage.json, defaults
  /rules          IN-NBC2016.json, IN-MH-MUMBAI-DCPR2034.json
  /ui             shared components
  /export         excel, pdf, image
/tests            unit (engines!), component, e2e
/docs             ASSUMPTIONS.md, CHANGELOG.md, ARCHITECTURE.md, RULES-GUIDE.md
```

---

## 10. Testing requirements
- **Every engine function has unit tests** with hand-worked examples in comments, e.g. "a 3 m × 3 m × 0.23 m brick wall with one 1 × 2.1 m door → expected bricks/cement/sand", "a 10 m² M20 slab, 125 mm thick → expected cement bags".
- Golden-file tests: a sample 2BHK project → a snapshot of the full BOQ. Any change in totals must be deliberate.
- Cutting-stock tests: known instances with known optimal waste.
- Compliance tests: one passing and one failing fixture per rule.
- Playwright E2E: draw a room → set materials → enter prices → see cost → generate schedule → see a flag → apply a suggestion → export BOQ.
- CI must be green before a phase is marked done.

---

## 11. Seed/demo data
- A demo project: a G+3 residential building in Mumbai with 2 × 2BHK per floor, column-beam RCC frame and brick infill. It should deliberately include 2–3 violations and 3–4 optimisation opportunities, so the demo shows every feature.
- A demo vendor price list. Prices are clearly marked as **sample values** and must be replaced by the user.
- A demo workforce (e.g. 4 masons, 8 helpers, 2 bar benders, 2 carpenters).
- Two demo tender bids (one realistic, one with an under-quoted line and an arithmetic error).
- A demo OwnerProfile (family of 5 incl. one elderly parent, one person working from home, budget cap, "balanced" priority) and demo SiteConditions (Mumbai, coastal, warm-humid, seismic zone III, medium clay, slight slope), so the copilot has something to personalise against.

---

## 12. Phased delivery plan with acceptance criteria

**Phase 1 — Design + Quantities + Cost (the core demo)**
- Editor: walls (graph), openings, columns, beams, slabs, floors, room detection, dimensions, 2D + read-only 3D, undo/redo, autosave, JSON export/import
- Materials library, vendor price lists, unit conversion
- Quantity engine (thumb-rule steel), BOQ with traceability, live cost, cost breakdown charts, BOQ Excel/PDF export
- ✅ Done when: I can draw the demo 2BHK in under 10 minutes, change a wall material, and watch the BOQ and cost update instantly with correct, tested numbers.

**Phase 2 — Schedule + Near-zero-waste**
- Workforce input, activity generation, daily plan with materials to mix/issue, Gantt, "Today" mobile view, actual-vs-planned tracking
- Bar Bending Schedule input, rebar cutting-stock optimiser, brick course planning, batch sizing, procurement plan
- ✅ Done when: the demo project gives a believable day-by-day plan, and the steel waste % after optimisation is reported against the naive approach.

**Phase 3 — Compliance + Accounts**
- Rule engine + DSL, NBC 2016 and Mumbai DCPR 2034 rule packs (schema complete, values flagged for verification), live canvas flags, violations panel, compliance score, region picker
- Optimisation suggestions with Apply/Dismiss
- Supabase auth, cloud projects, teams, roles, share links
- ✅ Done when: the demo's deliberate violations are flagged with clause references, fixing them clears the flags, and adding a test city pack requires no code changes.

**Phase 4 — AI design copilot + Tenders**
- OwnerProfile + SiteConditions onboarding (form + chat questionnaire)
- Copilot: on-demand "optimise this area" with 2–3 options, visual diffs, engine-computed impact cards, Apply/Tweak/Discard; proactive suggestion chips while drawing; structural, terrain, climate and personal-fit recommendations; preference memory + RAG with source citations
- Tender BOQ export, bid import (Excel/CSV/PDF via AI extraction), mapping, comparison, scoring, AI final award recommendation + negotiation points
- ✅ Done when: (1) on the demo project, "optimise this flat for cost, keep 2 bedrooms" returns 3 valid, compliant options with correct engine-computed savings, and one can be applied and undone; (2) changing the soil to black cotton and the owner profile to "elderly parent" produces relevant foundation and layout suggestions; (3) the two demo bids are compared correctly, the under-quote and arithmetic error are flagged, and the copilot recommends a bidder with reasons.

**Phase 5 — Polish & SaaS**
- Pricing tiers/feature gating (stubbed billing, e.g. Razorpay/Cashfree later), landing page, onboarding tour, Hindi UI strings, performance pass, accessibility pass, deployment (Vercel + Supabase)

---

## 13. Honesty & limitations you must respect
- Do **not** hard-code or invent bylaw values, prices or productivity figures and present them as authoritative. Use clearly labelled, editable defaults marked `verified: false` with a TODO pointing to the source to check.
- Structural recommendations are encouraged and should be specific and useful. Show the basis and confidence for each, and keep the single engineer sign-off line on exported approval/construction packages only (Principle 7). No repeated warning banners.
- Compliance flags cite their clause and rule-pack version, and the plan is still formally approved by the local authority (e.g. via AutoDCR/BMC systems). The app's job is to make that approval go through the first time.
- If something I asked for is infeasible or would take far longer than its value justifies, say so plainly and propose the closest practical alternative.

---

## 14. Environment, permissions and secrets
- You will need: read/write access to the project folder, a shell to run and test code, **package installs via npm** (I will make sure network/package access is enabled), and optionally Git/GitHub access to commit after each phase (commit only when I say so, on a feature branch).
- Use a browser to run the app and visually check the UI after each phase.
- Secrets (Claude API key, Supabase keys) go in `.env.local`, which is git-ignored. Provide a `.env.example`. Never print or commit secrets. If a key is missing, fall back to the mock AI provider.
- I will create any hosting/database accounts myself. Tell me exactly which keys/settings you need and when.

---

## 15. Your first reply should contain (and nothing else yet)
1. Your 10-bullet understanding of the product
2. Architecture diagram (text/mermaid) and folder structure
3. Full TypeScript data model draft
4. The quantity-engine formulas you plan to use, with worked examples and which values need my verification
5. Phase 1 task breakdown with estimates
6. Your questions and assumptions
7. Any risks you see, and anything you would change about this plan

Then wait for my "go".

---
*Project owner: Harsh Bhatia — [add team/college/hackathon name if relevant]*
