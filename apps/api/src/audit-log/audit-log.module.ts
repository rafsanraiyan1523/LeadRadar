import { Global, Module } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

/**
 * Global like QueueModule/RedisModule — AuditLogService is a cross-cutting
 * utility injected from auth, organizations, and any future module that
 * performs a security-relevant action, not owned by one feature module.
 */
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
