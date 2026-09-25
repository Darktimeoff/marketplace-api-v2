import { NotFoundException } from '@nestjs/common';

export class ProductNotFoundException extends NotFoundException {
  constructor(id: number) {
    super(`Product with id ${id} not found`);
  }
}
