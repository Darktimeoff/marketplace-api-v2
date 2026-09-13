import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EnvironmentModule, EnvironmentService } from "../environment/environment.module.js";
import { SecretManagerModule } from "../secret-manager/secret-manager.module.js";
import { SecretManagerService } from "../secret-manager/secret-manager.service.js";
import { entities as sharedEntities } from "../../entities/all.js";
import { Order } from "../../order/entity/order.entity.js";
import { OrderProduct } from "../../order/entity/order-product.entity.js";
import { OrderRecipient } from "../../order/entity/order-recipient.entity.js";

// Order/OrderProduct/OrderRecipient зарегистрированы отдельно от src/entities/all.ts —
// они живут в src/order/entity/ вместе с доменным модулем заказа. Но им всё равно
// нужно быть в этом же списке: Phone/DeliveryAddress/User/ProductOffer/BackgroundJob
// ссылаются на них строкой ('OrderRecipient', 'Order', ...), и без записи в общих
// метаданных TypeORM падает при старте с "Entity metadata for ... was not found" —
// OrderModule.forFeature() регистрирует репозитории поверх уже известного DataSource,
// а не добавляет entity в его метаданные задним числом.
const entities = [...sharedEntities, Order, OrderProduct, OrderRecipient];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [EnvironmentModule, SecretManagerModule],
      inject: [EnvironmentService, SecretManagerService],
      useFactory: async (environment: EnvironmentService, secrets: SecretManagerService) => ({
        type: "postgres",
        entities,
        synchronize: false,
        host: environment.get("DBHOST"),
        port: environment.get("DBPORT"),
        username: environment.get("DBUSER"),
        database: environment.get("DBNAME"),
        password: async () => await secrets.get("DBPASSWORD"),
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DBModule {}
