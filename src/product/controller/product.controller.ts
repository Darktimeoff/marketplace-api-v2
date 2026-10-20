import { Body, Controller, Post } from '@nestjs/common';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';
import { CheckAbility } from '../../generic/auth/decorator/check-ability.decorator.js';
import { ProductCreateCommandHandler } from '../command-handler/product-create.command-handler.js';
import { ProductCreateInput } from '../input/product-create.input.js';
import { ProductDto } from '../dto/product.dto.js';

@Controller('product')
export class ProductController {
  constructor(private readonly productCreate: ProductCreateCommandHandler) {}

  @ResponseDto(ProductDto)
  @CheckAbility('create', 'Product')
  @Post()
  create(@Body() input: ProductCreateInput): Promise<ProductDto> {
    return this.productCreate.execute(input);
  }
}
