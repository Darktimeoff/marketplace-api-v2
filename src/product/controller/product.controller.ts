import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseFilters,
} from '@nestjs/common';
import { ProductService } from '../service/product.service.js';
import { ProblemJsonFilter } from '../filter/problem-json.filter.js';
import type { ProductDetailResultInterface } from '../interface/product-detail.interface.js';

@Controller('product')
@UseFilters(ProblemJsonFilter)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ data: ProductDetailResultInterface; error: null }> {
    const data = await this.productService.getDetailById(id);

    return { data, error: null };
  }
}
