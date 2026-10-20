import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { LanguageEnum } from '@marketplace/contracts-core';
import { AppModule } from '../../src/app.module.js';
import { Product } from '../../src/product/entity/product.entity.js';
import { ProductTranslation } from '../../src/product/entity/product-translation.entity.js';
import { RoleEnum } from '../../src/identity/enum/role.enum.js';
import { aBrandWithTranslation, aCategoryWithTranslation } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';

describe('Product (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function tokenFor(role: RoleEnum): Promise<string> {
    const email = `${role}-${Date.now()}-${Math.random()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'correct-horse' }).expect(201);
    await dataSource.query(`UPDATE "Identity" SET "role" = $1 WHERE "email" = $2`, [role, email]);
    return (await request(app.getHttpServer()).post('/auth/login').send({ login: email, password: 'correct-horse' }).expect(200)).body.accessToken;
  }

  async function aBody() {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const category = await aCategoryWithTranslation(dataSource.manager, { slug: `kitchen-${suffix}`, name: 'Kitchen' });
    const brand = await aBrandWithTranslation(dataSource.manager, { slug: `acme-${suffix}`, name: 'Acme' });
    return { categoryId: category.id, brandId: brand.id, translations: [{ language: LanguageEnum.en, title: 'Kettle' }, { language: LanguageEnum.ua, title: 'Чайник', description: 'Електричний' }] };
  }

  function create(body: object, token?: string) {
    const post = request(app.getHttpServer()).post('/product');
    return (token ? post.set('Authorization', `Bearer ${token}`) : post).send(body);
  }

  it('answers 401 without a token', async () => {
    const response = await create(await aBody()).expect(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it('answers 403 to a buyer with a valid token', async () => {
    const response = await create(await aBody(), await tokenFor(RoleEnum.user)).expect(403);

    expect(response.headers['www-authenticate']).toBe('Bearer error="insufficient_scope"');
    expect(await dataSource.getRepository(Product).count()).toBe(0);
  });

  it('creates the product with its translations for a seller', async () => {
    const body = await aBody();

    const response = await create(body, await tokenFor(RoleEnum.seller)).expect(201);

    expect(response.body).toMatchObject({ publicId: expect.any(String), categoryId: body.categoryId, brandId: body.brandId });
    const [product] = await dataSource.getRepository(Product).find({ relations: { translations: true } });
    expect(product.translations.map(({ language, title }) => ({ language, title })).toSorted((a, b) => a.language.localeCompare(b.language))).toEqual([
      { language: LanguageEnum.en, title: 'Kettle' },
      { language: LanguageEnum.ua, title: 'Чайник' },
    ]);
  });

  it('lets an admin create products', async () => {
    await create(await aBody(), await tokenFor(RoleEnum.admin)).expect(201);
  });

  it('rejects a token whose payload was changed to admin with 401', async () => {
    const [header, payload, signature] = (await tokenFor(RoleEnum.user)).split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const tampered = [header, Buffer.from(JSON.stringify({ ...claims, role: 'admin' })).toString('base64url'), signature].join('.');

    const response = await create(await aBody(), tampered).expect(401);
    expect(response.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
  });

  it('answers 404 for an unknown category and leaves nothing behind', async () => {
    const body = await aBody();

    await create({ ...body, categoryId: 999999 }, await tokenFor(RoleEnum.seller)).expect(404);

    expect(await dataSource.getRepository(Product).count()).toBe(0);
    expect(await dataSource.getRepository(ProductTranslation).count()).toBe(0);
  });

  it.each([
    ['no translations', (body: Awaited<ReturnType<typeof aBody>>) => ({ ...body, translations: [] })],
    ['the same language twice', (body: Awaited<ReturnType<typeof aBody>>) => ({ ...body, translations: [{ language: LanguageEnum.en, title: 'A' }, { language: LanguageEnum.en, title: 'B' }] })],
    ['a blank title', (body: Awaited<ReturnType<typeof aBody>>) => ({ ...body, translations: [{ language: LanguageEnum.en, title: '   ' }] })],
  ])('rejects %s with 400', async (_, mutate) => {
    await create(mutate(await aBody()), await tokenFor(RoleEnum.seller)).expect(400);
  });
});
