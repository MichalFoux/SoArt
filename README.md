# SoArt Movement

Static one-page/multi-section SoArt website with a registration form.

The frontend is served from plain HTML/CSS/JS:

- `index.html`
- `about.html`
- `approach.html`
- `styles.css`
- `script.js`
- `assets/`

The form in `index.html` posts to `POST /api/register`.

## Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables:

- `RESEND_API_KEY`: Resend API key for sending form emails.
- `FORM_TO_EMAIL`: destination email address for every registration.
- `FORM_FROM_EMAIL`: sender address. Use a verified Resend domain in production.
- `GITHUB_TOKEN`: fine-grained GitHub token with Contents read/write access to the private storage repo.
- `GITHUB_REPO`: private repo for saved registration JSON files, for example `MichalFoux/soart-registrations-private`.
- `GITHUB_STORAGE_BRANCH`: usually `main`.
- `GITHUB_STORAGE_PATH`: usually `registrations`.

Do not store registrations in the public website repository. They include personal contact details.
