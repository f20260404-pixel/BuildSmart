# BuildSmart

Design, cost, building rules, site plan and tenders for a building project in India, in one web app.

**Live site:** `https://f20260404-pixel.github.io/buildsmart/` (replace with your GitHub username after turning on GitHub Pages)

## The problem

Construction projects overrun because three jobs are still done by hand: estimating cost and materials, checking the building rules, and comparing builder quotes. The full problem statement is in [docs/PROBLEM_STATEMENT.md](docs/PROBLEM_STATEMENT.md).

## What BuildSmart does

| Step | What you do | What the app works out |
|---|---|---|
| 1. Site | Pick the city, soil, plot size, road width and open spaces | Seismic zone, foundation type and size, how much the plot allows (FSI, footprint, floors) |
| 2. Design | Draw walls, doors and windows, drag walls, import a DXF drawing, view the model in 3D | Rooms and areas, columns, live cost, rule violations, measured savings |
| 3. Materials and rates | Enter your vendors' prices and labour per hour by type of work | Item rates and the material buffer |
| 4. Estimate | Read the cost report | Bill of quantities, materials to order with a calculated buffer |
| 5. Site plan | Enter the crew | Day-by-day schedule, steel cutting list, stock checklist, extra expenses, weekly cash flow |
| 6. Tenders | Enter real quotes or import a filled tender sheet | Like-for-like comparison, flagged rates, cheapest, lowest-risk and fastest options |
| 7. Report | Read or copy one page | Design, cost, materials, structure, rules, savings and tender answer |

Also included: several projects, saved versions with comparison, and downloads (Excel workbook, project file, SVG and DXF drawings, tender sheet).

Every number comes from tested calculation code. The AI copilot only proposes changes, and the calculation engine measures each one before it is applied. On this static site the copilot needs an AI service to be connected; the rule-based savings work without it.

## Important notes

- Prices, labour outputs and open-space values are **sample values**. Replace them with your own.
- Mumbai FSI comes from DCPR 2034 Regulation 30, Table 12. Room sizes and open spaces are marked in the app as not yet checked against the regulation text.
- Structure and foundation sizes are preliminary sizes for planning, costing and tendering.
- Work is saved in your browser. Use "Download project file" to keep a copy.

## Files

| File or folder | What it is for |
|---|---|
| `index.html` | **The whole website in one file.** This is what GitHub Pages serves. |
| `src/engine.ts` | Core calculations: geometry and rooms, structure and foundation sizing, quantities, estimate, schedule, rule checks, savings, tender comparison |
| `src/rebar.ts` | Bar schedule and the 12 m steel cutting plan |
| `src/site.ts` | Stock position, extra expenses, forecast cost, weekly cash flow |
| `src/rules.ts` | Building rules as data, with the source of each value; Mumbai FSI table |
| `src/dxf.ts` | DXF import and export, SVG plan drawing |
| `src/xlsx.ts`, `src/exports.ts` | Excel writer, CSV, downloads, tender sheet out and in |
| `src/store.ts`, `src/versions.ts` | Projects and versions in the browser, version comparison |
| `src/App.tsx` | App shell, 2D editor and the seven pages |
| `src/View3D.tsx` | 3D model view |
| `src/SitePlus.tsx`, `src/SiteRules.tsx`, `src/ProjectTab.tsx`, `src/ImportDxf.tsx`, `src/ui.tsx` | Site-plan panels, plot and rules cards, project page, import dialog, shared inputs |
| `src/check.ts` | Calculation tests with hand-worked examples |
| `index.template.html` | Page shell and all styles; the build puts the bundled code into it |
| `build.sh` | Builds `index.html` from `src/` with esbuild |
| `tests/` | Browser tests (Playwright) and import/export tests |
| `docs/PROBLEM_STATEMENT.md` | The problem this project answers |

## Build it yourself

You need Node.js. Install the tools, then bundle:

```
npm install react react-dom esbuild typescript tsx
npx esbuild src/App.tsx --bundle --minify --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=app.js
```

Then paste `app.js` into `index.template.html` in place of `/*__BUNDLE__*/` and save it as `index.html`. `build.sh` does both steps, but its paths are set for the original build machine, so adjust them first. Run the calculation tests with `npx tsx src/check.ts`.

## Roadmap

Trace over an uploaded plan image or PDF, different plans per floor, stairs and balconies, counted electrical and plumbing, verified rule packs for more cities, accounts and cloud storage, Hindi and Marathi, and an accuracy benchmark against a completed building.
