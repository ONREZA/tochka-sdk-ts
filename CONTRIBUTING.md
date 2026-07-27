# Contributing

Спасибо за интерес! Быстрый гайд по работе с репо.

## Требования

- [Bun](https://bun.sh) 1.3.14 — рантайм и test-раннер
- Node 24+ — инструменты разработки, сборка и поддерживаемый рантайм SDK
- [cocogitto](https://github.com/cocogitto/cocogitto) для локальной валидации коммитов (опционально, но рекомендуется): `cargo install cocogitto`
- `lefthook` ставится автоматически через `bun install`

## Старт

```bash
bun install          # + ставит git hooks через lefthook
bun run gen          # генерация типов из обеих OpenAPI-спецификаций
bun run verify       # полный локальный CI-контур
```

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

- **Комментарии минимальны.** Только там, где объясняют неочевидный *why*. Комментарии вида «added for issue #X» — comment rot, удаляются.
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
4. PR в `main`. CI повторит проверку, проверит переносимость типов и импорты в
   поддерживаемых Node/Deno runtime.

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
bun run spec:sync   # fetch + gen + diff → .sync-report.md
bun run verify
```

## Поддержка

Issues и PR — на GitHub.
