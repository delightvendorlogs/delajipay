# DelajiPay

DelajiPay is a mobile-first Nigerian digital payments website for:

- Airtime
- Mobile data
- Electricity bill payments
- Cable TV subscriptions (DStv, GOtv and StarTimes)

The first release intentionally focuses on these four services. Wallet funding is a supporting account feature, not a separate bill-payment category.

## Current status

- Live in code: auth, wallet ledger + Paystack funding, referrals, support chat, admin area
- VTpass purchase flow: `supabase/functions/vtpass-purchase` + `purchase.js` (airtime, data, electricity, cable TV)
- Orders list with status re-check: `orders.js` on the Transactions page
- Required Edge Function secrets: `VTPASS_API_KEY`, `VTPASS_SECRET_KEY`, `VTPASS_PUBLIC_KEY`, `VTPASS_BASE_URL`
  (sandbox: `https://sandbox.vtpass.com/api`, live: `https://vtpass.com/api`)
- Services stay disabled until switched on in the admin Services page

## Architecture

- Frontend: responsive, mobile-first website (static HTML, CSS and JavaScript)
- Backend: Supabase Auth, PostgreSQL and Edge Functions
- Payments: Paystack for wallet funding
- VTU/bill provider: VTpass for airtime, data, electricity and cable TV
- Hosting: static hosting (for example Cloudflare Pages)

## Important financial and security rules

- The database ledger is the source of truth for wallet balances; never trust a balance supplied by the browser.
- Verify payment gateway webhooks server-side before crediting a wallet.
- Make payment and provider requests idempotent to prevent duplicate credits or purchases.
- Handle pending, failed, unknown and reversed transactions safely.
- Never put Supabase service-role/secret keys or provider API secrets in frontend code.
- Enable Row Level Security on exposed tables and write policies for each access pattern.
- Keep an audit trail for administrative wallet adjustments.

## Before going live

1. Test every service in the VTpass sandbox, including a failed order and a pending order.
2. Switch `VTPASS_BASE_URL` to the live URL and add live keys as Edge Function secrets.
3. Activate each service in the admin Services page.
4. Confirm Terms, Privacy and refund wording match how the site works.

## Development notes

Do not commit secrets, .env files, service-role keys, payment gateway secrets or provider credentials. Use server-side environment secrets for Edge Functions.
