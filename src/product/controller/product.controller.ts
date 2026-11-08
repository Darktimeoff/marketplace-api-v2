import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';
import { CheckAbility } from '../../generic/auth/decorator/check-ability.decorator.js';
import { Identity } from '../../generic/auth/decorator/identity.decorator.js';
import { Public } from '../../generic/auth/decorator/public.decorator.js';
import type { ProductResponseInterface } from '@marketplace/contracts-core';
import { ProductCreateCommandHandler } from '../command-handler/product-create.command-handler.js';
import { ProductCreateInput } from '../input/product-create.input.js';
import { ProductDto } from '../dto/product.dto.js';
import { ProductService } from '../service/product.service.js';

@Controller('product')
export class ProductController {
  constructor(
    private readonly productCreate: ProductCreateCommandHandler,
    private readonly productService: ProductService,
  ) {}

  @ResponseDto(ProductDto)
  @CheckAbility('create', 'Product')
  @Post()
  create(@Body() input: ProductCreateInput, @Identity('identityPublicId') identityPublicId: string): Promise<ProductResponseInterface> {
    return this.productCreate.execute(input, identityPublicId);
  }

  @ResponseDto(ProductDto)
  @Public()
  @Get(':publicId')
  findOne(@Param('publicId', ParseUUIDPipe) publicId: string): Promise<ProductResponseInterface> {
    return this.productService.findByPublicId(publicId);
  }
}
