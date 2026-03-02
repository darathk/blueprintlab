---
description: Initialize the athlete-analytics-tool project
---

This workflow prepares the environment, installs dependencies, sets up the database, and applies the custom theme.

1. Ensure environment variables are correctly set in `.env` (DATABASE_URL, etc.).
2. Install project dependencies.
// turbo
`npm install`
3. Generate Prisma client.
// turbo
`npx prisma generate`
4. Verify database connectivity.
// turbo
`node check-db.js`
5. Seed initial data (Athletes, Programs, Logs).
// turbo
`node seed.js`
6. Apply custom UI reskin and themes.
// turbo
`node apply_reskin.js`
// turbo
`node update_theme.js`
7. Verify successful setup.
`npm run dev` (run in background)
