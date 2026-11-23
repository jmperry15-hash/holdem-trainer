# By the Book Hold'em

A trainer for **5-handed no-limit Texas Hold'em**. You play against four computer players. Blinds are 1/2, stacks start at 200, and the dealer button moves one seat clockwise every hand.

- **Learn mode** highlights the book play for every decision and explains why. Before the flop it shows the chart. After the flop it shows your exact equity and the pot odds.
- **Test mode** hides all help, grades every decision, and ends with a score and a review of each mistake.
- **Progress** tracks accuracy across sessions, by street and by position. Stats are saved on the device.

## The book

- **Preflop:** a simplified, standard-style chart for 5 players: open-raise or fold by position, then 3-bet, call or fold against one raise, and re-raise, call or fold against a re-raise. No proven optimal chart exists for this game, and the app says so.
- **Flop, turn and river:** your exact equity against one random hand, counted over every possible opponent hand and board. When nobody has bet, bet with 50% or more, otherwise check. Facing a bet, fold if your equity is below the pot odds, raise with 70% or more, otherwise call.
- **Computer players:** simple rule-based styles (tight, loose, aggressive, steady). They start every hand with 200 chips. You keep your own stack and rebuy 200 if you run out.

## Install it on your phone

Open the site link in your phone's browser, then:

- **iPhone (Safari):** tap the Share button → **Add to Home Screen** → Add.
- **Android (Chrome):** tap the ⋮ menu → **Add to Home screen** (or **Install app**).

It opens full screen like an app and works offline after the first visit.

## How the math is checked

`npm run verify` runs three checks:

- `scripts/verify-eval.ts` evaluates all 2,598,960 five-card hands and all 133,784,560 seven-card hands and checks each category count against the known totals.
- `scripts/verify-equity.ts` compares exact equity against 400,000 random samples, then checks side pots and a split pot with an odd chip.
- `scripts/simulate.ts` plays 100,000 hands with computer players in every seat. It checks that chips are conserved, the blinds and button are right, every hand finishes, and the book play is always a legal move.

## Development

```bash
npm install
npm run build:pages   # installable web app → site/
npm run build         # single-file Claude artifact → dist/
npm run icons         # re-render icons from web/icon.svg
npm run verify        # math and rules checks
```

Pushing to `main` deploys `site/` to GitHub Pages through `.github/workflows/pages.yml`.

Built with React, TypeScript and Tailwind CSS. No backend.
