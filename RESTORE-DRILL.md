# Restore drill

Одноразовий прогін `scripts/restore-drill.sh` на останньому дампі `scripts/backup.sh`.

- Дата: 2026-09-19 09:23 UTC
- Дамп: `backups/api-20260919-092314.dump`, 68K (`pg_dump -Fc`, база `api`, після `npm run seed`)
- Ціль відновлення: одноразовий контейнер `postgres:18` з порожнім анонімним volume (`docker run`, без монтування existing volume)
- Контрольна перевірка: `ProductOffer` — `count(*)`, `sum(price)`
  - Baseline (записано під час бекапу): `15|2775.00`
  - Після restore: `15|2775.00`
  - Результат: **MATCH**
- Виміряний RTO (від `docker cp` дампа до готовності даних у відновленій базі, без часу підняття самого контейнера postgres — воно окремо, ~секунди на холодний старт образу): **211 ms**
- RPO поточного розкладу (`backup.cron`, нічний прогін о 02:30): **до 24 год** — у гіршому випадку втрачаються всі зміни з моменту останнього нічного бекапу до моменту збою.

## Як відтворити

```bash
DBHOST=localhost DBPORT=5500 DBNAME=api DBUSER=root bash scripts/backup.sh
DBNAME=api DBUSER=root bash scripts/restore-drill.sh
```
