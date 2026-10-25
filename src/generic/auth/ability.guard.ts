import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { AbilityFactory } from './ability.factory.js';
import { CHECK_ABILITY_METADATA, type AbilityRequirementInterface } from './decorator/check-ability.decorator.js';
import type { AuthenticatedRequestInterface } from './interface/authenticated-request.interface.js';

@Injectable()
export class AbilityGuard implements CanActivate {
  private readonly logger = new Logger(AbilityGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly abilities: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequestInterface & { method?: string; url?: string }>();

    if (request.identity) {
      request.ability = this.abilities.createFor(request.identity);
    }

    const required = this.reflector.getAllAndOverride<AbilityRequirementInterface | undefined>(CHECK_ABILITY_METADATA, [context.getHandler(), context.getClass()]);

    if (!required || request.ability?.can(required.action, required.subject)) {
      return true;
    }

    this.logger.warn(`forbidden ${request.method} ${request.url} identity=${request.identity?.identityPublicId} role=${request.identity?.role} cannot=${required.action} ${required.subject}`);
    context.switchToHttp().getResponse<Response>().setHeader?.('WWW-Authenticate', 'Bearer error="insufficient_scope"');
    throw new ForbiddenException('Insufficient permissions');
  }
}
