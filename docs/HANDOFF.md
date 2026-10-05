# Handoff: state of the build as of 2026-10-05 (evening)

Read docs/PLAN.md first for the architecture and roadmap. This note says where the build is and
what to do next.

## What exists (all tests green: 42 unit, 7 integration)

Phase 1 catalog and checkout landed on top of the Phase 0 foundations:

- Catalog tables (Category, Offering, ModifierGroup, ModifierOption) and Order tables (Order,
  OrderItem, OrderEvent) with two Prisma migrations committed. Money is stored in minor units.
- Domain cart: addItem merges identical lines, quote handles delivery fee and inclusive or
  exclusive VAT (packages/domain/src/cart.ts, money.ts, catalog.ts).
- Restaurant flows: order_food (categories, items, modifier loop, quantity), checkout (delivery
  with location and address note, or pickup; quote; confirm), view_cart (global command "cart"),
  track_order. Copy in en and ar.
- Action layer in apps/api/src/actions: catalog.*, cart.*, orders.* bound to repositories and
  OrderService. The demo menu in demo-catalog.ts feeds both the in-memory catalog and the seed.
- OrderService: quote, place (sequential per-tenant numbers, "order.placed" event), transition
  (blueprint state machine, "order.status_changed" event) over an in-process EventBus port.
- ConversationService carries the cart across "menu" and "cart" jumps and passes customer and
  conversation ids to actions.
- Dev Postgres is on host port 5435 (other projects hold 5432 to 5434). Prisma scripts load the
  root .env through dotenv-cli. `pnpm --filter @ordr/api test:integration` runs the Postgres suite.
- Verified live: compiled server on Prisma plus Redis accepted a signed webhook, replied, stored
  the in and out messages, kept the session in Redis, and ignored the duplicate delivery.

Original Phase 0 inventory follows.

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

The API runs with STORAGE=memory and WHATSAPP_SENDER=log without any infrastructure. With a
.env (copy .env.example) it uses Postgres and Redis from docker-compose; `pnpm db:seed` loads the
demo tenant and menu.

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

1. Connect a real WhatsApp test number: fill .env from a Meta app, expose the API with a tunnel,
   register the webhook URL (the GET handshake and signature check are done), send "hi". Set
   WHATSAPP_SENDER=meta.
2. Order status notifications: subscribe to "order.status_changed" and message the customer.
   Inside the 24 hour window a plain text works; outside it needs an approved template, so add a
   template registry per tenant and a check on Conversation.lastInboundAt.
3. Merchant order management API (accept, start, ready, complete, reject) on top of
   OrderService.transition, with auth, then the dashboard (apps/dashboard, Next.js) orders board
   and inbox. Agent replies must respect the human/bot conversation status already modelled.
4. Persist the event outbox: write DomainEvents to a table in the same transaction and relay from
   a worker (apps/worker, BullMQ) instead of the in-process InMemoryEventBus.
5. Payment links behind a PaymentProvider port (Stripe UAE, Telr, Ziina); today paymentMethod is
   always "cash".
6. Multi-select modifier groups (maxSelect > 1 is stored but the flow treats groups as single
   select), item notes, scheduled orders, delivery zones with per-zone fees.
7. WhatsApp Flows node type (`form`) in the schema and runner, needed for the salon date picker
   in Phase 2.

## Open decisions still waiting on the owner

Payment providers, merchant pricing model, cloud account (AWS me-central-1 assumed), delivery
logistics partner, launch languages beyond en and ar. See docs/PLAN.md section 14.
