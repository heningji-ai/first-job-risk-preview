# Project Status

## Current Stage

V1.3 mobile conversion flow refactor: referral coupon security, attribution, payment entry cleanup, and full report structure update.

## What Changed

- Added server-side referral coupon eligibility.
- Added referral visit attribution without exposing backend stats publicly.
- Updated free result page so the user first sees the basic judgement, then chooses either standard unlock or copy-invite discount.
- Kept `/goal-fit-share-preview` as a compatibility route that redirects back to the free result invite panel.
- Updated unlock page so pricing is based on server-side eligibility and backend `payAmountCents`.
- Prevented mobile external browsers from creating Native Pay QR orders.
- Converted full report from tab-like screens into a continuous professional report structure.

## Database Changes

Added:

- `goal_fit_referrals`
- `goal_fit_referral_visits`

Extended `orders` with:

- `sourceReferralCode`
- `referralVisitId`

## API Changes

Added:

- `POST /api/referrals/create`
- `POST /api/referrals/create-or-copy`
- `GET /api/referrals/discount-status`
- `POST /api/referrals/visit`
- `POST /api/referrals/start`
- `POST /api/referrals/complete`

Changed:

- `POST /api/orders/create` ignores frontend coupon pricing intent and checks server-side session discount eligibility.

## Coupon Rule

Frontend `accessMode`, `couponCode`, discount amount, or pay amount cannot decide the final price.

The server grants the `share_card` discount only after the current `sessionId` has a referral record with `discountGrantedAt` and no `discountUsedOrderId`.

## Attribution Rule

`ref` links are only attribution signals. A visitor entering from another user's link does not automatically receive a discount. The visitor must complete their own test and copy their own invite link to receive their own discount.

## Payment Behavior

- WeChat in-app browser: JSAPI payment.
- Desktop browser: Native Pay QR code.
- Mobile external browser: prompts the user to open in WeChat and copy the current page link; no Native QR order is created.

## Notes

- The old stash `wip-v1.1-result-page-old-model-before-v1.2` must remain untouched.
- No scoring algorithm, question bank, result generation logic, WeChat callback verification, or payment amount formula was intentionally changed.
- Referral attribution is approximate because no login, phone number, or openid is collected for general visitors.

## Pre-release Audit Notes

Audited areas:

- Referral link creation and copy-confirm discount grant order.
- Referral attribution continuity across landing, test start, test completion, OAuth/payment, and paid conversion.
- SQLite migration safety and idempotency.
- Duplicate referral/order creation and duplicate paid callback behavior.
- Legacy coupon parameter cleanup.
- Payment environment split for WeChat in-app, desktop browser, mobile external browser, and mock mode.

Fixes applied during audit:

- Added `PUBLIC_APP_URL` server config. Production share links default to `https://first-job-risk.jobeyes.com` and do not use request `Host`.
- Added `GOAL_FIT_DB_PATH` for explicit stats/test database selection.
- Wrapped referral creation, referral visit recording, and reusable order creation in `BEGIN IMMEDIATE` transactions.
- Confirm-copy flow now shows discount as active only after the frontend successfully copies the link, calls the server confirm endpoint, and re-reads server discount status.
- Confirm-copy failures keep the same referral link and show a retry path instead of showing "discount active".
- Paid full-price orders no longer consume an active referral discount; only paid discounted orders can set `discountUsedOrderId`.
- Frontend order creation no longer sends `accessMode` or `couponCode`.
- Referral tracking failures no longer block test start or result generation.
- Existing valid referral attribution is preserved when a later `ref` appears, and the later `ref` is removed from the URL.
- Added `test-referral-discount` and `test-referral-stats` scripts.

Operational requirements before production deploy:

- Set `PUBLIC_APP_URL` explicitly on the server, recommended value: `https://first-job-risk.jobeyes.com`.
- Use the production database path intentionally; `referral-stats` prints `databasePath` to reduce accidental empty-database reads.
- Back up SQLite before deployment. Example command on the server:
  `sqlite3 /path/to/orders.db ".backup '/path/to/orders-backup-$(date +%Y%m%d-%H%M%S).db'"`
- Complete manual mobile visual QA for `/goal-fit-preview`, `/test-goal-fit-preview`, `/result-goal-fit-free-preview`, invite modal, `/goal-fit-unlock-preview`, and `/result-goal-fit-preview`.
