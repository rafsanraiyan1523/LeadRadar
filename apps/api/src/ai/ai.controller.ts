import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrgGuard } from '../common/guards/org.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import type {
  ActiveMembership,
  AuthenticatedUser,
} from '../common/types/express';
import { AiService } from './ai.service';
import { GenerateOutreachDto } from './dto/generate-outreach.dto';
import { GenerateFollowUpDto } from './dto/generate-follow-up.dto';
import { UpdateOutreachMessageDto } from './dto/update-outreach-message.dto';

// AI generation calls a real external/local model — throttled tightly so a
// misbehaving client can't run up AI spend. See AI COST CONTROL.
const AI_GENERATE_THROTTLE = {
  default: { limit: process.env.NODE_ENV === 'test' ? 1000 : 15, ttl: 60_000 },
};

@UseGuards(OrgGuard)
@ApiTags('AI & Outreach')
@Controller('leads')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get(':id/insight')
  async getInsight(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    // Wrapped (not returned bare) because Nest/Express treats a literal
    // `null` controller return value as "no body" rather than serializing
    // JSON null, which is indistinguishable from an empty response
    // client-side.
    const insight = await this.ai.getInsight(membership.organizationId, id);
    return { insight };
  }

  @Throttle(AI_GENERATE_THROTTLE)
  @Post(':id/insight/generate')
  async generateInsight(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.ai.generateInsight(membership.organizationId, user.id, id);
  }

  @Get(':id/outreach')
  async listOutreach(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.ai.listOutreach(membership.organizationId, id);
  }

  @Throttle(AI_GENERATE_THROTTLE)
  @Post(':id/outreach/generate')
  async generateOutreach(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: GenerateOutreachDto,
  ) {
    return this.ai.generateOutreach(
      membership.organizationId,
      user.id,
      id,
      dto,
    );
  }

  @Throttle(AI_GENERATE_THROTTLE)
  @Post(':id/outreach/follow-up')
  async generateFollowUp(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: GenerateFollowUpDto,
  ) {
    return this.ai.generateFollowUp(
      membership.organizationId,
      user.id,
      id,
      dto,
    );
  }

  @Patch(':id/outreach/:messageId')
  async updateOutreachMessage(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateOutreachMessageDto,
  ) {
    return this.ai.updateOutreachMessage(
      membership.organizationId,
      id,
      messageId,
      dto,
    );
  }
}
