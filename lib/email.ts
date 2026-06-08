import nodemailer from 'nodemailer'

// Server-only email sender. Uses Gmail SMTP with an App Password for now;
// because it's fully env-driven, switching later to a domain sender
// (Google Workspace at orders@ezbookaparty.com, or another SMTP provider)
// is just a credential swap — no code change.
//
// Env:
//   GMAIL_USER          - the sending Gmail address
//   GMAIL_APP_PASSWORD  - 16-char Google App Password (2FA must be on)
//   MAIL_FROM_NAME      - optional display name (falls back to business name)

export function isEmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

function getTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendMail(opts: {
  to: string
  subject: string
  html: string
  text?: string
  cc?: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('Email not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing)')
  }
  const fromName =
    process.env.MAIL_FROM_NAME ||
    process.env.NEXT_PUBLIC_BUSINESS_NAME ||
    'Party Rentals'
  const transport = getTransport()
  await transport.sendMail({
    from: `"${fromName}" <${process.env.GMAIL_USER}>`,
    to: opts.to,
    cc: opts.cc || undefined,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  })
}
