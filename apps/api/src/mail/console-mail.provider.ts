import { Injectable, Logger } from '@nestjs/common';
import type { MailMessage, MailProvider } from './mail-provider.interface';

/**
 * Zero-cost default mail provider: logs the message instead of sending it.
 * Lets the full auth flow (verification, password reset, invitations) run
 * end-to-end without an email account. Swap for a real provider (e.g. SES,
 * Postmark) behind the same MailProvider interface when one is available —
 * see docs/architecture.md#provider-abstractions.
 */
@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `To: ${message.to} | Subject: ${message.subject}\n${message.text}`,
    );
    await Promise.resolve();
  }
}
