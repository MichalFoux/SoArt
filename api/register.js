const REQUIRED_FIELDS = ["fullName", "email"];
const MAX_FIELD_LENGTH = 4000;

function clean(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, MAX_FIELD_LENGTH);
}

function normalize(body) {
  const payload = {};
  for (const [key, value] of Object.entries(body || {})) {
    payload[key] = clean(value);
  }
  return payload;
}

function validate(payload) {
  if (payload._honey) return "spam";

  const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);
  if (missing.length) return `Missing required fields: ${missing.join(", ")}`;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "Invalid email address";
  }

  return "";
}

function buildRegistration(payload, req) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: payload.createdAt || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    source: "soart-website",
    sourcePath: payload.sourcePath || "",
    language: payload.language || "en",
    fullName: payload.fullName,
    email: payload.email,
    country: payload.country || "",
    role: payload.role || "",
    message: payload.message || "",
    meta: {
      userAgent: req.headers["user-agent"] || "",
      referer: req.headers.referer || req.headers.referrer || "",
      ip: req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "",
    },
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailHtml(registration) {
  const rows = [
    ["Full name", registration.fullName],
    ["Email", registration.email],
    ["Country / City", registration.country],
    ["Role", registration.role],
    ["Language", registration.language],
    ["Message", registration.message],
    ["Submitted at", registration.createdAt],
    ["Source path", registration.sourcePath],
  ];

  const tableRows = rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(label)}</th><td dir="auto" style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#172022">
      <h2>New SoArt Movement registration</h2>
      <table style="border-collapse:collapse;width:100%;max-width:720px">${tableRows}</table>
    </div>
  `;
}

function emailText(registration) {
  return [
    "New SoArt Movement registration",
    "",
    `Full name: ${registration.fullName}`,
    `Email: ${registration.email}`,
    `Country / City: ${registration.country}`,
    `Role: ${registration.role}`,
    `Language: ${registration.language}`,
    "",
    "Message:",
    registration.message,
    "",
    `Submitted at: ${registration.createdAt}`,
    `Source path: ${registration.sourcePath}`,
  ].join("\n");
}

async function sendEmail(registration) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FORM_TO_EMAIL;
  const from = process.env.FORM_FROM_EMAIL || "SoArt <onboarding@resend.dev>";

  if (!apiKey || !to) {
    throw new Error("Email is not configured. Set RESEND_API_KEY and FORM_TO_EMAIL.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: to.split(",").map((email) => email.trim()).filter(Boolean),
      reply_to: registration.email,
      subject: `New SoArt registration: ${registration.fullName}`,
      html: emailHtml(registration),
      text: emailText(registration),
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || "Failed to send email");
  }

  return result;
}

async function saveRegistration(registration) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_STORAGE_BRANCH || "main";
  const basePath = (process.env.GITHUB_STORAGE_PATH || "registrations").replace(/^\/|\/$/g, "");

  if (!token || !repo) {
    throw new Error("Storage is not configured. Set GITHUB_TOKEN and GITHUB_REPO.");
  }

  const date = registration.receivedAt.slice(0, 10);
  const safeId = registration.id.replace(/[^a-zA-Z0-9-]/g, "");
  const path = `${basePath}/${date}/${safeId}.json`;
  const content = Buffer.from(JSON.stringify(registration, null, 2), "utf8").toString("base64");

  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "soart-website",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      message: `Store SoArt registration ${safeId}`,
      content,
      branch,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Failed to save registration");
  }

  return { path, commit: result.commit?.sha || "" };
}

module.exports = async function register(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const payload = normalize(req.body || {});
    const validationError = validate(payload);

    if (validationError === "spam") {
      return res.status(200).json({ ok: true });
    }

    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const registration = buildRegistration(payload, req);
    const storage = await saveRegistration(registration);
    const email = await sendEmail(registration);

    return res.status(200).json({
      ok: true,
      id: registration.id,
      storage,
      emailId: email.id || email.data?.id || "",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Registration failed",
    });
  }
};

module.exports.config = {
  maxDuration: 10,
};
