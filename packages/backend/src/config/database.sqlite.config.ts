import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

export default new DataSource({
  type: 'sqlite',
  database: process.env.SQLITE_PATH || '/data/glide-hims.db',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  extra: {
    journal_mode: 'WAL',
  },
});
