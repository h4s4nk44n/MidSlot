import logger from "./logger";

/**
 * Env-controlled email adapter.
 *
 * EMAIL_PROVIDER selects the transport:
 *   - "console" (default) — logs the email; used in dev and tests so nothing
 *     ever hits a real provider.
 *   - "resend" — delivers via the Resend HTTP API (requires RESEND_API_KEY and
 *     EMAIL_FROM). Falls back to console if either is missing.
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
