import type { DataSource } from 'typeorm';

export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    DO $$
    DECLARE
      table_name text;
    BEGIN
      FOR table_name IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> 'migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', table_name);
      END LOOP;
    END $$;
  `);
}
