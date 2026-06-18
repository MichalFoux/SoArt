# Web3Forms Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `api/register.js` (GitHub + Resend) with a direct client-side Web3Forms submission, push to GitHub, and wire up automatic Vercel deployment on every push to `main`.

**Architecture:** The form POSTs FormData directly from the browser to `https://api.web3forms.com/submit`. No serverless function is involved for registration. `api/track.js` is untouched. Vercel is connected to `MichalFoux/SoArt` via the GitHub integration so that every push to `main` triggers a production deployment.

**Tech Stack:** Vanilla HTML/CSS/JS, Web3Forms API, Vercel CLI, GitHub

---

## File Map

| File | Action | What changes |
|---|---|---|
| `index.html` | Modify | Form action URL, hidden fields (access_key, subject, from_name, template, botcheck honeypot) |
| `script.js` | Modify | Submit handler: FormData → Web3Forms endpoint, check `data.success` |
| `api/register.js` | **Delete** | Replaced entirely by Web3Forms |
| `.env.example` | Modify | Remove old secrets, note no env vars needed |
| `api/track.js` | No change | — |

---

## Task 1 — Update `index.html` form fields

**Files:**
- Modify: `index.html` lines 193–202 (form tag + hidden fields)

- [ ] **Step 1: Replace form open tag and hidden fields**

Find this block (lines 193–202):
```html
<form
  class="signup-form"
  id="signupForm"
  action="/api/register"
  method="POST"
>
  <input type="hidden" name="_subject" value="New SoArt Movement registration">
  <input type="hidden" name="_template" value="table">
  <input type="hidden" name="_captcha" value="true">
  <input type="text" name="_honey" class="honeypot-field" tabindex="-1" autocomplete="off">
```

Replace with:
```html
<form
  class="signup-form"
  id="signupForm"
  action="https://api.web3forms.com/submit"
  method="POST"
>
  <input type="hidden" name="access_key" value="34aabf78-bfb6-4514-967c-9edcb7467ab9">
  <input type="hidden" name="subject" value="New SoArt Movement registration">
  <input type="hidden" name="from_name" value="SoArt Movement">
  <input type="hidden" name="template" value="table">
  <input type="checkbox" name="botcheck" class="honeypot-field" tabindex="-1" aria-hidden="true">
```

Key changes:
- `action` → Web3Forms submit URL (noscript fallback)
- `_subject` → `subject` (Web3Forms field name, no underscore)
- Remove `_template=table` → `template=table` (Web3Forms field name)
- Remove `_captcha` (not a Web3Forms field)
- `_honey` text input → `botcheck` checkbox (Web3Forms honeypot convention)
- Add `access_key` and `from_name` hidden fields

- [ ] **Step 2: Verify no other pages have the old fields**

Run:
```bash
grep -r "_subject\|/api/register\|_honey\|_captcha" /Users/navesarussi/SoArt --include="*.html"
```
Expected: no output (only `index.html` had these, and we just fixed it).

---

## Task 2 — Update `script.js` submit handler

**Files:**
- Modify: `script.js` lines 597–631

- [ ] **Step 1: Replace the submit handler block**

Find this block (lines 597–631):
```javascript
if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const registration = {
      createdAt: new Date().toISOString(),
      language: currentLanguage,
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      country: formData.get("country"),
      role: formData.get("role"),
      message: formData.get("message"),
      _honey: formData.get("_honey"),
      sourcePath: window.location.pathname
    };

    formNote.textContent = translations[currentLanguage].sending;

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registration)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Registration failed.");
      }
      form.reset();
      formNote.textContent = translations[currentLanguage].success;
    } catch (error) {
      formNote.textContent = translations[currentLanguage].submitError;
      console.error(error);
    }
  });
}
```

Replace with:
```javascript
if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    formData.append("language", currentLanguage);
    formData.append("source_path", window.location.pathname);

    formNote.textContent = translations[currentLanguage].sending;

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || "Submission failed");
      form.reset();
      formNote.textContent = translations[currentLanguage].success;
    } catch (error) {
      formNote.textContent = translations[currentLanguage].submitError;
      console.error(error);
    }
  });
}
```

Key changes:
- No custom JSON object — send `FormData` directly (form fields included automatically)
- Append `language` and `source_path` as extra fields (these aren't HTML inputs)
- `access_key` is already in the FormData via the hidden field — do NOT append again
- Endpoint: `https://api.web3forms.com/submit`
- Header: `Accept: application/json` (tells Web3Forms to return JSON; do NOT set `Content-Type` manually — FormData sets its own multipart boundary)
- Success check: `data.success` (not `result.ok`)

---

## Task 3 — Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Replace the entire file content**

Replace the entire content of `.env.example` with:
```
# No environment variables are required for the SoArt registration form.
# The form submits directly to Web3Forms (web3forms.com) from the browser.
# The Web3Forms access key is public and lives in index.html.
#
# api/track.js (page-view analytics) also has no external dependencies.
```

---

## Task 4 — Delete `api/register.js`

**Files:**
- Delete: `api/register.js`

- [ ] **Step 1: Delete the file**

```bash
rm /Users/navesarussi/SoArt/api/register.js
```

- [ ] **Step 2: Verify only `track.js` remains**

```bash
ls /Users/navesarussi/SoArt/api/
```
Expected output:
```
track.js
```

---

## Task 5 — Test locally

- [ ] **Step 1: Ensure a local server is running**

If `vercel dev` is already running on port 3000:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```
Expected: `200`

If not running, start it:
```bash
cd /Users/navesarussi/SoArt && npx vercel dev
```

- [ ] **Step 2: Open the form in a browser and submit a test registration**

Open `http://localhost:3000/#join` in a browser.

Fill in:
- Full name: `Test Submission`
- Email: a real address you can check (Web3Forms sends to your account email)
- Any other fields

Click **Register interest**.

Expected behaviour:
- The form note briefly shows the "sending" message (localized)
- Then shows the "success" message (e.g. "Thank you!" in current language)
- Form fields are cleared

- [ ] **Step 3: Verify submission in Web3Forms dashboard**

Open `https://app.web3forms.com/dashboard`.

Expected: a new submission row with all fields (fullName, email, country, role, message, language, source_path).

- [ ] **Step 4: Check notification email**

Check `michal.foux97@gmail.com` inbox.

Expected: an email with subject "New SoArt Movement registration" containing a table of all submitted fields.

- [ ] **Step 5: Verify spam filter (honeypot)**

In browser DevTools console, run:
```javascript
const fd = new FormData(document.querySelector('#signupForm'));
console.log([...fd.entries()].map(([k,v]) => k + '=' + v).join('\n'));
```
Expected: `botcheck=` (empty — the checkbox is unchecked, as expected for a real user).

---

## Task 6 — Commit and push to GitHub

- [ ] **Step 1: Stage all changes**

```bash
git -C /Users/navesarussi/SoArt add index.html script.js api/register.js .env.example
```

- [ ] **Step 2: Verify staged diff**

```bash
git -C /Users/navesarussi/SoArt diff --staged --stat
```
Expected:
```
 .env.example    | ...
 api/register.js | ...  (deleted)
 index.html      | ...
 script.js       | ...
```

Also confirm `styles.css` and `.gitignore` are staged (they have the responsive-fix changes from the earlier session):
```bash
git -C /Users/navesarussi/SoArt status --short
```
If `styles.css` and `.gitignore` show as `M ` (modified, unstaged), add them too:
```bash
git -C /Users/navesarussi/SoArt add styles.css .gitignore
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/navesarussi/SoArt commit -m "$(cat <<'EOF'
Switch registration form to Web3Forms

Replace api/register.js (GitHub+Resend backend) with a direct
client-side Web3Forms submission. Also includes responsive hero
title fix (overflow-wrap, clamp adjustments) from earlier session.

- index.html: Web3Forms hidden fields, botcheck honeypot
- script.js: FormData → web3forms.com/submit, check data.success
- api/register.js: deleted (Web3Forms replaces it)
- .env.example: updated (no secrets needed)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push to GitHub**

```bash
git -C /Users/navesarussi/SoArt push origin main
```

Expected: push succeeds, commits appear at `https://github.com/MichalFoux/SoArt`.

If push is rejected (not fast-forward):
```bash
git -C /Users/navesarussi/SoArt pull --rebase origin main
git -C /Users/navesarussi/SoArt push origin main
```

---

## Task 7 — Connect Vercel to GitHub for auto-deploy

This task requires browser interaction by the user. The Vercel project (`soart`) is not yet connected to GitHub, so pushes don't trigger deployments automatically.

- [ ] **Step 1: Open Vercel project Git settings**

Go to: `https://vercel.com/naves-projects-8f589287/soart/settings/git`

- [ ] **Step 2: Connect the GitHub repository**

Click **Connect Git Repository** → select **GitHub** → find and select `MichalFoux/SoArt`.

**If the repository does not appear:** The Vercel GitHub App needs access to `MichalFoux/SoArt`. MichalFoux must:
1. Go to `https://github.com/apps/vercel`
2. Click **Configure**
3. Under the `MichalFoux` account, grant access to the `SoArt` repository
4. Return to the Vercel settings page and retry

- [ ] **Step 3: Set the production branch**

In the Git settings, confirm **Production Branch** is set to `main`.

- [ ] **Step 4: Verify auto-deploy is working**

Make a trivial commit and push (e.g. add a blank line to `.env.example`):
```bash
echo "" >> /Users/navesarussi/SoArt/.env.example
git -C /Users/navesarussi/SoArt add .env.example
git -C /Users/navesarussi/SoArt commit -m "chore: trigger test deployment"
git -C /Users/navesarussi/SoArt push origin main
```

Then open `https://vercel.com/naves-projects-8f589287/soart` and watch for a new deployment to appear within ~30 seconds. When it finishes, revert the blank line if desired.

---

## Task 8 — Smoke-test the live site

- [ ] **Step 1: Wait for deployment to finish**

Watch `https://vercel.com/naves-projects-8f589287/soart` until the deployment status shows **Ready**.

- [ ] **Step 2: Submit a real test registration on the live site**

Open `https://soart-rust.vercel.app/#join`, fill the form, submit.

Expected:
- Success message shown in the browser
- Email arrives at `michal.foux97@gmail.com`
- Submission appears in `https://app.web3forms.com/dashboard`

- [ ] **Step 3: Check the responsive title fix is live too**

On a mobile browser (or DevTools at 375px), verify "SoArt Movement" wraps cleanly without mid-word break.
