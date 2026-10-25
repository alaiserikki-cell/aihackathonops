# Right Pin
By Team Pin Drop. Submission for Case 1 of the AI x Ops Hackathon: franchise partner screening, territory allocation and onboarding for a retail brand in Karnataka.

Right Pin reads the Applications and Territories sheets, checks them against the 10 fixed existing stores, and gives every application one decision, a one-line reason and a next step. Partners who move forward get a week-by-week onboarding plan with training in their preferred language. A rule-based assistant answers follow-up questions and takes new information. No login, no backend, no LLM.

Live app: https://right-pin.vercel.app (no login; redeploys automatically from `main`).

## Try it in 2 minutes
1. Open the app and click **Load sample data** (20 judge-style applications with planted traps), or **Upload workbook** with your own file in the template format.
2. The first screen is the **Decisions** table: ID | Name | Decision | One-line reason | Next step. Click any row for the full reasoning, score breakdown and onboarding plan.
3. Open **Ask Right Pin** and try:
   - "Why is APP-007 on hold?"
   - "What should APP-006 do next?"
   - "How will APP-015 be trained?"
   - "Can APP-008 open somewhere else?"
   - "Which territory should we fill first?" or "Where are open slots?"
   - "Is there cannibalisation risk for APP-008?"
   - "Who are the top applicants in Bengaluru?"
4. Give new information: "APP-012 has now found a ground-floor space". Right Pin proposes Floor = Ground and asks "Is it owned or rented, and how many sq ft?". Answer "Rented, 500 sq ft", click **Confirm & reassess**, and it shows Hold (needs a site) → Approve, plus the knock-on effect: APP-003 Approve → Waitlist. "APP-012 found a 500 sq ft ground floor shop on rent" works in one step.

## Decisions
| Label | When |
|---|---|
| Approve | Passes every gate and wins a slot in its territory. |
| Conditional | Approved, but a scored input is unknown (for example business history) or the training language is missing. |
| Redirect | Passes every applicant gate but is blocked by an existing-store pin, by capacity or by an uncovered pin. Up to 2 open pins in the same city are suggested, High priority first. Suggestion only; the applicant is never moved automatically. |
| Waitlist | Passes every gate but loses the pin or the last slot, and no open pin exists in the city. |
| Hold (needs X) | Missing, contradictory or unconfirmed data, no confirmed site, or a launch faster than the minimum. X names what is needed. |
| Not eligible | Below a brand minimum (for example "Investment ₹20 lakh vs ₹30 lakh required (gap ₹10 lakh)"), or a location with no open territory. |

Every reason states the field, the value, the requirement, the gap and what unblocks it. Decisions come only from `dist/engine.js`. Free text (notes, business description) never decides an outcome; notes only raise flags, such as a "before Diwali" deadline that the timeline cannot meet.

## Proposed pilot assumptions
These are **proposed pilot assumptions for this demo, not an industry standard**. Replace them with the brand's signed-off requirements on the Scoring & rules page.
- Minimum investment ₹30 lakh, including an initial working-capital reserve.
- Minimum usable area 400 sq ft. Owned and rented sites score the same. The floor must be confirmed (Ground, First or another confirmed floor); "Upper", "Mall unit" or "Not known" go on hold until the actual floor is confirmed.
- Feasible launch window 3 to 6 months. Under 3 months goes on hold for timeline review; later than 6 months is allowed but scores less.
- Score weights 35 / 30 / 25 / 10: declared funds 35, premises readiness 30 (identified site 15, area 15), operator experience 25 (retail years 20, explicit business ownership 5), feasible launch 10. Funds and area are capped once the minimum is met.
- Territory priority rule: High-priority territories are filled, onboarded and launched first, then Medium, then Low. Redirect suggestions offer High-priority pins first. Within a territory, score decides (then sooner launch, then application ID).
- One store per pin. Existing-store pins are never allocated, and a territory never gets more recommendations than its open slots.
- Onboarding plan: funding check 1 week, site check 1, offer 1, agreement 2, fit-out 5, training 2 (3 for partners with under 1 year of retail experience, including supervised shifts at an existing store in their city), opening 1. Admin steps start in week 1; fit-out, training and opening are worked back from the target launch month.

Recommendations are provisional. Declared funds and premises still need verification before a final offer.

## Stack
- Static site served from `dist/`: plain HTML, CSS and vanilla JavaScript. No framework, no build step, no backend, no database, no external network calls after the page loads (fonts are system fonts, JSZip is vendored).
- `dist/engine.js`: deterministic decision engine (gates, scoring, allocation, redirects, decision labels, onboarding plans). The source of truth for every decision.
- `dist/bot.js`: rule-based assistant. Intent matching over engine output; it never invents facts and has no rent, demand or market data.
- `dist/app.js`, `dist/style.css`: UI, state and rendering.
- `dist/xlsx.js` + `dist/vendor/jszip.min.js`: in-browser Excel parsing.
- State lives in the browser's localStorage, with JSON backup and restore. Each visitor has an independent workspace.

## Run locally
```bash
python3 -m http.server 8080 --directory dist
```
Then open http://localhost:8080. On Windows, `python -m http.server 8080 --directory dist` works the same.

## Test
```bash
npm test
```
Uses the Node built-in test runner (`tests/*.test.cjs`); no dependencies to install. Coverage includes parsing and units, every decision label, specific reasons, redirects, priority ordering, onboarding timelines and deadline flags, every bot intent with paraphrases, end-to-end updates with knock-on effects, the sample workbook, importer behaviour, backup validation and 200 seeded allocation simulations.

Regenerate the sample workbook with `node scripts/make-judge-sample.cjs`.

## Deploy
- Vercel: https://right-pin.vercel.app is the production URL. `vercel.json` sets `outputDirectory` to `dist` with no build or install step, and every push to `main` redeploys.
- The earlier link (https://franchise-ops-ravi.cleantapir32.chatgpt.site) was set up from the original repository and does not include these changes.

## Files
- `dist/template.xlsx`: the official template.
- `dist/sample-judge-test.xlsx`: 20 applications and 6 territories with planted traps: an existing-store pin, two applicants in one pin, pins not covered by any territory, contradictory space fields (Owned with a blank size; Not yet identified with a size given), "₹25,00,000" and "40 lakhs" written as text, a 1-month launch, more qualified applicants than slots in a High territory, a Low-priority territory, an unfilled High territory, and Kannada and Hindi language preferences.
- `dist/qa-test-data.xlsx`, `dist/qa-rescoring.csv`, `docs/QA-REPORT.md`: earlier stress-test data and findings.
- `dist/franchise-methodology.docx`: research notes behind the screening policy.

## Limits
Right Pin does not verify bank statements, leases or identity, and has no coordinates, footfall, rent or demand data, so cannibalisation is checked only at pin and territory level. Workspaces are per browser; export a JSON backup to move work between devices. The old 60/10/30 percentile score appears only in the CSV export for comparison.
