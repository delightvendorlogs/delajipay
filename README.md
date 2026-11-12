# DelajiPay

DelajiPay is a mobile-first Nigerian digital payments website for:

- Airtime
- Mobile data
- Electricity bill payments
- Cable TV subscriptions (DStv, GOtv and StarTimes)

The first release intentionally focuses on these four services. Wallet funding is a supporting account feature, not a separate bill-payment category.

## Planned customer features

- Sign up, sign in and account profile
- Wallet balance and secure wallet funding
- Airtime, data, electricity and cable-TV purchases
- Transaction history, statuses and receipts
- Notifications and customer support
- Referral programme

## Planned admin features

- Overview dashboard
- Customer management
- Wallet funding and adjustments with an audit trail
- Transactions and order status management
- Provider configuration and integration health
- Pricing, margins and service availability
- Referral settings, rewards and withdrawals
- Reports, notifications and support
- Admin roles and security

## Architecture

- Frontend: responsive, mobile-first website
- Backend: Supabase Auth, PostgreSQL and Edge Functions
- Payment gateway: to be selected for wallet funding
- VTU/bill provider: to be selected for airtime, data, electricity and cable TV
- Hosting: to be selected before deployment

## Important financial and security rules

- The database ledger is the source of truth for wallet balances; never trust a balance supplied by the browser.
- Verify payment gateway webhooks server-side before crediting a wallet.
- Make payment and provider requests idempotent to prevent duplicate credits or purchases.
- Handle pending, failed, unknown and reversed transactions safely.
- Never put Supabase service-role/secret keys or provider API secrets in frontend code.
- Enable Row Level Security on exposed tables and write policies for each access pattern.
- Keep an audit trail for administrative wallet adjustments.

## Build stages

1. Confirm the customer experience and create the responsive frontend foundation.
2. Design and secure the Supabase database schema.
3. Implement authentication and customer profiles.
4. Implement wallet ledger and funding verification.
5. Integrate one VTU/bill provider for the four launch services.
6. Build the admin dashboard and operational controls.
7. Test success, failure, timeout, duplicate-request and refund scenarios.
8. Deploy and complete launch checks.

## Development notes

Do not commit secrets, .env files, service-role keys, payment gateway secrets or provider credentials. Use server-side environment secrets for Edge Functions.
