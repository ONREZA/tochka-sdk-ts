---
source: https://developers.tochka.com/docs/tochka-api/pesochnica
title: "Песочница"
description: "Песочница — это специальная среда API банка для тестирования запросов. В ней все данные заменены на тестовые, и отправленные запросы не влияют на продакшен."
scraped_at: 2026-04-15
---
# Песочница

Песочница — это специальная среда API банка для тестирования запросов. В ней все данные заменены на тестовые, и отправленные запросы не влияют на продакшен.

## Доступ к песочнице

К песочнице не нужно получать отдельный доступ, достаточно немного изменить запросы:

-   Изменить URL с `https://enter.tochka.com/uapi` на `https://enter.tochka.com/sandbox/v2`.
-   Вместо токена для авторизации в заголовке `Authorization` использовать строку `sandbox.jwt.token`. Это значение даёт все разрешения для всех методов. Пример: `Authorization: Bearer sandbox.jwt.token`.  
    Любая другая строка в этом заголовке определяется как отсутствие разрешения на выполнения метода.

> **СОВЕТ**
> 
> Пример готового окружения для песочницы есть в нашей [коллекции запросов](https://developers.tochka.com/docs/tochka-api/kollekciya-zaprosov).

## Реализованные методы

Сейчас в песочнице можно вызвать все методы из следующих разделов:

-   [Работа со счетами](https://developers.tochka.com/docs/tochka-api/api/rabota-so-schetami)
-   [Работа с клиентами](https://developers.tochka.com/docs/tochka-api/api/rabota-s-klientami)
-   [Работа с балансами счетов](https://developers.tochka.com/docs/tochka-api/api/rabota-s-balansami-schetov)
-   [Работа с выписками](https://developers.tochka.com/docs/tochka-api/api/rabota-s-vypiskami)
-   [Работа с платежами](https://developers.tochka.com/docs/tochka-api/api/rabota-s-platezhami)
-   [Сервис СБП: Работа с ЮЛ](https://developers.tochka.com/docs/tochka-api/api/servis-sbp-rabota-s-yul)
-   [Сервис СБП: Работа с ТСП](https://developers.tochka.com/docs/tochka-api/api/servis-sbp-rabota-s-tsp)
-   [Сервис СБП: Работа с QR-кодами](https://developers.tochka.com/docs/tochka-api/api/servis-sbp-rabota-s-qr-kodami)
-   [Сервис СБП: Работа с возвратами](https://developers.tochka.com/docs/tochka-api/api/servis-sbp-rabota-s-vozvratami)
-   [Работа с выставлением счетов](https://developers.tochka.com/docs/tochka-api/api/rabota-s-vystavleniem-schetov)
-   [Работа с закрывающими документами](https://developers.tochka.com/docs/tochka-api/api/rabota-s-zakryvayushimi-dokumentami)
-   [Работа с платёжными ссылками](https://developers.tochka.com/docs/tochka-api/api/rabota-s-platyozhnymi-ssylkami)
