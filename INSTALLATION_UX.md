# BSMS Installation & First-Run UX

The showroom owner is the installer, and is explicitly non-technical (per user direction, 2026-09-12). Everything below constrains the build so that's actually true, not just "it's an Electron app so it's fine."

## 1. The installer itself
- Standard platform installer: `.exe` (Windows, via electron-builder NSIS target) or `.dmg` (Mac) — double-click, click Next/Install, done. No terminal, no `npm install`, no separate Node/Postgres/Docker install step.
- **Code-signed.** An unsigned installer triggers scary OS warnings ("Windows protected your PC" / "unidentified developer") that will make a non-technical owner assume it's malware and abandon the install. Code signing certificates cost money and need to be budgeted for before ship — flagging this as a real line item, not a nice-to-have.
- **Auto-update built in** (`electron-updater`). The owner should never need to manually download and reinstall a new version — the app checks for updates and applies them with a simple "Restart to update" prompt, same pattern as Slack/Chrome.
- Confirm target OS(es) before build tooling is finalized (per `TECH_STACK.md`'s existing open item) — a non-technical user also can't be expected to know which installer variant they need if we ship both without asking.

## 2. First-run setup wizard (plan §3, reframed for non-technical users)
The original plan's field list (GSTIN, PAN, state, invoice prefix, default GST rate, etc.) is correct — the *presentation* needs work for someone who may not confidently know what a few of these terms mean:
- **Plain-language labels + inline help**, not raw tax jargon as the only text: e.g. "GST Number (GSTIN)" with a small "What's this?" tooltip/link, not just a bare "GSTIN" field.
- **GST rate is a preset picker, not a blank field.** Per your direction, the wizard doesn't ask for one hardcoded default rate — it seeds the standard Indian GST slabs (0%, 0.25%, 3%, 5%, 12%, 18%, 28%) with the two-wheeler-relevant one pre-selected, and the Owner/inventory-manager can add custom slabs later from Settings. See `DATABASE_SCHEMA.md`'s `GstSlab` model.
- **Progress indicator** (Step 1 of 4, etc.) so it doesn't feel like an open-ended form.
- **Nothing silently blocking progress** — if the owner doesn't have their GSTIN handy on day one, let them skip and finish later from Settings rather than being stuck unable to use the app at all (invoicing without GST detail simply isn't allowed until it's filled in, which the UI should say plainly).
- Owner's own login credentials are created as the last wizard step, framed as "Create your admin login" — not exposed as a technical "create first User row" concept.

## 3. Database — SQLite must be invisible by default
Per `TECH_STACK.md`'s configurable-database decision: the non-technical default path **never mentions SQLite, PostgreSQL, or "database" at all.** The app just works out of the box.
- `settings/database` (from `WEB_APP_PLAN.md`) lives under an **"Advanced"** section, off by default, not in the main Settings nav — surfaced only if the owner (or whoever eventually helps them scale up) goes looking for it.
- If they do open it, the copy needs to explain the tradeoff in plain terms ("switching requires installing a separate database program and will need help from someone technical") rather than assuming they know what an external Postgres connection string is.

## 4. Backup setup (Google Drive)
- **"Connect Google Drive" button using OAuth sign-in**, not a manual API-credentials/JSON-key upload flow. The owner clicks a button, signs into their Google account in a popup, grants access, done — this is the only backup setup step they should ever see.
- Show backup status in plain terms somewhere visible (e.g. "Last backed up: today at 2:00 AM" on the dashboard or settings), so a failure is noticeable without needing to check logs.
- If a backup fails (e.g. Drive quota, revoked access), surface a clear, actionable in-app notification — not a silent failure a technical audit would be needed to catch later.

## 5. Failure recovery, without a terminal
A non-technical owner can't run a recovery script by hand. Build these as in-app, clickable flows:
- **"Restore from backup"** — pulls the most recent Google Drive backup and restores it, from inside the app (e.g. accessible even from a fresh install if they need to move to a new machine).
- **Clear error states** anywhere something could fail (backup, first-run setup, GST calc on missing showroom state) — plain language, a next action, never a raw stack trace or "Error: ECONNREFUSED" surfaced to this user.

## 6. Uninstall
Standard OS uninstaller removes the app. Since local data (the SQLite file, uploaded files) lives outside the app bundle, decide and clearly communicate at uninstall time whether local data is kept or removed — don't silently delete a showroom's live business data on uninstall.

## Support
You (the user) are the support contact for the owner post-launch — no separate support infrastructure needed at this stage. Worth revisiting only if this scales beyond one showroom you're personally supporting.
