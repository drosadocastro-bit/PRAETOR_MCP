# PRAETOR-MCP Quickstart

PRAETOR-MCP is a local, synthetic, advisory-only MCP prototype. It does not connect to live government or operational systems, authorize maintenance, determine equipment safety, or create work orders.

## Prerequisites

- Node.js 20 or newer
- npm

## Install

```sh
npm install
```

## Run the hackathon demo

```sh
npm run demo
```

The demo uses the local MCP stdio service and follows three steps:

1. **Retrieve** a traceable synthetic document excerpt.
2. **Challenge** the bounded review flow with contradictory synthetic evidence.
3. **Bound** the result through deterministic governance and human review.

The demo is successful when it shows evidence provenance, contradiction handling, bounded confidence, governance refusal or constraint, and `human_review_required: true`.

## Validate the repository

```sh
npm run check
npm test
```

The test suite includes unit, adversarial, governance, runtime-boundary, and real MCP stdio integration tests.

To reproduce the initial behavioral comparison:

```sh
npm run study:reliability
```

See [docs/PRAETOR_BEHAVIORAL_RELIABILITY_STUDY.md](docs/PRAETOR_BEHAVIORAL_RELIABILITY_STUDY.md) for the conditions, observed results, and limitations.

## Run the local MCP server

```sh
npm run dev
```

The server communicates over stdio. Keep protocol traffic on stdout; diagnostic messages are written to stderr.

## Safety boundary

All data is synthetic and local. The write tool persists only a review-only synthetic advisory packet after deterministic governance accepts it. It does not authorize action or change an operational system.

Shadow compatibility work remains observational and read-only. There is no automatic fallback, second authoritative call, shadow write, public HTTP deployment, or autonomous recovery path.

See [README.md](README.md), [docs/HACKATHON_PITCH_DRAFT.md](docs/HACKATHON_PITCH_DRAFT.md), and [docs/NOVA_LABS_RESEARCH_TODO.md](docs/NOVA_LABS_RESEARCH_TODO.md) for architecture, pitch, and research details.
