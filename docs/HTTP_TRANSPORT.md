# PRAETOR HTTP transport

stdio remains the default and safest local MCP transport. HTTP is an explicit,
opt-in runtime for bounded local or platform-managed ingress; it is not enabled
by `npm run dev` or by the container unless `PRAETOR_HTTP_KEY` is supplied.

## Local run

```sh
set PRAETOR_HTTP_KEY=replace-with-a-local-16-character-or-longer-credential
npm run dev:http
```

PowerShell:

```powershell
$env:PRAETOR_HTTP_KEY = 'replace-with-a-local-16-character-or-longer-credential'
npm run dev:http
```

`GET /healthz` is unauthenticated so a local supervisor can check liveness.
`POST /mcp` requires `X-Praetor-Key`, a credential belonging to the PRAETOR
application. `Authorization` is intentionally reserved for platform or ingress
authentication and is not accepted as a replacement; both headers may coexist.

The HTTP runtime rejects unapproved Host and Origin values, caps request bodies,
limits concurrent requests, times out bounded requests, and closes its MCP
handler and TCP listener on SIGINT/SIGTERM. HTTP writes are disabled by default.
Enabling them requires `PRAETOR_HTTP_WRITES=true` and does not change the
deterministic governance checks.

Important environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PRAETOR_HTTP_HOST` | `127.0.0.1` | Bind address |
| `PRAETOR_HTTP_PORT` | `3000` | TCP port; `0` selects an ephemeral port |
| `PRAETOR_HTTP_KEY` | required | 16–512 character application credential |
| `PRAETOR_HTTP_ALLOWED_HOSTS` | bind host plus localhost values | Host allowlist, without ports |
| `PRAETOR_HTTP_ALLOWED_ORIGINS` | Host allowlist | Origin hostname allowlist |
| `PRAETOR_HTTP_MAX_BODY_BYTES` | `1048576` | Maximum request body |
| `PRAETOR_HTTP_MAX_CONCURRENT_REQUESTS` | `32` | In-flight request limit |
| `PRAETOR_HTTP_REQUEST_TIMEOUT_MS` | `10000` | Request handling timeout |
| `PRAETOR_HTTP_WRITES` | `false` | Explicitly enables the review-only HTTP write route |

## Docker and platform scaffolding

`Dockerfile` is a multi-stage, non-root image with a health check. The image is
scaffolding until a Docker engine run is performed. `docker-compose.yml` keeps
the filesystem read-only, drops Linux capabilities, and requires the application
credential from the environment. No cloud resources, workspace identifiers,
secrets, Databricks connections, or NEXRAD/manual integrations are embedded.

Runtime packet persistence remains local append-only JSONL. It is not distributed
storage, tamper-evident audit storage, or production-grade concurrent write
storage. It is also separate from the post-G3B authority/evidence durability
research store.
