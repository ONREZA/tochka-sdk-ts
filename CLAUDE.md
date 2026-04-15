# tochka-sdk-ts

Типизированный TypeScript SDK для [API Точка Банка](https://developers.tochka.com/). Опубликован как `@onreza/tochka-sdk`. Работает в Node 18+, Bun, Deno, Cloudflare Workers (WebCrypto + fetch).

## Сборка и запуск

```bash
bun install
bun run gen             # openapi-typescript → src/_generated/
bun run build           # tsup: ESM + CJS + DTS, subpath exports
bun test                # bun test (102 unit-тестов)
bun run lint            # biome check
bun run typecheck       # tsc --noEmit
bun run spec:fetch      # скачать свежий swagger.json в specs/
bun run spec:diff       # diff путей между openapi.json и openapi.prev.json
bun run spec:sync       # fetch + gen + diff → .sync-report.md (для CI)
```

## Архитектура

```
packages/tochka-sdk/
├─ src/
│  ├─ _generated/        # AUTO — openapi-typescript, не редактировать
│  │  ├─ schema.d.ts     # paths + operations + components (~11K строк)
│  │  └─ meta.ts         # TOCHKA_API_VERSION + BASE_URL константы
│  ├─ core/              # транспорт
│  │  ├─ http.ts         # openapi-fetch wrapper, middleware стек, makeRetryingFetch
│  │  ├─ retry.ts        # backoff, parseRetryAfter, sleep, isAbortError
│  │  └─ index.ts
│  ├─ auth/
│  │  ├─ jwt.ts          # JwtAuth + SandboxAuth
│  │  ├─ oauth-client.ts # OAuthClient — низкоуровневые endpoint-ы
│  │  ├─ oauth.ts        # OAuthAuth provider с автообновлением + TokenStore
│  │  ├─ pkce.ts         # S256 PKCE через WebCrypto
│  │  └─ types.ts        # AuthProvider интерфейс
│  ├─ modules/           # UX-обёртки, по одной на OpenAPI-раздел
│  │  ├─ base.ts         # BaseModule: unwrap, unwrapBoolean, requireCustomerCode
│  │  ├─ accounts.ts / balances.ts / customers.ts / statements.ts
│  │  ├─ payments.ts     # /payment/v1.0/*
│  │  ├─ sbp.ts          # /sbp/v1.0/* — legalEntity/merchants/qrCodes/cashboxQrCodes/b2bQrCodes/refunds
│  │  ├─ acquiring.ts    # /acquiring/v1.0/* — payments/subscriptions/registry/retailers
│  │  ├─ invoice.ts      # /invoice/v1.0/* — bills/closingDocuments
│  │  ├─ consents.ts     # /consent/v1.0/*
│  │  └─ webhook-mgmt.ts # /webhook/v1.0/*
│  ├─ webhooks/          # ВХОДЯЩИЕ вебхуки от Точки
│  │  ├─ index.ts        # verifyWebhook, discriminated union (5 типов)
│  │  └─ jwks.ts         # резолвер публичного ключа с TTL-кэшем + kid matching
│  ├─ pay-gateway/       # Отдельный PCI-клиент с RSA-подписью тела
│  │  ├─ client.ts       # PayGatewayClient + doRequest с double-charge guard
│  │  ├─ signature.ts    # createBodySigner (RSA-SHA256 через WebCrypto)
│  │  └─ payments.ts     # create / get / capture / refund
│  ├─ errors/index.ts    # TochkaError иерархия + TochkaNetworkError + TochkaSDKError
│  ├─ client.ts          # TochkaClient composition root, forCustomer, sandbox
│  └─ index.ts           # публичные exports
└─ test/unit/            # bun test — pure functions only
specs/
├─ openapi.json          # актуальный слепок API (v1.90.3-stable)
└─ openapi.prev.json     # предыдущая версия для diff (gitignored)
tools/
├─ fetch-spec.ts         # скачивает swagger.json, сохраняет prev
├─ gen.ts                # openapi-typescript → _generated/
├─ diff.ts               # diff путей и operationId между снимками
└─ sync.ts               # fetch + gen + diff одной командой (для CI)
```

### Слои (важно не смешивать)

```
┌─ UX layer (handwritten) ─────────────────────────────┐
│ TochkaClient, модули с декомпозицией по группам API  │
│ auth/*, webhooks/verify, pay-gateway                  │
└─────────────────┬─────────────────────────────────────┘
                  │
┌─ Generated layer ────────────────────────────────────┐
│ paths, operations, components (266 схем)             │
│ _generated/ — РЕГЕНЕРИРУЕТСЯ, не трогать             │
└─────────────────┬─────────────────────────────────────┘
                  │
┌─ Transport core ─────────────────────────────────────┐
│ openapi-fetch + middleware: auth/timeout/error/tele  │
│ makeRetryingFetch — retry на низкоуровневом fetch    │
└───────────────────────────────────────────────────────┘
```

### Ключевые паттерны

- **Все ответы Точки обёрнуты в `{ Data, Links, Meta }`**. В модулях распаковываем через `this.unwrap(data, "op")`. Для boolean-ответов (`{ Data: { result: bool } }`) — `this.unwrapBoolean(...)`.
- **`customerCode` передаётся через заголовок**, не в теле. Для привязки к конкретной компании — `client.forCustomer(code)`. Новый клиент **переиспользует** `AuthProvider` родителя — это критично для OAuth token-кэша.
- **Middleware порядок важен.** Регистрация: `auth → timeout → error → telemetry`. `onResponse` в `openapi-fetch` идёт в обратном порядке; поэтому timeout-timer чистится через WeakMap в `onResponse` И `onError` (иначе утечка на не-OK response или network error).
- **Retry двойной**: низкоуровневый retry в `makeRetryingFetch` (5xx/network), middleware только для mapping ошибок. **AbortError никогда не ретраится** — `isAbortError` + throw.
- **Pay Gateway: ≠ retry-on-network для подписанных путей.** Чтобы не было double-charge. У клиента 2 retry-конфига: обычный и `retryOptsForSigned` (с `retryOnNetworkError: false`).

## Авторизация

SDK поддерживает 5 вариантов через `AuthInput`:

```ts
new TochkaClient({ auth: { jwt: "..." } })                  // персональный JWT-ключ из ЛК
new TochkaClient({ auth: { sandbox: true } })               // Bearer sandbox.jwt.token
new TochkaClient({ auth: { bearer: "..." } })               // внешний access_token
new TochkaClient({ auth: { oauth: { ...options } } })       // OAuthAuth с авто-рефрешем
new TochkaClient({ auth: { custom: myProvider } })          // любой AuthProvider
```

OAuth поддерживает `mode: "client_credentials"` (S2S) и `mode: "authorization_code"` (multi-tenant с refresh_token). Токены сохраняются через `TokenStore` (по умолчанию — `InMemoryTokenStore`, можно плагинить Redis/БД). Параллельные запросы на refresh дедуплицируются через in-flight promise.

## Вебхуки

Входящие вебхуки от Точки = JWT RS256 в теле POST (`Content-Type: text/plain`). Публичный ключ: https://enter.tochka.com/doc/openapi/static/keys/public

```ts
import { verifyWebhook, WebhookVerificationError } from "@onreza/tochka-sdk/webhooks";
const event = await verifyWebhook(rawBody);
// event.webhookType ∈ { incomingPayment, outgoingPayment, incomingSbpPayment,
//                       incomingSbpB2BPayment, acquiringInternetPayment }
```

`verifyWebhook` бросает `WebhookVerificationError` с `reason: "signature" | "expired" | "algorithm" | "jwt_format" | "key_fetch" | "payload_shape" | "unknown"`. По умолчанию использует module-level singleton-резолвер с кэшем — 100 параллельных вебхуков = 1 fetch к JWKS URL.

## Pay Gateway (PCI-шлюз)

Отдельный продукт Точки — прямой приём карт/СБП со своей формой мерчанта. Требует сертификат PCI DSS AOC, выдаётся при онбординге. API, хост и JWT-токен — отдельные.

- 3 эндпоинта требуют RSA-SHA256 подпись тела в заголовке `Signature`: `POST /create-payment`, `POST /create-capture`, `POST /create-refund`.
- Ключ — PKCS#8 PEM (PKCS#1 должен быть сконвертирован: `openssl pkcs8 -topk8 -nocrypt -in private.pem -out private_pkcs8.pem`).
- Минимум 2048-бит, валидируется в `signature.ts`.

## Как добавить новый эндпоинт API

Когда Точка добавляет новый метод в OpenAPI:

1. `bun run spec:sync` — подтянет свежий swagger.json, регенерит типы, создаст `.sync-report.md` с diff.
2. Найти соответствующий модуль в `src/modules/` (или создать новый, если это новая группа).
3. Добавить UX-обёртку, использующую `this.fetch.GET/POST/PUT/DELETE` с типизированным path. Для единого респонса `{ Data, Links, Meta }` — `this.unwrap(data, "module.method")`.
4. Если нужны новые публичные типы — экспортировать через `export type ...` в модуле, `modules/index.ts` переэкспортит.
5. Если метод управляет подресурсом (как в SBP — `qrCodes`, `cashboxQrCodes`), добавить в соответствующий sub-module класс + зарегистрировать в корневом `SbpModule`.
6. Обновить публичный модуль через `TochkaClient` (добавить readonly в constructor).

**CI проверит что generated types in-sync с `specs/openapi.json`** (`git diff --exit-code packages/tochka-sdk/src/_generated`).

## Релизы

Через `onreza-release` (внутренний tool) + `cocogitto` + `lefthook`:

- `Release` workflow запускается вручную (`workflow_dispatch`). Bump версии по conventional-commits (`feat` → minor, `fix` → patch, `feat!` → major).
- Публикация в npm через **trusted publishing (OIDC)** — без `NPM_TOKEN`. **Требует Node 24+** в workflow, т.к. npm trusted publishing требует npm ≥ 11.5 (Node 22 даст `E404` на PUT, замаскированную под «пакета нет в registry»).
- Ежедневный cron `sync-openapi.yml` качает свежий `swagger.json` и создаёт PR с regenerated types + patch-changeset.

## Conventions

- **Минимум комментариев.** Только когда объясняют неочевидный *why* (hidden invariant, воркэраунд бага, кроссрантаймный gotcha). Никаких «added for issue #X» и ритуальных JSDoc над тривиальными геттерами.
- **Никаких «Generated with Claude Code» футеров и Co-Authored-By Claude.** В коммитах и PR.
- **Conventional Commits обязательны** (проверяет lefthook локально + `cog check` в CI на PR). Типы: feat, fix, perf, docs, refactor, style, chore, ci, test, build, revert. Scope-лист в `.onrezarelease.jsonc` → `commitlint.scopes`.
- **Файлы/функции**: `camelCase`. Типы/классы: `PascalCase`. Константы: `SCREAMING_SNAKE`.
- **Публичный API** — только то, что экспортится из `src/index.ts` / `src/webhooks/index.ts` / `src/pay-gateway/index.ts` / `src/errors/index.ts`. Всё остальное — internal.
- **tsconfig строгий**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Не ослаблять.
- **Никаких `any` в публичных сигнатурах.** `unknown` + narrow через type guard или discriminated union.
- **WebCrypto везде**, не `node:crypto` (кроссрантаймность). Исключение — `crypto.createHash` в tools/ (они Node-only по определению).

## Внешние ресурсы

- API docs (веб): https://developers.tochka.com/docs/tochka-api
- Pay Gateway docs: https://developers.tochka.com/docs/pay-gateway
- Локальные скрейпы: `docs/tochka/scraped-tochka-api/` (основной API) и `docs/tochka/scraped/` (pay-gateway)
- OpenAPI URL: https://enter.tochka.com/doc/openapi/swagger.json
- Sandbox: `https://enter.tochka.com/sandbox/v2/` + `Authorization: Bearer sandbox.jwt.token`
