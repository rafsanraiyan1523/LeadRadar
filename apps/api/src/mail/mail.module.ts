import { Global, Module } from '@nestjs/common';
import { ConsoleMailProvider } from './console-mail.provider';
import { MAIL_PROVIDER } from './mail-provider.interface';

@Global()
@Module({
  providers: [{ provide: MAIL_PROVIDER, useClass: ConsoleMailProvider }],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}
