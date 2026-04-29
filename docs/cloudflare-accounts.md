# Cloudflare Accounts

This workspace supports two parallel Cloudflare deployments:

- `default`: the current Cloudflare account and deployment.
- `base`: the second Cloudflare account and deployment.

Each account has its own Wrangler config and env file:

| Account | Wrangler config | Env file | Worker | D1 database |
|---|---|---|---|---|
| `default` | `wrangler.default.jsonc` | `.env.cloudflare.default` | `base-gym` | `base-gym-db` |
| `base` | `wrangler.base.jsonc` | `.env.cloudflare.base` | `gym` | `gym-db` |

The `.env.cloudflare.*` and account-specific `wrangler.*.jsonc` files are intentionally ignored by git because they can contain account-specific IDs and tokens. Keep `wrangler.example.jsonc` and `.env.cloudflare.example` as shareable templates.

## Account Env Files

Create one env file per Cloudflare account:

```bash
cp .env.cloudflare.example .env.cloudflare.default
cp .env.cloudflare.example .env.cloudflare.base
```

Set the current account's values in `.env.cloudflare.default`, and set the new account's values in `.env.cloudflare.base`:

```dotenv
CLOUDFLARE_ACCOUNT_ID=<cloudflare-account-id>
CLOUDFLARE_API_TOKEN=<cloudflare-api-token>
```

The token needs permission to deploy Workers, manage Workers routes/custom domains, and manage D1 databases for that account.

## New `base` Account Rollout

1. Confirm the token points at the new account:

```bash
npm run cf:base:whoami
```

2. Create the new D1 database:

```bash
npm run cf:base:d1:create
```

3. Confirm `wrangler.base.jsonc` now contains the returned `database_id`. The create script passes `--update-config`, so Wrangler should update the file automatically.

4. If the new account owns a custom domain for this deployment, add a `routes` entry to `wrangler.base.jsonc`. Otherwise deploy without `routes` first and use the Worker subdomain.

5. Apply migrations and seeds:

```bash
npm run db:migrate:cloudflare:base
npm run db:seed:cloudflare:base
```

6. Deploy:

```bash
npm run deploy:cloudflare:base
```

## Current `default` Account Rollout

```bash
npm run cf:default:whoami
npm run db:migrate:cloudflare:default
npm run db:seed:cloudflare:default
npm run deploy:cloudflare:default
```

`npm run deploy:cloudflare` remains an alias for `npm run deploy:cloudflare:default`.
