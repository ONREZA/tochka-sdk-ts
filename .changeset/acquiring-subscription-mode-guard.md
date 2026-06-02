---
"@onreza/tochka-sdk": patch
---

Internet Acquiring подписки: guard на взаимоисключающие режимы + документация.

- `acquiring.subscriptions.create` / `createWithReceipt` теперь бросают `TochkaSDKError` до отправки запроса, если переданы одновременно объект `Options` (авто-график) и `recurring: true` (ручные списания) — документация Точки запрещает эту комбинацию, иначе банк вернёт ошибку. Понятное сообщение вместо HTTP 400.
- JSDoc на `AcquiringSubscriptionsModule`: два режима (`Options` XOR `recurring`), только банковские карты, возврат подписки только в интернет-банке (метода API нет), необратимость отмены (`Cancelled`), отсутствие продления.

Источник: https://developers.tochka.com/docs/tochka-api/opisanie-metodov/podpiski-rekurrentnye-platezhi
