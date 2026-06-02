# Revenue Share Calculator — Sweet Dreams × MC Racing

A single-page calculator for the Sweet Dreams × MC Racing monthly revenue-share deal.
Enter Mark's total monthly revenue once, see how much each side takes home, then
duplicate the calculator into multiple **scenarios** to compare different bracket
structures side by side.

## Features

- **One shared revenue input** drives every scenario.
- **Simple, editable bracket table** — change any tier's threshold *and* percentage; add or remove tiers.
- **Duplicate scenarios** to compare alternative percentage structures.
- **Live comparison table** highlighting which structure leaves Mark with the most.
- **Final totals per scenario**: revenue, and both parties' take-home (before expenses).
- Saves your scenarios in the browser (localStorage).

## The math

Brackets are **marginal** — each tier's percentage applies only to the revenue that
falls *inside* that tier (just like income-tax brackets).

| Monthly Revenue | SD % |
| --------------- | ---- |
| $0 – $3,500      | 0%   |
| $3,500 – $6,500  | 10%  |
| $6,500 – $9,000  | 15%  |
| $9,000 – $12,000 | 19%  |
| $12,000 – $14,500| 21%  |
| $14,500+         | 25%  |

### Payout examples

| Mark's Revenue | SD Gets | Mark Keeps |
| -------------- | ------- | ---------- |
| $3,500   | $0     | $3,500  |
| $5,000   | $150   | $4,850  |
| $6,500   | $300   | $6,200  |
| $8,000   | $525   | $7,475  |
| $10,000  | $865   | $9,135  |
| $12,000  | $1,245 | $10,755 |
| $14,500  | $1,770 | $12,730 |
| $15,000  | $1,895 | $13,105 |

## Running it

It's a static site — no build step. Open `index.html` in any browser, or serve the
folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

- `index.html` — markup
- `styles.css` — styling
- `app.js` — calculator logic
