# Contributing

Спасибо за интерес! Быстрый гайд по работе с репо.

## Требования

- [Bun](https://bun.sh) 1.4.4 — рантайм, форматирование, test-раннер и package manager
- Node 24+ — инструменты разработки, сборка и поддерживаемый рантайм SDK
- [cocogitto](https://github.com/cocogitto/cocogitto) для локальной валидации коммитов (опционально, но рекомендуется): `cargo install cocogitto`
- `lefthook` ставится автоматически через `bun install`

Проверки SDK, tests и tools используют TypeScript 7 (`@typescript/native`).
TypeScript 6.0.3 нужен генератору и сборке деклараций с совместимым compiler API.
Consumer types установленного npm-пакета проверяются TypeScript 6 и 7.

## Старт

```bash
bun install --frozen-lockfile # изолированные зависимости + git hooks через lefthook
bun run gen          # генерация типов из обеих OpenAPI-спецификаций
bun run format       # форматирование через bun fmt
bun run test:changed # затронутые Git-изменениями тесты (локальная быстрая проверка)
bun run verify       # полный локальный CI-контур, все тесты с --parallel
```

Версия Bun задана в `packageManager`; CI читает её из `package.json`.
Общий `@types/bun` закреплён в `catalog`, версии TypeScript разделены по ролям намеренно.
`bun fmt` отвечает за форматирование, Oxlint — за проверки ошибок.
`bun run lint` проверяет код; `bun run lint:fix` применяет безопасные исправления.
Сгенерированные файлы, спецификации и архивные страницы исключены из форматирования.

Для сборки без сети сначала заполните кеш: `bun pm fetch`, затем
`bun install --offline --frozen-lockfile`. CI выполняет полную проверку тестов;
`test:changed` предназначен для локальной итерации и её не заменяет.

## Структура

```
packages/tochka-sdk/
├─ src/
│  ├─ _generated/   # AUTO — openapi-typescript, не редактировать
│  ├─ core/         # транспорт, retry, middleware
│  ├─ auth/         # JWT, OAuth, PKCE
│  ├─ modules/      # UX-обёртки для каждого API-раздела
│  ├─ webhooks/     # jose verify + discriminated union
│  ├─ pay-gateway/  # отдельный клиент PCI-шлюза
│  └─ errors/       # иерархия ошибок
└─ test/unit/       # bun test
tools/              # spec fetch / gen / diff / sync
specs/              # OpenAPI слепок
```

## Правила

- **Комментарии минимальны.** Только там, где объясняют неочевидный _why_. Комментарии вида «added for issue #X» — comment rot, удаляются.
- **Generated код не трогаем руками** — всё в `src/_generated/`. При изменении спецификации: `bun run spec:fetch && bun run gen`.
- **Conventional Commits обязательны.** Lefthook + cocogitto проверяют формат при коммите. В CI дополнительно `cog check` на всех коммитах PR.

Примеры валидных сообщений:

```
feat(tochka-sdk): add paginate async iterator for statements
fix(tochka-sdk): refresh race when token expires during retry
docs: clarify OAuth multi-tenant setup in README
chore(deps): bump jose to 5.11.0
feat(tochka-sdk)!: split WebhookVerificationError into typed subclasses
```

## Workflow изменений

1. Ветка от `main`.
2. Код + тесты + conventional commits.
3. `bun run verify` должен пройти.
4. PR в `main`. CI повторит проверку и проверит npm-пакет на минимальном
   Node 24.0.0. Актуальный Node 24 и Bun проверяются в основном verify.
   Пакет выпускается только как ESM.

## Релизы

Управляются через
[release-please](https://github.com/googleapis/release-please):

- Каждый push в `main` создаёт или обновляет release PR.
- Для изменений опубликованного пакета используйте scope `tochka-sdk`.
- `release-please` вычисляет версию по conventional commits и обновляет
  `packages/tochka-sdk/package.json`, `CHANGELOG.md` и release manifest.
- Для версий `0.x` breaking change повышает minor-версию.
- После merge release PR создаются тег `v{version}` и GitHub Release.
- Тег проходит полный `verify`; только после этого пакет публикуется в npm через
  **trusted publishing** (OIDC, без `NPM_TOKEN`).

## Обновление OpenAPI-спеки

Cron-workflow `sync-openapi.yml` раз в сутки сам создаёт PR, если схема Точки изменилась. Вручную:

```bash
NODE_EXTRA_CA_CERTS="$PWD/tools/certs/russian-trusted-root-ca.pem" bun run spec:sync
bun run verify
```

Оба endpoint Точки используют TLS-сертификаты Минцифры. `NODE_EXTRA_CA_CERTS`
добавляет проверенный корневой CA к стандартному trust store Bun при запуске
процесса. В CI он задан для сетевых шагов sync и sandbox smoke; системное
хранилище runner и опубликованный SDK не изменяются. Для `spec:fetch` и
локального sandbox smoke используйте ту же переменную.
Источник, fingerprint и порядок обновления CA: [tools/certs/README.md](tools/certs/README.md).
Не отключайте проверку TLS. Если цепочка, срок действия или имя хоста неверны,
sync должен завершаться ошибкой; проблему необходимо исправить на стороне endpoint.

GitHub отключает scheduled workflow публичного репозитория после 60 дней без
активности. В Actions → Sync OpenAPI включите workflow через **Enable workflow**,
затем **Run workflow**. Это отдельная настройка GitHub, исправление CA её не заменяет.

Sync публикует PR с regenerated types и семантическим diff. Полным verify для PR
владеет обязательный CI; sync workflow не дублирует весь набор. Если изменившаяся
схема требует доработки SDK, CI блокирует merge до исправления. Запуски с других
веток проверяют sync, но не обновляют bot PR.

Защита `main` требует PR, актуальную базовую ветку и успешные проверки `verify`,
`Package smoke (Node 24.0.0)`, `Lint Commit Messages`. Force-push и удаление `main` запрещены; обходов
для администраторов и ботов нет. Для слияния используется squash.
CI проверяет заголовок PR как Conventional Commit и повторяется при его
редактировании: этот заголовок становится заголовком squash-коммита.

Spec-бот и release-please используют организационный `RELEASE_PLEASE_TOKEN`:
он позволяет автоматически запускать CI созданных ими PR. PR, созданные через
`GITHUB_TOKEN`, требуют ручного разрешения запуска workflow.

## Поддержка

Issues и PR — на GitHub.

## Общий стандарт SDK

CI, Dependabot, formatter/linter и hooks согласованы с CloudPayments SDK.
GitHub Actions закреплены SHA; Bun берётся из `packageManager`. Основной `test`
запускает только offline tests; sandbox — отдельно через `test:integration`.
`typecheck:tools` включает тестовые файлы, `typecheck:portable` проверяет runtime
без Node/Bun types. CodeQL, Code Quality, secret scanning и push protection
дополняют обязательные локальные гейты. Версии SDK выпускаются независимо.

Авторизация sync/release остаётся через организационный `RELEASE_PLEASE_TOKEN`;
CloudPayments использует свой установленный GitHub App. Не заменяйте рабочую
схему credentials предположением о доступности secrets в другом репозитории.

## Разбор ошибок

Для воспроизведения нужны версия SDK/runtime, операция и безопасный класс/код
ошибки. Не прикладывайте credentials, карточные данные, криптограммы, raw bodies
или токены. Сначала воспроизведите проблему offline через custom fetch и добавьте
регрессионный тест. Подтверждённый source fix, зелёный CI и опубликованный пакет —
отдельные этапы; после релиза проверьте установку и источник npm-артефакта.
Неопределённый исход платежа требует сверки, а не новой оплаты по возрасту ошибки.
