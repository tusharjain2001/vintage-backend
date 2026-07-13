const nodemailer = require("nodemailer");

/**
 * Vercel serverless function — receives complaint form submissions
 * from the Vintage Finance frontend and emails them to the grievance inbox.
 *
 * Required environment variables (set them in the Vercel dashboard):
 *   SMTP_HOST       e.g. smtp.gmail.com
 *   SMTP_PORT       e.g. 587 (or 465 for SSL)
 *   SMTP_USER       the sending mailbox / SMTP username
 *   SMTP_PASS       the SMTP password / app password
 *   MAIL_TO         where complaints are delivered (e.g. grievance@vintagefinance.in)
 *   MAIL_FROM       (optional) from address; defaults to SMTP_USER
 *   ALLOWED_ORIGIN  (optional) your website origin for CORS; defaults to "*"
 */
module.exports = async (req, res) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
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

    const fullName = (body.fullName || "").toString().trim();
    const mobile = (body.mobile || "").toString().trim();
    const email = (body.email || "").toString().trim();
    const loanNumber = (body.loanNumber || "").toString().trim();
    const category = (body.category || "").toString().trim();
    const description = (body.description || "").toString().trim();

    // Basic server-side validation (mirrors the frontend rules)
    if (!fullName || !mobile || !email || !category || !description) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all required fields." });
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mobile number." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email address." });
    }

    const mailTo = process.env.MAIL_TO;
    if (!mailTo) {
      console.error("MAIL_TO env variable is not set");
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

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0b1642; max-width: 600px;">
        <h2 style="margin:0 0 16px;">New Complaint Submitted</h2>
        <p style="margin:0 0 16px; color:#555;">
          A new complaint has been registered through the Complaints &amp;
          Grievance Redressal page.
        </p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; font-weight:bold; width:200px;">Full Name</td>
            <td style="padding:8px 12px; border:1px solid #e6e8f0;">${esc(fullName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; font-weight:bold;">Mobile Number</td>
            <td style="padding:8px 12px; border:1px solid #e6e8f0;">${esc(mobile)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; font-weight:bold;">Email Address</td>
            <td style="padding:8px 12px; border:1px solid #e6e8f0;">${esc(email)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; font-weight:bold;">Loan / Application No.</td>
            <td style="padding:8px 12px; border:1px solid #e6e8f0;">${esc(loanNumber) || "-"}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; font-weight:bold;">Complaint Category</td>
            <td style="padding:8px 12px; border:1px solid #e6e8f0;">${esc(category)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; font-weight:bold; vertical-align:top;">Description</td>
            <td style="padding:8px 12px; border:1px solid #e6e8f0; white-space:pre-wrap;">${esc(description)}</td>
          </tr>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: mailTo,
      replyTo: email,
      subject: `New Complaint: ${category} — ${fullName}`,
      html,
      text:
        `New complaint submitted\n\n` +
        `Full Name: ${fullName}\n` +
        `Mobile: ${mobile}\n` +
        `Email: ${email}\n` +
        `Loan/Application No.: ${loanNumber || "-"}\n` +
        `Category: ${category}\n` +
        `Description: ${description}\n`,
    });

    return res
      .status(200)
      .json({ success: true, message: "Complaint submitted successfully." });
  } catch (err) {
    console.error("send-complaint error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to submit complaint. Please try again later.",
    });
  }
};
