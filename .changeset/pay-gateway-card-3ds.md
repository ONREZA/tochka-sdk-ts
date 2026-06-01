---
"@onreza/tochka-sdk": minor
---

Pay Gateway: карточные платежи и завершение 3-D Secure.

- Типизирован метод оплаты `CARD` для `payments.create` (`CardPaymentMethod`) с `tokenizationCredentials` (`CREDENTIAL_CAPTURED` / `CIT_CREDENTIAL_ON_FILE` / `MIT_CREDENTIAL_ON_FILE`) — привязка карты и списания card-on-file (CIT/MIT-рекуррент).
- Ответ `payments.create` теперь несёт опциональный `requirements: ThreeDsRequirement` (`type: "THREE_DS"`, `paReq`, `acsUrl`) для сценариев, требующих 3DS.
- Новый метод `payments.complete(siteUid, paymentUid, { paRes })` — завершение 3-D Secure. Тело плоское, подпись не требуется (не входит в документированный список подписанных путей).
- Успешные ответы pay-gateway разворачиваются из Open Banking-конверта `{ Data, Links, Meta }` (примеры `create-payment` / `get-payment` в доках возвращают полезную нагрузку внутри `Data`). Раньше клиент возвращал тело как есть, из-за чего `resp.paymentUid` / `resp.qrcId` были `undefined`. Разворот толерантный: ответы без конверта пропускаются как есть. Запросы остаются плоскими.

Точные имена полей реквизитов карты и путь `complete` не опубликованы в OpenAPI pay-gateway: реквизиты оставлены расширяемыми (`[key: string]: unknown`), путь выведен из паттерна `capture` и помечен в `@remarks` как требующий проверки на онбординг-сэндбоксе.
