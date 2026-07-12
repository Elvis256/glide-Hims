import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Migrations must run as the table OWNER (DDL rights + RLS bypass for
  // backfills). The app itself runs as the non-owner runtime role so that
  // row-level security applies to it. See common/database/rls-driver-patch.ts.
  username: process.env.DB_MIGRATION_USERNAME || process.env.DB_USERNAME,
  password: process.env.DB_MIGRATION_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    join(__dirname, '../**/*.entity{.ts,.js}'),
    join(__dirname, '../**/*.entities{.ts,.js}'),
  ],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  ssl:
    process.env.DB_SSL === 'false'
      ? false
      : process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  poolSize: 20,
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});
