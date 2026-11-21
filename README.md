# BJVERIFY SMS

BJVERIFY SMS is a virtual-number and incoming SMS platform. The former DelajiPay bill-payment product has been retired from this repository.

## Product scope

- Browse supported countries and services.
- Purchase supported virtual-number verifications.
- Receive and view incoming SMS in the customer inbox.
- Wallet funding, account activity, support and administration.
- No number rentals or recurring number subscriptions.

## Provider routing

- United States: Fetch SMS and TextVerified (the Test Verified Virtual SMS integration).
- Other supported countries: VirtualSMS (the Virtual Number provider), excluding the United States.
- The United States must also appear in the all-country search results and offer both USA provider routes.
- Only one-off verification products are in scope. Rental products and rental-duration choices must not be exposed.

## Current implementation status

- Public BJVERIFY SMS landing page and responsive brand identity.
- Rebranded login, signup and password recovery.
- BJVERIFY customer dashboard, number discovery interface and SMS inbox shell.
- Existing Supabase Auth, wallet ledger and Paystack funding foundation retained.
- Legacy bill-payment catalogue entries disabled and old retired purchase endpoint retired.
- Live country/service catalogues, price quotes, one-off number purchases, SMS status checks, inbox records and idempotent wallet refunds are implemented in BJVERIFY Supabase. Provider API credentials still need to be added to the BJVERIFY project before live supplier requests can succeed.

## Provider credentials

The previous Delight Vendor Logs Supabase project contains read-only reference implementations for VirtualSMS, Fetch SMS and TextVerified. Those implementations have not been modified.

BJVERIFY SMS will use its own provider credentials stored as Supabase Edge Function secrets:

- `VIRTUALSMS_API_KEY`
- `FETCHSMS_API_KEY`
- `TEXTVERIFIED_API_USERNAME`
- `TEXTVERIFIED_API_KEY`

Never commit provider secrets, service-role keys, or payment credentials to this repository or expose them in browser code.

## Security and financial rules

- Provider requests, pricing and wallet debits must be handled server-side.
- Use idempotency keys to prevent duplicate orders and duplicate wallet charges.
- Confirm provider order status before marking a purchase successful or showing an SMS code.
- Refund failed or expired purchases exactly once.
- Enforce Row Level Security so customers can only view their own orders and messages.
- Keep the existing wallet ledger as the source of truth; never trust a browser-supplied balance.
- Do not display mock stock, prices or sample SMS as live data.

## Hosting and architecture

- Frontend: responsive static HTML, CSS and JavaScript.
- Backend: Supabase Auth, PostgreSQL and Edge Functions.
- Wallet funding: existing Paystack integration.
- Hosting: the repository's existing deployment pipeline.
