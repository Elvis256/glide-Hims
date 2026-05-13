import { DataSource } from 'typeorm';
import { join } from 'path';

export function getDatabaseConfig(isDeploy: boolean): any {
  const isStandalone = process.env.DB_TYPE === 'sqlite' || isDeploy;
  const baseConfig = {
    entities: [join(__dirname, '../**/*.entity{.ts,.js}'), join(__dirname, '../**/*.entities{.ts,.js}')],
    migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
    synchronize: false,
    logging: process.env.NODE_ENV !== 'production',
  };

  if (isStandalone) {
    // SQLite for standalone/offline deployments
    return {
      ...baseConfig,
      type: 'sqlite',
      database: process.env.SQLITE_PATH || '/data/glide-hims.db',
      extra: {
        journal_mode: 'WAL',
      },
    };
  } else {
    // PostgreSQL for SaaS/Hybrid deployments
    return {
      ...baseConfig,
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      poolSize: 20,
      extra: {
        max: 20,
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      },
    };
  }
}

export function createDataSource(isDeploy: boolean): DataSource {
  return new DataSource(getDatabaseConfig(isDeploy));
}
