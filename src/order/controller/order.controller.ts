import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { OrderService } from '../service/order.service.js';
import { OrderPlaceCommandHandler } from '../command-handler/order-place.command-handler.js';
import { OrderCreateInput } from '../input/order-create.input.js';
import { OrderDto } from '../dto/order.dto.js';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';
import { IdempotencyKey } from '../decorator/idempotency-key.decorator.js';
import { CheckAbility } from '../../generic/auth/decorator/check-ability.decorator.js';
import { CurrentAbility } from '../../generic/auth/decorator/current-ability.decorator.js';
import { Identity } from '../../generic/auth/decorator/identity.decorator.js';
import type { AppAbilityType } from '../../generic/auth/app-ability.type.js';

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderPlace: OrderPlaceCommandHandler,
  ) {}

  @ResponseDto(OrderDto)
  @HttpCode(HttpStatus.ACCEPTED)
  @CheckAbility('create', 'Order')
  @Post()
  create(
    @Body() input: OrderCreateInput,
    @Identity('identityPublicId') identityPublicId: string,
    @IdempotencyKey(new ParseUUIDPipe({ optional: true })) idempotencyKey?: string,
  ): Promise<OrderDto> {
    return this.orderPlace.execute(input, identityPublicId, idempotencyKey ?? null);
  }

  @ResponseDto(OrderDto)
  @CheckAbility('read', 'Order')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentAbility() ability: AppAbilityType): Promise<OrderDto> {
    return this.orderService.findReadableById(id, ability);
  }
}
