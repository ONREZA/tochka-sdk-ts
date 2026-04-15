---
source: https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vystavlenie-schetov-i-sozdanie-zakryvayushih-dokumentov
title: "Создание счетов и закрывающих документов"
description: "Для расчётов в B2B-сфере нужны специальные документы — чтобы всё было прозрачно для налоговой, а у сторон сделки было подтверждение её успешного завершения:"
scraped_at: 2026-04-15
---
# Создание счетов и закрывающих документов

Для расчётов в B2B-сфере нужны специальные документы — чтобы всё было прозрачно для налоговой, а у сторон сделки было подтверждение её успешного завершения:

-   Счёт на оплату — для оплаты сделки
-   Закрывающие документы — чтобы подтвердить факт передачи товаров или оказания услуг

## Счёт на оплату

Счёт на оплату — это документ, который продавец отправляет покупателю для оплаты. Он содержит список товаров или услуг, сумму к оплате, реквизиты покупателя и прочую информацию.

Чтобы создать счёт на оплату, используйте метод [Create Invoice](https://developers.tochka.com/docs/tochka-api/api/create-invoice-invoice-v-1-0-bills-post):

-   В поле `accountId` укажите идентификатор вашего расчётного счёта в Точка Банке.
-   В поле `customerCode` — ваш идентификатор. Его можно узнать с помощью метода [Get Customers List](https://developers.tochka.com/docs/tochka-api/api/get-customers-list-open-banking-v-1-0-customers-get) — из объекта с `"customerType": "Business"`.
-   В объекте `SecondSide` передайте данные покупателя, которому вы выставляете счёт. Они нужны, чтобы покупатель был уверен, что счёт выставлен именно ему и не пришёл по ошибке. Реквизиты вашего счёта для оплаты есть у покупателя в договоре, который вы с ним заключили.
-   В объекте `Content` — данные товаров или услуг и счёта.

> **ИНФО**
> 
> Созданный счёт нужно подписать и поставить в него печать. Это можно сделать в интернет-банке в разделе «[Документооборот](https://i.tochka.com/bank/m/document_flow)».

В ответе метода [Create Invoice](https://developers.tochka.com/docs/tochka-api/api/create-invoice-invoice-v-1-0-bills-post) придёт идентификатор счёта — в поле `documentId`. Его можно использовать, чтобы:

-   Отправить счёт на электронную почту контрагента — [Send Invoice To Email](https://developers.tochka.com/docs/tochka-api/api/send-invoice-to-email-invoice-v-1-0-bills-customer-code-document-id-email-post).
-   Получить счёт в формате PDF — [Get Invoice](https://developers.tochka.com/docs/tochka-api/api/get-invoice-invoice-v-1-0-bills-customer-code-document-id-file-get).
-   Удалить счёт — [Delete Invoice](https://developers.tochka.com/docs/tochka-api/api/delete-invoice-invoice-v-1-0-bills-customer-code-document-id-delete).
-   Узнать статус оплаты счёта — [Get Invoice Payment Status](https://developers.tochka.com/docs/tochka-api/api/get-invoice-payment-status-invoice-v-1-0-bills-customer-code-document-id-payment-status-get). Возможные статусы:
    -   `payment_waiting` — счёт ещё не был оплачен
    -   `payment_expired` — оплата счёта просрочена (статус возможен только если при создании счёта вы указали срок его оплаты в поле `paymentExpiryDate`)
    -   `payment_paid` — счёт оплачен

> **ИНФО**
> 
> Чтобы статус счёта сменился автоматически, мы сопоставляем входящие платежи со счётом по ИНН контрагента, сумме и наличию номера счёта в назначении платежа:
> 
> -   Если эти данные есть в платеже и соответствуют данным в счёте на оплату, статус счёта поменяется
> -   Если хотя бы один из этих пунктов отличается — статус не изменится
> 
> Статус оплаты счёта можно изменить вручную в интернет-банке — в разделе «[Документооборот](https://i.tochka.com/bank/m/document_flow)».

## Закрывающие документы

Чтобы подтвердить факт передачи товаров или оказания услуг, существует несколько разных документов. Чаще всего нужны:

-   [Счёт-фактура](https://tochka.com/knowledge/edo/chto-takoe-schyot-faktura/) — документ, который отражает сумму НДС за купленные товары или услуги и используется покупателем для налогового вычета. Счёт-фактуру нужно создать в течение 5 дней после завершения сделки. Дата создания акта или накладной и счёта-фактуры может отличаться максимум на 5 дней.
-   [Акт выполненных работ](https://tochka.com/knowledge/edo/akt-vypolnennyh-rabot-chto-ehto-takoe-i-kak-zapolnit/), который подтверждает факт предоставления услуг. Обычно его создают после выполнения работ или при их приёмке.
-   [Накладная ТОРГ-12](https://tochka.com/knowledge/edo/chto-takoe-nakladnaya-i-zachem-nuzhna/#tovarnaya-nakladnaya-torg-12) — товарная накладная, которую обычно используют, чтобы подтвердить передачу товаров.
-   [Универсальный передаточный документ (УПД)](https://tochka.com/knowledge/edo/chto-takoe-upd-i-zachem-nuzhen/) — документ, который объедиянет функции счёта-фактуры, а также акта или накладной. С помощью УПД обычно оформляют поставку товаров, передачу имущественных прав или оказание услуг. По API можно создать два вида УПД:
    -   УПД СЧФДОП — объединяет в себе счёт-фактуру и закрывающий документ. С помощью такого УПД покупатель может получить вычет НДС, не предоставляя налоговой отдельный счёт-фактуру.
    -   УПД ДОП — может заменить накладную или акт выполненных работ, но не отображает уплаченный НДС и не подойдёт для налогового вычета.

Какие из документов использовать, зависит от сферы вашего бизнеса, сделки, системы налогообложения и других деталей.

> **СОВЕТ**
> 
> Узнать, какие закрывающие документы нужны в вашем случае, вы можете в нашей [Бизнес-энциклопедии](https://tochka.com/knowledge/edo/zakryvayushchie-dokumenty-chto-eto-kogda-nuzhny-i-kak-pravilno-sostavit).

Чтобы создать закрывающий документ, используйте метод [Create Closing Document](https://developers.tochka.com/docs/tochka-api/api/create-closing-document-invoice-v-1-0-closing-documents-post):

-   В поле `accountId` укажите идентификатор вашего расчётного счёта в Точка Банке.
-   В поле `customerCode` — ваш идентификатор. Его можно узнать с помощью метода [Get Customers List](https://developers.tochka.com/docs/tochka-api/api/get-customers-list-open-banking-v-1-0-customers-get) — из объекта с `"customerType": "Business"`.
-   В объекте `SecondSide` передайте данные покупателя, которому вы выставляете счёт. Они нужны, чтобы покупатель был уверен, что счёт выставлен именно ему и не пришёл по ошибке.
-   В поле `documentId` — идентификатор счёта на оплату, если вам нужно связать с ним закрывающий документ.
-   В объекте `Content` — данные товаров или услуг. Обратите внимание, для разных закрывающих документов предусмотрены разные дочерние объекты внутри `Content`:
    -   `Act` — для акта выполненных работ
    -   `PackingList` — для накладной ТОРГ-12
    -   `Invoicef` — для счёта-фактуры
    -   `Upd` — для УПД
-   Если вы создаёте УПД, укажите его вид в поле `Data.Content.Upd.Positions.function`:
    -   `schfdop` — чтобы создать УПД СЧФДОП
    -   `dop` — чтобы создать УПД ДОП

В ответе метода придёт идентификатор документа — в поле `documentId`. Его можно использовать, чтобы:

-   Получить созданный документ в формате PDF — [Get Closing Document](https://developers.tochka.com/docs/tochka-api/api/get-closing-document-invoice-v-1-0-closing-documents-customer-code-document-id-file-get)
-   Отправить закрывающий документ на электронную почту — [Send Closing Documents To Email](https://developers.tochka.com/docs/tochka-api/api/send-closing-documents-to-email-invoice-v-1-0-closing-documents-customer-code-document-id-email-post)
-   Удалить документ — [Delete Closing Documents](https://developers.tochka.com/docs/tochka-api/api/delete-closing-documents-invoice-v-1-0-closing-documents-customer-code-document-id-delete)
