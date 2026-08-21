import { Injectable } from '@nestjs/common';
import type {
  MailMessage,
  MailProvider,
} from '../../src/mail/mail-provider.interface';

/** Captures "sent" mail in memory so e2e tests can pull tokens out of links. */
@Injectable()
export class MemoryMailProvider implements MailProvider {
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    await Promise.resolve();
  }

  latestFor(to: string): MailMessage | undefined {
    return [...this.messages].reverse().find((m) => m.to === to);
  }

  extractToken(message: MailMessage): string {
    const match = /[?&]token=([a-f0-9]+)/i.exec(message.text);
    if (!match?.[1]) {
      throw new Error(`No token found in message: ${message.text}`);
    }
    return match[1];
  }

  clear(): void {
    this.messages.length = 0;
  }
}
