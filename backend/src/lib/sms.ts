import logger from "./logger";

/**
 * SmsProvider abstraction.
 *
 * Localhost / school demo uses {@link ConsoleSmsProvider} which prints the
 * code to the backend terminal. Production swaps in a Twilio / Vonage / etc.
 * implementation that actually delivers SMS. The rest of the app only ever
 * talks to this interface, so the swap is a one-file change.
 */
export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
  /** Human-readable name surfaced in /api/profile-changes responses. */
  readonly name: string;
}

class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(to: string, message: string): Promise<void> {
    // Big banner so it's impossible to miss in `npm run dev` output.
    logger.info(
      `\n` +
      `┌─────────────────────────────────────────────────────────┐\n` +
      `│  📱 [MOCK SMS]                                           │\n` +
      `│  To:      ${to.padEnd(45)} │\n` +
      `│  Message: ${message.padEnd(45)} │\n` +
      `└─────────────────────────────────────────────────────────┘\n`
    );
  }
}

let provider: SmsProvider = new ConsoleSmsProvider();

export function getSmsProvider(): SmsProvider {
  return provider;
}

/** Test hook — lets unit tests inject a mock. */
export function setSmsProvider(p: SmsProvider): void {
  provider = p;
}
