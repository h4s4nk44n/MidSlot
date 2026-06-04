import logger from "./logger";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Env-controlled email adapter.
 *
 * EMAIL_PROVIDER selects the transport:
 *   - "console" (default) — logs the email; used in dev and tests so nothing
 *     ever hits a real provider.
 *   - "resend" — delivers via the Resend HTTP API (requires RESEND_API_KEY and
 *     EMAIL_FROM). Falls back to console if either is missing.
 *   - "smtp" — delivers via any SMTP server (Gmail, Brevo, Outlook, …). Unlike
 *     the Resend sandbox this sends to ANY recipient. Requires SMTP_HOST,
 *     SMTP_USER and SMTP_PASS (EMAIL_FROM optional — defaults to SMTP_USER).
 *     Falls back to console if a required var is missing.
 *
 * The rest of the app only talks to {@link EmailProvider}, so swapping
 * transports is a config change, and tests inject a fake via
 * {@link setEmailProvider}.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
  /** Transport name, surfaced in logs. */
  readonly name: string;
}

/** Dev/test default — logs instead of delivering. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject },
      "[email:console] email not delivered (console transport)",
    );
  }
}

/** Production transport — Resend HTTP API. No SDK dependency; uses global fetch. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }
  }
}

export interface SmtpOptions {
  host: string;
  port: number;
  /** true for implicit TLS (port 465), false for STARTTLS (port 587). */
  secure: boolean;
  user: string;
  pass: string;
}

/**
 * Generic SMTP transport — works with Gmail, Brevo, Outlook, or any SMTP host,
 * and delivers to ANY recipient (no domain/sandbox restriction).
 *
 * Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=<you>@gmail.com,
 * SMTP_PASS=<16-char App Password> (NOT your normal password; requires 2-Step
 * Verification on the Google account).
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private readonly transporter: Transporter;

  constructor(
    private readonly from: string,
    opts: SmtpOptions,
  ) {
    this.transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: { user: opts.user, pass: opts.pass },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

/** Build the provider from the current environment. Exported for unit tests. */
export function resolveEmailProvider(): EmailProvider {
  const kind = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  if (kind === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      logger.warn(
        "[email] EMAIL_PROVIDER=resend but RESEND_API_KEY/EMAIL_FROM is missing; using console transport",
      );
      return new ConsoleEmailProvider();
    }
    return new ResendEmailProvider(apiKey, from);
  }
  if (kind === "smtp") {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    // Gmail rewrites From to the authenticated user anyway, so EMAIL_FROM is
    // optional here — fall back to the login address.
    const from = process.env.EMAIL_FROM || user;
    if (!host || !user || !pass || !from) {
      logger.warn(
        "[email] EMAIL_PROVIDER=smtp but SMTP_HOST/SMTP_USER/SMTP_PASS is missing; using console transport",
      );
      return new ConsoleEmailProvider();
    }
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    // Port 465 = implicit TLS, 587 = STARTTLS. SMTP_SECURE overrides the guess.
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
    return new SmtpEmailProvider(from, { host, port, secure, user, pass });
  }
  return new ConsoleEmailProvider();
}

let provider: EmailProvider = resolveEmailProvider();

export function getEmailProvider(): EmailProvider {
  return provider;
}

/** Test hook — inject a fake (e.g. a capturing provider) and restore after. */
export function setEmailProvider(p: EmailProvider): void {
  provider = p;
}
