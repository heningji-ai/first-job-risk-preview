# DEPLOYMENT_NOTES

## 1. Project stack

This project is a Vite + React + TypeScript front-end H5 single page application.

The current routes include:

- `/`
- `/test`
- `/result/:testSessionId`

## 2. Deployment platform

The first deployment target is Vercel.

## 3. SPA fallback

Because this project uses front-end routing, Vercel needs a rewrite rule so that deep links are served by the SPA entry page.

The root `vercel.json` rewrites all paths to `/`.

This prevents routes such as `/result/:testSessionId` from returning 404 when the user refreshes the page or opens the link directly.

## 4. Scope of this stage

This stage only adds deployment configuration and deployment notes.

This stage does not modify business logic.

This stage does not modify scoring logic.

This stage does not modify risk card trigger logic.

This stage does not modify any product configuration JSON.

This stage does not add backend, login, openid, payment, forms, database, AI generation, real music files, real image assets, or new dependencies.

## 5. Post-deployment acceptance checklist

After deployment, verify:

- Home page opens.
- The user can start the test.
- The user can complete the full quiz flow.
- The user can enter the result page.
- Refreshing `/result/:testSessionId` does not return 404.
- The site is accessible on mobile.
- The ordinary user page does not display A/B/C/D.
- The private traffic entry displays: `关注公众号后，回复【重估】获取添加方式`.
