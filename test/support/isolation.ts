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
      PERFORM setval(sequence.oid, 1, false)
      FROM pg_class sequence
      JOIN pg_namespace namespace ON namespace.oid = sequence.relnamespace
      WHERE sequence.relkind = 'S' AND namespace.nspname = 'public' AND sequence.relname <> 'migrations_id_seq';
    END $$;
  `);

  for (const url of [process.env.REDIS_CACHE_URL, process.env.REDIS_QUEUE_URL]) {
    if (url) {
      const redis = new Redis(url);
      await redis.flushall();
      await redis.quit();
    }
  }
}
