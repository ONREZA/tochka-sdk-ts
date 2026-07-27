# Changelog

Changelog ведётся автоматически через
[release-please](https://github.com/googleapis/release-please) на основе
[Conventional Commits](https://www.conventionalcommits.org/).

## [0.1.5] - 2026-07-27

### ⚠️ Breaking changes

- Минимальная поддерживаемая версия Node.js повышена до 24.
- Mutating-запросы больше не повторяются автоматически после неоднозначной
  транспортной ошибки.
- Типы, пути и request-конверты Pay Gateway приведены к официальной
  OpenAPI-спецификации.

### ✨ Features

- Добавлены все исходящие операции и callback-контракты Pay Gateway.
- Добавлена синхронизация основной и Pay Gateway OpenAPI-спецификаций.

### 🐛 Fixed

- Исправлены OAuth TokenStore, webhook JWK/JWKS, retry и package runtime
  контракты.
- Release и OpenAPI workflows получили единый проверяемый gate.

## [0.1.4] - 2026-06-22

### 🐛 Fixed

- Добавлена ранняя проверка взаимоисключающих режимов подписки интернет-эквайринга
  `Options` и `recurring`, а также уточнён их публичный контракт
  ([c6dc26d](https://github.com/ONREZA/tochka-sdk-ts/commit/c6dc26d)).

## [0.1.3] - 2026-06-02

### ✨ Features

- Добавлены рекуррентные платежи СБП через функциональные ссылки, оплата
  `SBP_TOKEN` и проверка webhook Pay Gateway
  ([4fd1891](https://github.com/ONREZA/tochka-sdk-ts/commit/4fd1891)).
- Добавлены карточные платежи, card-on-file, завершение 3-D Secure и корректное
  извлечение полезной нагрузки из конверта `Data`
  ([1971c61](https://github.com/ONREZA/tochka-sdk-ts/commit/1971c61)).

### ⚠️ Breaking changes

- Методы платежей Pay Gateway используют документированные пути
  `/uapi/pay/v1.0/sites/{siteUid}/...`; `siteUid` передаётся в каждый вызов.

## [0.1.2] - 2026-06-01

### 🔧 Changed

- reformat context7.json and package.json with tabs to satisfy biome ([73669a6](https://github.com/ONREZA/tochka-sdk-ts/commit/73669a62a5e81bf203f60c4d73cd4ea69320a354))

## [0.1.1] - 2026-04-19

## [0.1.0] - 2026-04-15

### ✨ Features

- initial SDK implementation ([ba097a3](https://github.com/ONREZA/tochka-sdk-ts/commit/ba097a39a770835264f8b156242fd9bdb151874b))

### ⏪ Reverts

- roll back v0.1.0 release (2nd attempt — TP still rejecting OIDC) ([4ca5487](https://github.com/ONREZA/tochka-sdk-ts/commit/4ca548713e9142956b4892aeba8911732a71a629))
- roll back v0.1.0 release (npm trusted publisher not yet configured) ([37894c1](https://github.com/ONREZA/tochka-sdk-ts/commit/37894c1bf8a0dee12daf0a4ad69ef70e684ba52c))
