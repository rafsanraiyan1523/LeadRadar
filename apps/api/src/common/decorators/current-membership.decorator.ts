import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ActiveMembership } from '../types/express';

export const CurrentMembership = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ActiveMembership => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.membership as ActiveMembership;
  },
);
