const nodemailer = require("nodemailer");

/**
 * Vercel serverless function — receives loan enquiry / callback / application
 * form submissions from the Vintage Finance landing pages and emails them.
 *
 * Request body:
 *   {
 *     "form": "Loan enquiry",                 // which form was used
 *     "page": "/personal-loan-in-delhi.html", // page it was submitted from
 *     "fields": [["Full name", "..."], ["Mobile number", "9999999999"], ...]
 *   }
 * Every lead must include a valid "Mobile number" field.
 *
 * Uses the same SMTP variables as send-complaint.js, plus:
 *   LEADS_MAIL_TO    (optional) where leads are delivered; defaults to MAIL_TO
 *   LEADS_MAIL_CC    (optional) CC for leads; defaults to MAIL_CC
 *   ALLOWED_ORIGINS  (optional) comma-separated website origins for CORS, e.g.
 *                    "https://www.vintagefinance.in,https://vintage-fin--staging-xxxx.web.app";
 *                    falls back to ALLOWED_ORIGIN, then "*"
 */

const MAX_FIELDS = 20;
const MAX_LABEL = 60;
const MAX_VALUE = 1000;

function corsOrigin(req) {
  const configured = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "*";
  if (configured === "*") return "*";
  const allowed = configured.split(",").map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.origin;
  return allowed.includes(origin) ? origin : allowed[0];
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin(req));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const form = (body.form || "Loan enquiry").toString().trim().slice(0, MAX_LABEL);
    const page = (body.page || "").toString().trim().slice(0, 200);
    const fields = Array.isArray(body.fields) ? body.fields : [];

    if (!fields.length || fields.length > MAX_FIELDS) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all required fields." });
    }
    const rows = [];
    for (const field of fields) {
      if (!Array.isArray(field) || field.length !== 2) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid form data." });
      }
      const label = String(field[0]).trim().slice(0, MAX_LABEL);
      const value = String(field[1] == null ? "" : field[1]).trim().slice(0, MAX_VALUE);
      if (label) rows.push([label, value]);
    }

    const valueOf = (label) => (rows.find(([l]) => l === label) || [])[1] || "";
    const mobile = valueOf("Mobile number");
    if (!/^[6-9][0-9]{9}$/.test(mobile)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mobile number." });
    }
    const email = valueOf("Email address");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email address." });
    }
    const name = valueOf("Full name");

    const mailTo = process.env.LEADS_MAIL_TO || process.env.MAIL_TO;
    const mailCc = process.env.LEADS_MAIL_CC || process.env.MAIL_CC;
    if (!mailTo) {
      console.error("LEADS_MAIL_TO / MAIL_TO env variable is not set");
      return res
        .status(500)
        .json({ success: false, message: "Server email is not configured." });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const esc = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const pageUrl = page ? `https://www.vintagefinance.in${page}` : "";
    const allRows = [["Form", form], ...(pageUrl ? [["Page", pageUrl]] : []), ...rows];

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0b1642; max-width: 600px;">
        <h2 style="margin:0 0 16px;">New ${esc(form)}</h2>
        <p style="margin:0 0 16px; color:#555;">
          A new enquiry has been submitted through the Vintage Finance website.
        </p>
        <table style="border-collapse: collapse; width: 100%;">
          ${allRows
            .map(
              ([label, value]) => `
          <tr>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; font-weight:bold; width:200px; vertical-align:top;">${esc(label)}</td>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; white-space:pre-wrap;">${esc(value) || "-"}</td>
          </tr>`
            )
            .join("")}
        </table>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: mailTo,
      ...(mailCc ? { cc: mailCc } : {}),
      ...(email ? { replyTo: email } : {}),
      subject: `New ${form}: ${name || mobile}${page ? ` — ${page}` : ""}`,
      html,
      text:
        `New ${form}\n\n` +
        allRows.map(([label, value]) => `${label}: ${value || "-"}`).join("\n") +
        "\n",
    });

    return res
      .status(200)
      .json({ success: true, message: "Enquiry submitted successfully." });
  } catch (err) {
    console.error("send-lead error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to submit your enquiry. Please try again later.",
    });
  }
};
