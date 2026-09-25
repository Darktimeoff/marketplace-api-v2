import { Module, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EnvironmentModule } from './generic/environment/environment.module.js';
import { DBModule } from './generic/db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { OrderModule } from './order/order.module.js';
import { ProductModule } from './product/product.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { UserModule } from './user/user.module.js';
import { BrandModule } from './brand/brand.module.js';
import { CategoryModule } from './category/category.module.js';
import { SellerModule } from './seller/seller.module.js';
import { ProductVariantModule } from './product-variant/product-variant.module.js';
import { ValidationResponseInterceptor } from './generic/validation/validation-response.interceptor.js';

@Module({
  imports: [
    EnvironmentModule,
    DBModule,
    HealthModule,
    OrderModule,
    ProductModule,
    IdentityModule,
    UserModule,
    BrandModule,
    CategoryModule,
    SellerModule,
    ProductVariantModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () => new ValidationPipe({ transform: true, whitelist: true }),
    },
    { provide: APP_INTERCEPTOR, useClass: ValidationResponseInterceptor },
  ],
})
export class AppModule {}
