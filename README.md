# @onreza/tochka-sdk

Типизированный TypeScript SDK для API [Точка Банка](https://developers.tochka.com/).

Работает в Node 24+, Bun, Deno, Cloudflare Workers. Публикуется в npm.

## Возможности

- Все **71 метод** API Точки (open-banking, SBP, acquiring, invoices, payments, consents, webhooks) с типами
- **5 режимов авторизации**: JWT-ключ, sandbox, bearer, OAuth 2.0 и собственный `AuthProvider`
- **Верификация вебхуков** RS256 через `jose`, runtime-проверка payload, `customWebhook`, kid-matching и TTL-кэш JWKS
- **Pay Gateway**: все исходящие методы официальной спецификации, RSA-SHA256
  подпись через WebCrypto и защита от double-charge на ретраях
- **Транспорт**: безопасные retry только для read-only методов, таймауты, типизированные ошибки и telemetry hooks
- **Автообновление спецификаций**: cron обновляет основной API и Pay Gateway,
  проверяет semantic diff и открывает PR

## Установка

```bash
npm i @onreza/tochka-sdk
# или
bun add @onreza/tochka-sdk
```

## Быстрый старт

### JWT-ключ (самый простой способ)

```ts
import { TochkaClient } from "@onreza/tochka-sdk";

const client = new TochkaClient({ auth: { jwt: process.env.TOCHKA_JWT! } });

const customers = await client.customers.list();
const company = client.forCustomer("300000092");
const accounts = await company.accounts.list();
```

### Sandbox

```ts
const client = TochkaClient.sandbox();
await client.sbp.qrCodes.register(merchantId, accountId, { ... });
```

### OAuth 2.0 (service-to-service)

```ts
const client = new TochkaClient({
  auth: {
    oauth: {
      clientId: process.env.TOCHKA_CLIENT_ID!,
      clientSecret: process.env.TOCHKA_CLIENT_SECRET!,
      mode: "client_credentials",
      scope: ["accounts", "balances"],
    },
  },
});
// Токен получается и обновляется автоматически
```

### OAuth 2.0 (multi-tenant с authorization_code)

```ts
import { OAuthClient, generatePkce } from "@onreza/tochka-sdk";

const oauth = new OAuthClient({ clientId, clientSecret });
const pkce = await generatePkce();

// 1. Построить URL для пользователя
const url = oauth.buildAuthorizeUrl({
  redirectUri: "https://your.app/cb",
  consentId: "...",
  state: "random-csrf-token",
  codeChallenge: pkce.codeChallenge,
});

// 2. После колбэка обменять code на токены
const tokens = await oauth.exchangeCode({
  code: receivedCode,
  redirectUri: "https://your.app/cb",
  codeVerifier: pkce.codeVerifier,
});

// 3. Передать токены в клиент — SDK сам обновляет через refresh_token.
// Для общего постоянного store обязателен tenant-specific storeKey.
const client = new TochkaClient({
  auth: {
    oauth: {
      clientId,
      clientSecret,
      mode: "authorization_code",
      store: tokenStore,
      storeKey: `oauth:${tenantId}`,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token!,
        tokenType: tokens.token_type,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      },
    },
  },
});
```

SDK дедуплицирует refresh одного `storeKey` внутри процесса. Если несколько
процессов используют общий Redis/БД store, приложение должно сериализовать
refresh одного tenant на уровне распределённого lock.

### Вебхуки

```ts
import { verifyWebhook, WebhookVerificationError } from "@onreza/tochka-sdk/webhooks";

app.post("/webhook", async (req, res) => {
  const rawBody = await req.text();
  try {
    const event = await verifyWebhook(rawBody);
    switch (event.webhookType) {
      case "incomingSbpPayment":
        console.log("SBP:", event.amount, event.payerName);
        break;
      case "acquiringInternetPayment":
        console.log("Card:", event.amount, event.paymentType);
        break;
      case "customWebhook":
        console.log("Custom:", event);
        break;
      // ... остальные типы
    }
    res.status(200).send();
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      console.error(`Verification failed: ${err.reason}`, err.cause);
    }
    res.status(400).send();
  }
});
```

### Pay Gateway (PCI-шлюз)

```ts
import { PayGatewayClient } from "@onreza/tochka-sdk/pay-gateway";
import { readFileSync } from "node:fs";

const pg = new PayGatewayClient({
  token: process.env.PG_JWT!,
  baseUrl: process.env.PG_BASE_URL!, // выдаётся при онбординге
  privateKey: readFileSync("private_pkcs8.pem", "utf8"),
});

const operation = await pg.payments.create({
  siteUid: "your-site",
  paymentUid: "payment-123",
  amount: { currency: "RUB", amount: "100.00" },
  orderUid: "order-123",
  paymentMethod: {
    type: "CARD",
    pan: "4111111111111111",
    expirationDate: "12/28",
    captureMode: "AUTO",
  },
});
```

## Subpath exports

Пакет использует subpath exports для tree-shaking:

- `@onreza/tochka-sdk` — основной клиент
- `@onreza/tochka-sdk/webhooks` — верификация вебхуков
- `@onreza/tochka-sdk/pay-gateway` — PCI-клиент с подписью
- `@onreza/tochka-sdk/errors` — иерархия ошибок

Всё собрано как ESM + CJS с типами.

## Обработка ошибок

```ts
import {
  TochkaError,
  InvalidTokenError,
  OperationRateLimitError,
  TochkaNetworkError,
  TochkaUnknownOutcomeError,
} from "@onreza/tochka-sdk/errors";

try {
  await client.sbp.qrCodes.register(...);
} catch (err) {
  if (err instanceof InvalidTokenError) {
    // обновить токен
  } else if (err instanceof OperationRateLimitError) {
    // подождать, повторить
  } else if (err instanceof TochkaUnknownOutcomeError) {
    // POST/PATCH/... мог быть применён сервером: сначала сверить состояние,
    // не повторять операцию без подтверждённой server-side idempotency
  } else if (err instanceof TochkaNetworkError) {
    // проблемы с сетью
  } else if (err instanceof TochkaError) {
    console.error(err.category, err.details, err.requestId);
  }
}
```

По умолчанию SDK автоматически повторяет только `GET`, `HEAD` и `OPTIONS`.
Расширять `retry.retryableMethods` для записывающих методов безопасно только при
документированной server-side idempotency.

## Разработка

См. [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
bun install
bun run verify     # generated diff, lint, typecheck, тесты, build и npm pack
```

## Лицензия

[MIT](./LICENSE) © ONREZA
