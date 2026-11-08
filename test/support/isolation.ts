import type { DataSource } from 'typeorm';
import { Redis } from 'ioredis';

export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    DO $$
    DECLARE
      table_name text;
    BEGIN
      SET LOCAL session_replication_role = replica;
      FOR table_name IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> 'migrations'
      LOOP
        EXECUTE format('DELETE FROM %I', table_name);
      END LOOP;
    END $$;
  `);

  const instances = [
    [process.env.REDIS_CACHE_HOST, process.env.REDIS_CACHE_PORT],
    [process.env.REDIS_QUEUE_HOST, process.env.REDIS_QUEUE_PORT],
  ];

  for (const [host, port] of instances) {
    if (host && port && process.env.REDIS_PASSWORD) {
      const redis = new Redis({ host, port: Number(port), password: process.env.REDIS_PASSWORD });
      await redis.flushall();
      await redis.quit();
    }
  }
}
