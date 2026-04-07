import { Hono } from 'hono';
import { listPackages } from '../repositories/packages-repo.js';
import type { AppEnv } from '../app.js';

const packages = new Hono<AppEnv>();

packages.get('/', (c) => {
  const db = c.get('db');
  return c.json(listPackages(db));
});

export default packages;
