# @onreza/tochka-sdk

Типизированный TypeScript SDK для API [Точка Банка](https://developers.tochka.com/).

Работает в Node 18+, Bun, Deno, Cloudflare Workers. Публикуется в npm.

## Возможности

- Все **59 методов** API Точки (open-banking, SBP, acquiring, invoices, payments, consents, webhooks) с типами
- **3 способа авторизации**: JWT-ключ, sandbox, полный OAuth 2.0 (client_credentials + authorization_code + PKCE + автообновление)
- **Верификация вебхуков** RS256 через `jose`, дискриминированный union по `webhookType`, kid-matching и TTL-кэш JWKS
- **Pay Gateway** с RSA-SHA256 подписью тела через WebCrypto, защита от double-charge на ретраях
- **Транспорт**: retry с exponential backoff, таймауты, маппинг ошибок в `TochkaError`, telemetry hooks
- **Автообновление спеки**: cron в GitHub Actions качает `swagger.json`, регенерит типы, открывает PR с changeset

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

// 3. Передать токены в клиент — SDK сам обновляет через refresh_token
const client = new TochkaClient({
  auth: {
    oauth: {
      clientId,
      clientSecret,
      mode: "authorization_code",
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
      // ... остальные 3 типа
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
  amount: "100.00",
  orderUid: "order-123",
  paymentMethod: { type: "CARD", pan: "...", ... },
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
} from "@onreza/tochka-sdk/errors";

try {
  await client.sbp.qrCodes.register(...);
} catch (err) {
  if (err instanceof InvalidTokenError) {
    // обновить токен
  } else if (err instanceof OperationRateLimitError) {
    // подождать, повторить
  } else if (err instanceof TochkaNetworkError) {
    // проблемы с сетью
  } else if (err instanceof TochkaError) {
    console.error(err.category, err.details, err.requestId);
  }
}
```

## Разработка

См. [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
bun install
bun run gen        # генерация типов из specs/openapi.json
bun run build      # сборка пакета
bun test           # unit тесты
bun run lint       # biome
bun run typecheck  # tsc --noEmit
```

## Лицензия

[MIT](./LICENSE) © ONREZA
