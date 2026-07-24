# NikyNapkins POS
A single-file, offline-friendly point-of-sale tool for running inventory at art markets. Upload a CSV of what you're bringing, ring up sales as they happen, and export an updated CSV when the market ends.

## Quick start
1. Open `nikynapkins-pos.html`.
2. Upload your inventory CSV.
3. (Optional) Name the event — it labels the receipt and the exported filename.
4. Tap items to add them to the cart, pick a payment method, hit **Complete sale**.
5. When the market wraps, hit **Lock in & export CSV** to download your end-of-day inventory.

## CSV format
The app auto-detects columns by header name, so exact naming isn't required. It looks for:

| Field | Header aliases it matches |
|---|---|
| Item name (required) | `item`, `name`, `product` |
| Price | `price`, `cost` |
| Stock / quantity | `qty`, `quantity`, `stock`, `inventory`, `count` |
| Category (optional) | `category`, `type`, `collection`, `tag` |

If price or stock columns aren't found, those fields default to `0`. If no category column exists, items are grouped under "Uncategorized" and the category filter row stays hidden until there's more than one category.

## Selling
- **Tap an item card** to add one to the cart. Cards gray out when you're out of stock.
- **Click a price** on any item card to edit it directly, no CSV re-upload needed.
- **Category pills** above the grid filter which items are shown (only appears once you have more than one category).
- **The receipt tape** on the right shows the current cart — use the +/– steppers to adjust quantities before checking out.
- **Payment method is required** to complete a sale: Zelle, Venmo, Cash, or Trade.
  - Trade still subtracts stock like a normal sale, but logs **$0 toward revenue**. The retail value of what was traded is tracked separately and shown in the sales log and the payment breakdown, so you can see what moved without it inflating your cash totals.
- **Add item** lets you add something to inventory mid-event that wasn't on the original CSV (e.g. you brought extra stock).

## Locking in
**Lock in & export CSV** downloads a new CSV (`{event}_inventory_locked_{timestamp}.csv`) with each item's name, category, price, and remaining stock — a clean snapshot of what's left. This does not clear your session; you can keep selling and export again later if you want a mid-event checkpoint.

## Sales log & payment breakdown
Every completed sale (and trade) is listed at the bottom with timestamp, item, quantity, payment method, and line total. Below it, a running breakdown per payment method shows total revenue and sale count — Trade's card shows count and total retail value instead of revenue, since trades don't bring in cash.

## Known limitations
- **No autosave.** Everything lives in the browser tab's memory. If you close or refresh the tab mid-event without exporting, that session's data is gone. Export periodically if you want a safety net, or just re-upload your last exported CSV to pick back up where you left off.
- **Single device.** There's no sync between devices — if you're running two registers, each needs its own upload/export cycle.
- **No receipts for customers.** This tracks your inventory and revenue; it doesn't generate a customer-facing receipt or invoice.

## Tech notes
- Single HTML file, vanilla JS, no build step.
- CSV parsing/export via [PapaParse](https://www.papaparse.com/) (loaded from CDN — needs an internet connection to load the page, but works offline once loaded).
- Fonts: Space Grotesk, DM Sans, IBM Plex Mono (Google Fonts, also CDN-loaded).
