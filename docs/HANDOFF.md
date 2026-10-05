# Handoff: state of the build as of 2026-10-05

Read docs/PLAN.md first for the architecture and roadmap. This note says where the build is and
what to do next.

## What exists (commit 85ddbb2, all tests green)

| Workspace | Purpose | Tests |
|-----------|---------|-------|
| packages/domain | Tenant, Channel, Customer, Order types; blueprint-driven state machine helpers | 3 |
| packages/whatsapp | Cloud API webhook types and parser, HMAC signature check, outbound builders that enforce Meta limits, HTTP client, FakeSender and LoggingSender, webhook fixtures | 13 |
| packages/flow-schema | zod schemas for flows and blueprints, FlowRunner (buttons, static and data-driven lists, text, location, actions, branches, goto_flow, handoff, end), localized copy, interpolation, Arabic detection | 12 |
| packages/blueprints | Restaurant blueprint: main_menu, order_food, track_order, talk_to_us, language flows in en and ar | 5 |
| apps/api | NestJS app: webhook controller, InboundQueue (serial per customer), ConversationService, memory/Redis/Prisma adapters, Prisma schema, seed, simulator CLI, health endpoint | 14 |

Commands from the repo root:

```
pnpm install
pnpm build && pnpm typecheck && pnpm test   # full pipeline, also what CI runs
pnpm simulate                               # chat with the bot in the terminal, no WhatsApp needed
pnpm db:up && pnpm db:migrate && pnpm db:seed   # Postgres + Redis via Docker, then schema and demo tenant
pnpm dev                                    # API with tsx watch; needs .env (copy .env.example)
```

The API runs with STORAGE=memory and WHATSAPP_SENDER=log without any infrastructure. No Prisma
migration has been generated yet: run `pnpm db:migrate` once against Postgres to create the
first migration folder and commit it.

## Design rules to keep

- Every constructor dependency in apps/api uses an explicit @Inject token from src/tokens.ts.
  Vitest runs through esbuild, which does not emit decorator metadata, so implicit injection
  by type will fail at runtime in tests.
- Adapters implement the interfaces in apps/api/src/ports.ts. Tests and the simulator use the
  in-memory ones; production picks Prisma plus Redis from config in app.module.ts.
- Blueprints are JSON validated by packages/flow-schema. Flow copy is a string or a map of
  language code to string. Dynamic lists read DynamicRow[] from the session context through
  `rowsFrom`.
- Actions are named handlers registered in a MapActionRegistry. The demo catalog actions live in
  apps/api/src/actions/demo-catalog.ts and are the only place with hard-coded menu data.
- Outbound builders throw on Meta limit violations; dynamic data is clipped in the runner.

## Next steps, in order

1. Generate and commit the first Prisma migration. Verify the Prisma adapters against a real
   Postgres with an integration test behind an env flag.
2. Connect a real WhatsApp test number: fill .env from a Meta app, expose the API with a tunnel,
   register the webhook URL (the GET handshake and signature check are done), send "hi".
3. Phase 1 catalog service: Offering, Category, Modifier tables and a Catalog module; replace
   demo-catalog.ts handlers with Prisma-backed ones. The blueprint should not change.
4. Cart and checkout in the order_food flow: quantity question, add-more loop, fulfillment choice
   (delivery, pickup), location request for delivery, order summary, Order creation using the
   blueprint state machine, payment link action behind a PSP interface.
5. Order status notifications: template messages when status changes, driven by domain events
   through an outbox table and a worker app (apps/worker, BullMQ).
6. Merchant dashboard (apps/dashboard, Next.js) with orders board and inbox; agent replies that
   respect the human/bot conversation status already modelled.
7. WhatsApp Flows node type (`form`) in the schema and runner, needed for the salon date picker
   in Phase 2.

## Open decisions still waiting on the owner

Payment providers, merchant pricing model, cloud account (AWS me-central-1 assumed), delivery
logistics partner, launch languages beyond en and ar. See docs/PLAN.md section 14.
