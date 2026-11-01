# tochka-sdk-ts

Типизированный `@onreza/tochka-sdk` для API Точка Банка. Команды, структура,
TLS-настройки и релизы описаны в [CONTRIBUTING.md](CONTRIBUTING.md), публичный API —
в [README.md](README.md).

- Полная проверка: `bun run verify`. Для быстрой итерации: `bun run test:changed`;
  перед завершением запускай полный набор. Форматирование: `bun run format`.
- `specs/` — источники OpenAPI. `src/_generated/` обновляй только через
  `bun run gen`; изменение спецификаций должно сохранять контракт SDK и проходить
  проверки типов, runtime и npm-архива.
- Не объединяй TypeScript 6 в корне и TypeScript 7 в SDK: генератор использует
  compiler API TypeScript 6. Общие версии зависимостей храни в существующем catalog.
- SDK переносим между Node 24+, Bun, Deno и Workers: используй fetch/WebCrypto,
  не добавляй Node-only зависимости в runtime. Строгие настройки типов не ослабляй.
  Публичные сигнатуры — без `any`; используй `unknown` с сужением типов.
- Публичные entry points: `src/index.ts`, `src/webhooks/index.ts`,
  `src/pay-gateway/index.ts`, `src/errors/index.ts` внутри `packages/tochka-sdk`.
- Модули распаковывают `{ Data, Links, Meta }` через `BaseModule`; `customerCode`
  передаётся заголовком. `forCustomer()` сохраняет общий AuthProvider и token cache.
- Сохраняй порядок middleware auth → error → timeout → telemetry и отмену retry
  при AbortError. Таймаут включает чтение тела ответа.
- Pay Gateway: сохраняй подпись запросов и защиту от двойного списания.
  Сетевой сбой записи, включая чтение ответа, может означать неопределённый
  результат; не повторяй такую операцию автоматически.
- Не отключай TLS-проверку. Дополнительный CA разрешён только в сетевых шагах
  sync/sandbox, не в runtime SDK и не глобально для workflow.
- Для изменений опубликованного пакета используй conventional commit scope
  `tochka-sdk`; комментарии и сообщения коммитов — на английском.
