import path from 'node:path';

export const E2E_DATA_DIR = path.resolve(__dirname, '../../.pgtest-e2e');
export const E2E_PORT = 54329;
export const E2E_USER = 'leadradar';
export const E2E_PASSWORD = 'leadradar_test';
export const E2E_DB_NAME = 'leadradar_test';
export const E2E_DATABASE_URL = `postgresql://${E2E_USER}:${E2E_PASSWORD}@localhost:${E2E_PORT}/${E2E_DB_NAME}?schema=public`;
