import {
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  Identity,
  Product,
  ProductTranslation,
  User,
} from './index.js';

/**
 * Entities без выделенного доменного модуля: у них нет своего
 * TypeOrmModule.forFeature([...]) в каком-либо модуле, поэтому список
 * остаётся единым и подключается в TypeOrmModule.forRootAsync (AppModule)
 * и CLI-DataSource'ом для миграций (`src/data-source.ts`). Entity с owner-модулем
 * (Order, BackgroundJob, Phone, DeliveryAddress, ProductOffer, Transaction, ...)
 * сюда не входят — они регистрируются через forFeature в своих модулях и
 * подхватываются autoLoadEntities.
 */
export const entities = [
  Identity,
  User,
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  Product,
  ProductTranslation,
];
