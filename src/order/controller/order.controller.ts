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
import { Public } from '../../generic/auth/decorator/public.decorator.js';

@Public()
@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderPlace: OrderPlaceCommandHandler,
  ) {}

  @ResponseDto(OrderDto)
  @HttpCode(HttpStatus.ACCEPTED)
  @Post()
  create(
    @Body() input: OrderCreateInput,
    @IdempotencyKey(new ParseUUIDPipe({ optional: true })) idempotencyKey?: string,
  ): Promise<OrderDto> {
    return this.orderPlace.execute(input, idempotencyKey ?? null);
  }

  @ResponseDto(OrderDto)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<OrderDto> {
    return this.orderService.findById(id);
  }
}
