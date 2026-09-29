# Tanzeemo Tool

A simple savings-group finance tracker for four members. Record each member's
contributions, track monthly savings against targets, manage loans and
repayments, and distribute profit by editable shares.

**No build step, no dependencies, no server.** Just open the page — all data is
stored privately in your browser's localStorage.

## Features

- **Dashboard** — total savings pool, total loans outstanding, total profit,
  plus per-member cards (total contributed, loan balance, profit share).
- **Contributions** — record contributions (member, amount, date, note) and
  browse history with member/month filters.
- **Monthly** — set a monthly savings target per member, view each member's
  saved-vs-target progress for any month, and browse month-by-month records.
- **Loans** — record loans given to members, add repayments against each loan,
  see outstanding balances per loan and per member.
- **Profit** — record profit entries, set per-member allocation percentages
  (must total 100%), and see each member's profit share.
- **Settings** — change the currency label, edit member names, export all data
  as JSON, import a JSON backup, or reset everything.

Default members: Aqila, Nizar, Virgina, Illiana (editable in Settings).

## Run locally

Just open `index.html` in any modern browser — double-click it, or serve the
folder with any static server:

```bash
cd tanzeemotool
python3 -m http.server 8000
# then open http://localhost:8000
```

## Enable GitHub Pages

1. Push this folder's contents to a GitHub repository
   (e.g. `https://github.com/aqilashah955-cloud/tanzeemotool`).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the `main` branch and the `/ (root)` folder, then **Save**.
5. After a minute or two the site is live at
   `https://<username>.github.io/<repo>/`.

## Files

| File         | Purpose                                  |
|--------------|------------------------------------------|
| `index.html` | App structure (all six sections)         |
| `styles.css` | Styling, responsive layout               |
| `app.js`     | All logic; persists to localStorage      |
| `README.md`  | This file                                |

## Data & privacy

Everything is stored in the browser's `localStorage` under the key
`tanzemotool_v1` — nothing is sent anywhere. Use **Settings → Export data as
JSON** to back up, and **Import JSON** to restore on another device or browser.
