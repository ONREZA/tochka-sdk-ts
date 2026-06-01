---
"@onreza/tochka-sdk": minor
---

Pay Gateway: рекуррентные платежи СБП (issue #2).

- Новый модуль `client.sbpFunctionalLinks` — `create` (регистрация Функциональной ссылки СБП) и `getTokenizationResult` (pull-получение токена).
- Типизирован метод оплаты `SBP_TOKEN` для `payments.create`.
- Новый `verifyPayGatewayWebhook` — дискриминированный union вебхуков Pay Gateway (`sbp-token-issued` / `sbp-token-declined` / `payment-updated`) с кодами отказа.

**BREAKING:** методы `PayGatewayPaymentsModule` теперь следуют документированным путям `/uapi/pay/v1.0/sites/{siteUid}/...`. `baseUrl` — только хост; `siteUid` передаётся per-request: `get(siteUid, operationId)`, `capture(siteUid, operationId, body)`, `refund(siteUid, body)`. `DEFAULT_SIGNED_PATHS` обновлены под новые пути.
