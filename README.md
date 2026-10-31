# Vintage Finance — Complaint Form Backend

A small [Vercel serverless](https://vercel.com/docs/functions) API that receives
submissions from the **Complaints & Grievance Redressal** form on the Vintage
Finance website and emails them (via **Nodemailer**) to the grievance inbox.

## Endpoint

```
POST /api/send-complaint
Content-Type: application/json

{
  "fullName": "...",
  "mobile": "9999999999",
  "email": "user@example.com",
  "loanNumber": "optional",
  "category": "EMI Related",
  "description": "..."
}
```

Response: `{ "success": true, "message": "..." }`

```
POST /api/send-lead
Content-Type: application/json

{
  "form": "Loan enquiry",
  "page": "/personal-loan-in-delhi.html",
  "fields": [["Full name", "..."], ["Mobile number", "9999999999"], ["Email address", "optional"]]
}
```

Emails a loan enquiry, callback request or application from the city landing
pages. `fields` is a list of `[label, value]` pairs shown in the email; a valid
`Mobile number` is required. Same response format as above.

## 1. Install

```bash
cd vintage-backend
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | `587` (TLS) or `465` (SSL) |
| `SMTP_USER` | Sending mailbox / SMTP username |
| `SMTP_PASS` | SMTP password / app password |
| `MAIL_FROM` | (optional) From address; defaults to `SMTP_USER` |
| `MAIL_TO` | Where complaints are delivered (e.g. `support@vintagefinance.in`). Several addresses: comma-separated |
| `MAIL_CC` | (optional) CC for complaints, comma-separated |
| `LEADS_MAIL_TO` | (optional) Where loan enquiries from `/api/send-lead` are delivered; defaults to `MAIL_TO` |
| `LEADS_MAIL_CC` | (optional) CC for loan enquiries; defaults to `MAIL_CC` |
| `ALLOWED_ORIGIN` | Your website origin for CORS (e.g. `https://www.vintagefinance.in`). `*` for testing only. |
| `ALLOWED_ORIGINS` | (optional, `/api/send-lead` only) Comma-separated origins, e.g. the live site plus a Firebase staging URL; defaults to `ALLOWED_ORIGIN` |

### Gmail note
If you use a Gmail account, enable 2-Step Verification and create an
**App Password** (Google Account → Security → App passwords). Use that 16-char
password as `SMTP_PASS`. For the company domain mailbox
(`grievance@vintagefinance.in`), use the SMTP details from your email host.

## 3. Run locally (optional)

```bash
npm install -g vercel
vercel dev
# API available at http://localhost:3000/api/send-complaint
```

## 4. Deploy to Vercel

1. Push this folder to a Git repo (or run `vercel` from this folder).
2. In the Vercel dashboard → your project → **Settings → Environment Variables**,
   add every variable from the table above.
3. Deploy. Your endpoint will be:
   `https://<your-project>.vercel.app/api/send-complaint`

## 5. Connect the frontend

In the frontend project, set the API URL so the form posts to this endpoint.
Create a `.env` in the frontend root:

```
REACT_APP_COMPLAINT_API=https://<your-project>.vercel.app/api/send-complaint
```

Then rebuild the frontend (`yarn build`). The complaint form will send data to
this backend, which emails it to `MAIL_TO`.
