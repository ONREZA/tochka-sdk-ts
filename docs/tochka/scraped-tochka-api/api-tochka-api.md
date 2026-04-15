---
source: https://developers.tochka.com/docs/tochka-api/api/tochka-api
title: "Tochka.API"
description: "Подключая API, вы соглашаетесь на условия [оферты](https://tochka.com/links/offer-open-api)"
scraped_at: 2026-04-15
---
# Tochka.API

Version: v1.90.3-stable

Подключая API, вы соглашаетесь на условия [оферты](https://tochka.com/links/offer-open-api)

[Скачать](https://enter.tochka.com/doc/openapi/swagger.json) OpenAPI спецификацию

## Authentication

-   OAuth 2.0: Необходимые разрешения

<table><tbody><tr><th><p>Security Scheme Type:</p></th><td><p>oauth2</p></td></tr><tr><th><p>OAuth Flow (password):</p></th><td><div><p>Token URL: <a href="https://enter.tochka.com/connect/token" target="_blank" rel="noopener noreferrer">https://enter.tochka.com/connect/token</a></p></div><span><p>Scopes:</p><ul><li><p>ReadAccountsBasic: Получение базовой информации о счёте</p></li><li><p>ReadAccountsDetail: Получение детальной информации о счёте</p></li><li><p>ReadBalances: Получение баланса</p></li><li><p>ReadStatements: Получение выписок по счету</p></li><li><p>ReadCustomerData: Получение информации о клиенте</p></li><li><p>ReadSBPData: Получение информации в сервисе СБП</p></li><li><p>EditSBPData: Изменение информации в сервисе СБП</p></li><li><p>CreatePaymentForSign: Создание платежа на подпись</p></li><li><p>CreatePaymentOrder: Подписание платежа</p></li><li><p>ReadAcquiringData: Получение информации о платёжной ссылке</p></li><li><p>MakeAcquiringOperation: Совершение операций через платёжные ссылки</p></li><li><p>ManageInvoiceData: Выставление счетов и создание закрывающих документов</p></li><li><p>ManageWebhookData: Получение вебхуков</p></li></ul></span></td></tr></tbody></table>
