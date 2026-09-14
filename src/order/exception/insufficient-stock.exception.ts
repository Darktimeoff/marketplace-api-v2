import { UnprocessableEntityException } from "@nestjs/common";
import { InsufficientStockProductInterface } from "../interface/insufficient-stock-product.interface.js";

export class InsufficientStockException extends UnprocessableEntityException {
  products: InsufficientStockProductInterface[] = []
  
  constructor(products: InsufficientStockProductInterface[]) {
    super()
    this.products = products;
  }
}