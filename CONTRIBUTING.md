# Contributing

Спасибо за интерес! Быстрый гайд по работе с репо.

## Требования

- [Bun](https://bun.sh) — рантайм и test-раннер
- Node 18+ (для проверки совместимости, опционально)

## Старт

```bash
bun install
bun run gen        # генерация типов из specs/openapi.json
bun run build      # сборка пакета
bun test           # 102+ unit-тестов
bun run lint       # biome
bun run typecheck  # tsc --noEmit
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
- **Никакого "Generated with Claude Code"** в коммитах и PR-описаниях.
- **Generated код не трогаем руками** — всё в `src/_generated/`. При изменении спецификации: `bun run spec:fetch && bun run gen`.
- **Changesets для релизов:** на каждое изменение публичного API добавляй changeset (`bun run changeset`).

## Workflow изменений

1. Fork / ветка от `main`.
2. Код + тесты + changeset.
3. `bun run lint && bun run typecheck && bun test && bun run build` должны пройти.
4. PR в `main`. CI прогонит всё ещё раз + проверит что generated types in-sync.

## Релизы

Управляются через [Changesets](https://github.com/changesets/changesets) + GitHub Actions:

- Мердж PR в `main` → workflow создаёт **Release PR** с bump версий.
- Мердж Release PR → публикация в npm (`NPM_TOKEN` secret).

## Обновление OpenAPI-спеки

Cron-workflow `sync-openapi.yml` раз в сутки сам создаёт PR, если схема Точки изменилась. Вручную:

```bash
bun run spec:sync   # fetch + gen + diff → .sync-report.md
bun run lint && bun run typecheck && bun run build && bun test
```

## Поддержка

Issues и PR — на GitHub.
