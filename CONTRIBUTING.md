# Contributing

Спасибо за интерес! Быстрый гайд по работе с репо.

## Требования

- [Bun](https://bun.sh) — рантайм и test-раннер
- Node 18+ (для проверки совместимости, опционально)
- [cocogitto](https://github.com/cocogitto/cocogitto) для локальной валидации коммитов (опционально, но рекомендуется): `cargo install cocogitto`
- `lefthook` ставится автоматически через `bun install`

## Старт

```bash
bun install          # + ставит git hooks через lefthook
bun run gen          # генерация типов из specs/openapi.json
bun run build        # сборка пакета
bun test             # unit-тесты
bun run lint         # biome
bun run typecheck    # tsc --noEmit
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
feat(modules): add paginate async iterator for statements
fix(auth): refresh race when token expires during retry
docs: clarify OAuth multi-tenant setup in README
chore(deps): bump jose to 5.11.0
feat(webhooks)!: split WebhookVerificationError into typed subclasses
```

## Workflow изменений

1. Ветка от `main`.
2. Код + тесты + conventional commits.
3. `bun run lint && bun run typecheck && bun test && bun run build` должны пройти.
4. PR в `main`. CI прогонит всё ещё раз + проверит что generated types in-sync + провалидирует коммиты.

## Релизы

Управляются через [onreza-release](https://gitverse.ru/onreza/release-tool):

- Вручную запустить workflow **Release** (`workflow_dispatch`) в GitHub Actions.
- `onreza-release` на основе conventional-commits:
  - определит следующую версию (feat → minor, fix → patch, feat! → major);
  - обновит `packages/tochka-sdk/package.json`, `CHANGELOG.md`;
  - создаст commit и тег `v{version}`;
  - запушит и создаст GitHub Release.
- Второй job `publish` публикует пакет в npm через **trusted publishing** (OIDC, без `NPM_TOKEN`).

## Обновление OpenAPI-спеки

Cron-workflow `sync-openapi.yml` раз в сутки сам создаёт PR, если схема Точки изменилась. Вручную:

```bash
bun run spec:sync   # fetch + gen + diff → .sync-report.md
bun run lint && bun run typecheck && bun run build && bun test
```

## Поддержка

Issues и PR — на GitHub.
