---
source: https://developers.tochka.com/docs/tochka-api/changelog
title: "Обновления API"
description: "27.03.2026"
scraped_at: 2026-04-15
---
# Обновления API

## 27.03.2026

В вебхуке [acquiringInternetPayment](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki) появилось поле `paymentLinkId` — номер заказа, который вы передаёте при создании [платёжной ссылки](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki) или [подписки](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/podpiski-rekurrentnye-platezhi).

Пожалуйста, помните, что при каждом создании платёжной ссылки или подписки в поле `paymentLinkId` нужно указывать уникальное значение.

## 04.03.2026

С помощью метода [Create Closing Document](https://developers.tochka.com/docs/tochka-api/api/create-closing-document-invoice-v-1-0-closing-documents-post) теперь можно создать новый вид [закрывающих документов](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vystavlenie-schetov-i-sozdanie-zakryvayushih-dokumentov) — универсальный передаточный документ (УПД):

-   УПД СЧФДОП — такой УПД заменяет комплект «счёт-фактура + акт или накладная»
-   УПД ДОП — его можно использовать вместо накладной или акта выполненных работ

## 05.02.2026

-   В ответе метода [Create Payment For Sign](https://developers.tochka.com/docs/tochka-api/api/create-payment-for-sign-payment-v-1-0-for-sign-post) появилось поле `Data.redirectUrl`. Оно содержит ссылку, по которой можно перейти в интернет-банк к созданной платёжке — как это было у метода Create Payment.
    
-   Метод Create Payment больше неактуален и перестанет работать с 27 февраля.
    

## 26.09.2025

-   Добавили возможность оплатить заказ частями через сервис «[Долями](https://dolyame.ru)» при переходе по платёжной ссылке. Для этого при создании платёжной ссылки методом [Create Payment Operation](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-acquiring-v-1-0-payments-post) или [Create Payment Operation With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-with-receipt-acquiring-v-1-0-payments-with-receipt-post) в массиве `Data.Operation[].paymentMode[]` укажите значение `dolyame`.  
    Как и при других оплатах, при платеже Долями мы отправим вебхук `acquiringInternetPayment`. Узнать, какие в нём будут данные, можно в [описании вебхука](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki).
    
-   При создании платёжной ссылки или подписки можно указать идентификатор заказа — в необязательном поле `Data.paymentLinkId`. Значение должно быть уникальным. Если не передать его, интернет-эквайринг автоматически заполнит это поле порядковым номером. Актуально для методов:
    
    -   [Create Payment Operation](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-acquiring-v-1-0-payments-post)
    -   [Create Payment Operation With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-with-receipt-acquiring-v-1-0-payments-with-receipt-post)
    -   [Create Subscription](https://developers.tochka.com/docs/tochka-api/api/create-subscription-acquiring-v-1-0-subscriptions-post)
    -   [Create Subscription With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-subscription-with-receipt-acquiring-v-1-0-subscriptions-with-receipt-post)

## 17.09.2025

-   В методах [Create Payment Operation With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-with-receipt-acquiring-v-1-0-payments-with-receipt-post) и [Create Subscription With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-subscription-with-receipt-acquiring-v-1-0-subscriptions-with-receipt-post) теперь можно указать поставщика для каждого товара — в объекте `Items.Supplier`.  
    Возможность добавить поставщика в отдельном объекте `Supplier` остаётся. Если использовать оба варианта одновременно, приоритет будет у `Items.Supplier`, а поставщик из отдельного объекта `Supplier` будет указан в чеке для товаров, у которых нет `Items.Supplier`.  
    Подробнее читайте в описании методов [создания платёжной ссылки](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki#c-%D1%84%D0%B8%D1%81%D0%BA%D0%B0%D0%BB%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B5%D0%B9-%D1%87%D0%B5%D0%BA%D0%BE%D0%B2-%D0%BE%D1%82-%D0%BF%D0%B0%D1%80%D1%82%D0%BD%D1%91%D1%80%D0%BE%D0%B2-%D1%82%D0%BE%D1%87%D0%BA%D0%B8) и [создания подписки](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/podpiski-rekurrentnye-platezhi#%D1%81-%D1%84%D0%B8%D1%81%D0%BA%D0%B0%D0%BB%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B5%D0%B9-%D1%87%D0%B5%D0%BA%D0%BE%D0%B2-%D0%BE%D1%82-%D0%BF%D0%B0%D1%80%D1%82%D0%BD%D1%91%D1%80%D0%BE%D0%B2-%D1%82%D0%BE%D1%87%D0%BA%D0%B8) с фискализацией чеков.
    
-   Добавлен метод [Get Payment Registry](https://developers.tochka.com/docs/tochka-api/api/get-payment-registry-acquiring-v-1-0-registry-get). С помощью него можно получить реестр платежей, выполненных через интернет-эквайринг. Узнать подробнее можно в [описании метода](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki#%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5-%D1%80%D0%B5%D0%B5%D1%81%D1%82%D1%80%D0%B0-%D0%BF%D0%BB%D0%B0%D1%82%D0%B5%D0%B6%D0%B5%D0%B9-%D0%BF%D0%BE-%D0%BF%D0%BB%D0%B0%D1%82%D1%91%D0%B6%D0%BD%D1%8B%D0%BC-%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D0%B0%D0%BC).
    

## 07.08.2025

-   Добавили возможность создавать платёжные ссылки с [двухэтапной оплатой](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki#%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5-%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D0%B8-%D1%81-%D0%B4%D0%B2%D1%83%D1%85%D1%8D%D1%82%D0%B0%D0%BF%D0%BD%D0%BE%D0%B9-%D0%BE%D0%BF%D0%BB%D0%B0%D1%82%D0%BE%D0%B9) — с помощью поля `preAuthorization` в методах [Create Payment Operation](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-acquiring-v-1-0-payments-post) и [Create Payment Operation With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-with-receipt-acquiring-v-1-0-payments-with-receipt-post).
-   В вебхуке с событием [acquiringInternetPayment](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki) у поля `status` появилось значение `AUTHORIZED`. Событие с таким статусом приходит после заморозки денег на счёте плательщика при [двухэтапной оплате](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki#%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5-%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D0%B8-%D1%81-%D0%B4%D0%B2%D1%83%D1%85%D1%8D%D1%82%D0%B0%D0%BF%D0%BD%D0%BE%D0%B9-%D0%BE%D0%BF%D0%BB%D0%B0%D1%82%D0%BE%D0%B9).

## 18.04.2025

-   Добавили в методы [Create Payment Operation](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-acquiring-v-1-0-payments-post) и [Create Payment Operation With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-with-receipt-acquiring-v-1-0-payments-with-receipt-post) параметр `ttl`, который позволяет задавать срок действия платёжной ссылки в минутах, и объект `Supplier`, в котором можно передавать данные поставщика.
-   Реализовали возможность создавать подписки без графика списания и с изменением суммы платежа. Для создания такой подписки в методах [Create Subscription](https://developers.tochka.com/docs/tochka-api/api/create-subscription-acquiring-v-1-0-subscriptions-post) и [Create Subscription With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-subscription-with-receipt-acquiring-v-1-0-subscriptions-with-receipt-post) нужно указывать boolean параметр `recurring` со значением `true`, а для списания денег — вызывать метод [Charge Subscription](https://developers.tochka.com/docs/tochka-api/api/charge-subscription-acquiring-v-1-0-subscriptions-operation-id-charge-post).
-   В методы [Get Payment Operation Info](https://developers.tochka.com/docs/tochka-api/api/get-payment-operation-info-acquiring-v-1-0-payments-operation-id-get) и [Get Payment Operation List](https://developers.tochka.com/docs/tochka-api/api/get-payment-operation-list-acquiring-v-1-0-payments-get) добавили параметр `paidAt`, который показывает время оплаты платёжной ссылки, и объект `Order`, содержащий информацию обо всех совершённых платежах и возвратах по платёжной ссылке.

## 31.03.2025

-   Добавили [метод для создания B2B QR-кодов](https://developers.tochka.com/docs/tochka-api/api/register-b-2-b-qr-code-sbp-v-1-0-b-2-b-qr-code-merchant-merchant-id-account-id-post), с которыми у вас появляется возможность принимать платежи от своих контрагентов в любое время дня и ночи.
-   Добавили [метод для получения информации](https://developers.tochka.com/docs/tochka-api/api/get-b-2-b-qr-code-sbp-v-1-0-b-2-b-qr-code-qrc-id-get) о созданных B2B QR-кодах.
-   Создали новый тип вебхука [incomingSbpB2BPayment](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki), чтобы вы всегда были в курсе поступающих по B2B QR-кодам платежей.
-   При [создании счёт-фактуры](https://developers.tochka.com/docs/tochka-api/api/create-closing-document-invoice-v-1-0-closing-documents-post) добавили объект `shipmentDocuments`, который подтверждает отгрузку товаров, работ или услуг.

## 11.02.2025

-   Добавили параметры `nds_5` и `nds_7` при [выставлении счетов и закрывающих документов](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vystavlenie-schetov-i-sozdanie-zakryvayushih-dokumentov).
-   Обновили вебхук [acquiringInternetPayment](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki), теперь в нём содержится больше полезной информации.

## 03.02.2025

-   Добавили в вебхук [incomingSbpPayment](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki) параметр refTransactionId, с помощью которого вы можете проводить возвраты по СБП.

## 23.12.2024

-   Добавили в методы [Create Payment Operation](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-acquiring-v-1-0-payments-post) и [Create Payment Operation With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-with-receipt-acquiring-v-1-0-payments-with-receipt-post) возможность принимать платежи через T-Pay. Для этого у торговой точки в интернет-банке нужно выбрать Т-Pay как способ для приёма платежей, а в методах API использовать параметр paymentMode: tinkoff.
-   Обогатили данными метод [Get Retailers](https://developers.tochka.com/docs/tochka-api/api/get-retailers-acquiring-v-1-0-retailers-get): теперь он отдаёт информацию о возможных способах оплаты и наличии онлайн-касс.

## 06.12.2024

-   Добавили новые методы для работы с подписками в интернет-эквайринге. С их помощью вы сможете создавать подписки (рекуррентные платежи) на определённый период, чтобы в течение этого периода у вашего покупателя списывались деньги с банковской карты.
-   Добавили необязательное поле `merchantId` в метод [Create Payment Operation](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-acquiring-v-1-0-payments-post). Это поле необходимо заполнять, если у вас есть несколько торговых точек в интернет-эквайринге. Оно позволяет нам понять, по какой торговой точке будут происходить зачисления на ваш счёт.
-   Исправили задержки при отправке вебхуков, теперь они работают еще быстрее.
-   Добавили новые методы в песочницу и коллекцию запросов Postman.
-   Создали метод [Get Payment For Sign List](https://developers.tochka.com/docs/tochka-api/api/get-payment-for-sign-list-payment-v-1-0-for-sign-get), который позволяет просматривать все платежи из раздела «На подпись» интернет-банка.
-   Обновили дизайн раздела «Интеграции и API» в интернет-банке.
-   По каждому обновлению добавили информацию в документацию, чтобы вам было легче разобраться с нашим API.

## 30.05.2024

-   Добавили методы по работе с [кассовыми QR-кодами](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/sbp-sistema-bystryh-platezhej).
-   Обновили методы по работе с платёжными ссылками, выставлением счетов и закрывающих документов в [песочнице](https://developers.tochka.com/docs/tochka-api/pesochnica).
-   Добавили необязательный параметр `email` в метод [Create Payment For Sign](https://developers.tochka.com/docs/tochka-api/api/create-payment-for-sign-payment-v-1-0-for-sign-post).

## 22.05.2024

-   Добавили новый метод по работе с платёжными ссылками [Create Payment Operation With Receipt](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-with-receipt-acquiring-v-1-0-payments-with-receipt-post). Он позволяет формировать ссылки на оплату с автоматической фискализацией чеков от партнёров Точки.

## 05.04.2024

Создали четыре новых метода для работы с выставлением счетов и формированием закрывающих документов:

-   [Delete Invoice](https://developers.tochka.com/docs/tochka-api/api/delete-invoice-invoice-v-1-0-bills-customer-code-document-id-delete) — для удаления счёта.
-   [Send Invoice To Email](https://developers.tochka.com/docs/tochka-api/api/send-invoice-to-email-invoice-v-1-0-bills-customer-code-document-id-email-post) — для отправки счёта в PDF на электронную почту.
-   [Delete Closing Documents](https://developers.tochka.com/docs/tochka-api/api/delete-closing-documents-invoice-v-1-0-closing-documents-customer-code-document-id-delete) — для удаления закрывающих документов.
-   [Send Closing Documents To Email](https://developers.tochka.com/docs/tochka-api/api/send-closing-documents-to-email-invoice-v-1-0-closing-documents-customer-code-document-id-email-post) — для отправки закрывающих документов на электронную почту.

## 01.02.2024

-   Добавили новый тип вебхука [outgoingPayment](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki) для получения уведомлений об исходящих платежах.
-   Добавили новый параметр в методы [Get Statements List](https://developers.tochka.com/docs/tochka-api/api/get-statements-list-open-banking-v-1-0-statements-get) и [Get Statement](https://developers.tochka.com/docs/tochka-api/api/get-statement-open-banking-v-1-0-accounts-account-id-statements-statement-id-get), а также в вебхук типа incomingPayment. Это paymentId — уникальный идентификатор платежа.
-   Сделали обязательным поле purpose в методе [Create Payment Operation](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-acquiring-v-1-0-payments-post).
-   Обновили в документации пример тела вебхука по событию incomingPayment.
-   Доработали методы для выставления счетов и формирования закрывающих документов. Поле `totalNds` больше не является обязательным.

## 08.12.2023

-   Добавили методы для выставления счетов на оплату и создания закрывающих документов. Также с помощью API теперь можно получить PDF с выставленными счетами и закрывающими документами, а также посмотреть статус оплаты счетов.
-   Создали метод [Get Authorized Card Transactions](https://developers.tochka.com/docs/tochka-api/api/get-authorized-card-transactions-open-banking-v-1-0-accounts-account-id-authorized-card-transactions-get), который позволяет получать информацию о карточных операциях, находящихся в резерве.
-   Обновили разрешения для работы с вебхуками — теперь для создания, удаления или изменения вебхука нужно использовать разрешение [ManageWebhookData](https://developers.tochka.com/docs/tochka-api/api/tochka-api). Существующие вебхуки продолжат свою работу, но для новых интеграций необходимо использовать новое разрешение.

## 20.11.2023

-   Добавлена возможность работы с [платёжными ссылками](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki),
-   в методах [Get Balance Info](https://developers.tochka.com/docs/tochka-api/api/get-balance-info-open-banking-v-1-0-accounts-account-id-balances-get) и [Get Balances List](https://developers.tochka.com/docs/tochka-api/api/get-balances-list-open-banking-v-1-0-balances-get) появился новый тип баланса — OverdraftAvailable.
-   В методе Create Payment обновлён способ авторизации для проведения платежа.
-   Из документации и коллекции запросов в Postman удалены неактуальные методы.

## 07.07.2023

-   Добавили в метод [Register Qr Code](https://developers.tochka.com/docs/tochka-api/api/register-qr-code-sbp-v-1-0-qr-code-merchant-merchant-id-account-id-post) необязательный атрибут - redirectUrl.  
    С помощью этого атрибута вы сможете перенаправить покупателя после оплаты по QR-коду на ваш сайт или приложение.

## 27.06.2023

-   Удалили из документации устаревшие методы для работы в СБП.

## 26.04.2023

После получения Точкой банковской лицензии мы изменили несколько методов:

-   В методе для получения информации о клиенте в СБП [Get Customer Info](https://developers.tochka.com/docs/tochka-api/api/get-customer-info-sbp-v-1-0-customer-customer-code-bank-code-get) теперь необходимо передавать bankCode — БИК банка.
-   В теле запроса метода для регистрации клиента в СБП [Register Legal Entity](https://developers.tochka.com/docs/tochka-api/api/register-legal-entity-sbp-v-1-0-register-sbp-legal-entity-post) теперь нужно будет передавать bankCode — БИК банка.
-   В методе для получения данных о QR-коде и ТСП по идентификатору QR-кода Get Qr Code Payment Data изменился эндпоинт запроса.  
    Предыдущие методы объявлены **deprecated** и в ближайшее время перестанут работать.

## 13.04.2023

-   Обновили тело вебхука по событию icomingSbpPayment, чтобы подпись корректно валидировалась с нашим публичным ключом openAPI.
-   Удалили проверку длины названия юридического лица при запросе выписки.
-   Добавили ограничение на попытки отправлять вебхук и создали проверку доступности URL вебхука при его создании или обновлении: если на отправленный вебхук мы не получили ответ с кодом состояния HTTP 200, а получили любой другой код, то будем отправлять его повторно 30 раз с периодичностью в 10 секунд.  
    Для проверки доступности указанного вами хоста при создании или изменении вебхука мы отправим на ваш URL по одному тестовому вебхуку на каждое из событий, на которые вы подписаны.  
    Если в статусе ответа не придёт код HTTP 200, то вебхук не будет создан или изменён.
-   Добавили в песочницу все методы по работе в СБП, теперь вы сможете отладить работу с QR-кодами без регистрации QR-кодов на боевом слое.

## 01.02.2023

-   Добавили пример с телом вебхука по событиям icomingPayment и icomingSbpPayment.
-   Теперь при регистрации QR-кода на несуществующий merchantId мы отдаём ошибку 403 — forbidden by consent.
-   Добавили для работы с API БИК Точки.
-   Исправили ошибку в методах [Get Balance Info](https://developers.tochka.com/docs/tochka-api/api/get-balance-info-open-banking-v-1-0-accounts-account-id-balances-get) и [Get Balances List](https://developers.tochka.com/docs/tochka-api/api/get-balances-list-open-banking-v-1-0-balances-get) — мы отдавали accountId без значения БИК.
-   Поправили ошибку метода [Start Refund](https://developers.tochka.com/docs/tochka-api/api/start-refund-sbp-v-1-0-refund-post), которая позволяла вернуть деньги по чужому QR-коду.

## 13.12.2022

-   Обновили в документации описание всех методов, чтобы вам было проще разобраться в нашем API.

## 20.10.2022

-   Вы просили, мы сделали: добавили [JWT-токен](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-s-jwt-tokenom) для упрощённой авторизации. А ещё он избавляет от необходимости обновлять токены каждый день — просто подставьте сгенерированный ключ в заголовок -Authorization-.

## 18.07.2022

-   Добавили методы для работы с тендерными спецсчетами. Теперь вы сможете получать актуальный баланс спецсчёта и видеть, сколько денег и какими электронными торговыми площадками (ЭТП) заблокированы.

## 22.03.2022

-   Появился режим [песочницы](https://developers.tochka.com/docs/tochka-api/pesochnica). Сейчас доступны только основные методы.

## 24.02.2022

-   Появились методы на совершение возвратов сбп платежей и отслеживания их статуса. [Подробнее](https://developers.tochka.com/docs/tochka-api/api/servis-sbp-rabota-s-vozvratami).

## 01.12.2021

-   Теперь у нас есть вебхуки, подробнее можно прочитать [здесь](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki).

## 23.09.2021

-   В [методе](https://developers.tochka.com/docs/tochka-api/api/register-merchant-sbp-v-1-0-merchant-legal-entity-legal-id-post) регистрации ТСП в СБП теперь необходимо передавать customerCode как параметр, а не как заголовок.
-   В [методе](https://developers.tochka.com/docs/tochka-api/api/register-legal-entity-sbp-v-1-0-register-sbp-legal-entity-post) регистрации юрлица в СБП изменился адрес и набор параметров.

## 23.07.2021

-   Теперь сформировать ссылку для подписания списка разрешений можно передав в нее id разрешения, без необходимости генерировать jwt объект.

## 16.06.2021

-   В [выписке](https://developers.tochka.com/docs/tochka-api/api/rabota-s-vypiskami) появился баланс счёта на начало и конец запрашиваемого периода. Теперь вы можете посмотреть полную выписку: с начальными и итоговыми остатками на счёте.
-   В [методы](https://developers.tochka.com/docs/tochka-api/api/rabota-so-schetami) работы со счетами добавили поле `registrationDate` с датой открытия счёта. Можно запросить выписку за весь период работы, отдельно вводить дату открытия счёта не нужно.

## 21.05.2021

-   Обновили [метод](https://developers.tochka.com/docs/tochka-api/api/get-statement-open-banking-v-1-0-accounts-account-id-statements-statement-id-get) работы с выписками. Теперь в поле _amountNat_ лежит сумма транзакции в рублях, а в _amount_ — в валюте счёта.
-   Для методов Create-payment и [Payment-for-sign](https://developers.tochka.com/docs/tochka-api/api/create-payment-for-sign-payment-v-1-0-for-sign-post) добавили валидацию полей. Проверяем все поля перед отправкой платежа в банк. Если будет какая-то ошибка, вы сразу сможете показать её тому, кто создаёт платёж.

## 12.04.2021

-   Добавлена валидация поля окончания срока действия разрешения `expirationDateTime`. Теперь нельзя указать дату меньше текущей.

## 25.02.2021

-   Добавили метод создания и подписания платежа. Теперь подписывать платежи можно через API, не заходя в интернет-банк.

## 10.02.2021

-   Добавили новый [метод](https://developers.tochka.com/docs/tochka-api/api/get-qr-codes-payment-status-sbp-v-1-0-qr-codes-qrc-ids-payment-status-get) запроса статуса платежей для СБП, который работает быстрее.

## 10.11.2020

-   Добавили [метод](https://developers.tochka.com/docs/tochka-api/api/create-payment-for-sign-payment-v-1-0-for-sign-post) создания платежа на подпись. Теперь можно формировать платежи и отправлять их напрямую в интернет-банк. Подписать такие платежи пока можно только в интернет-банке.

## 08.10.2020

-   Добавили [методы](https://developers.tochka.com/docs/tochka-api/api/rabota-s-balansami-schetov) работы с балансами: вы можете получить остаток по счетам на текущий день.
-   Добавили [методы](https://developers.tochka.com/docs/tochka-api/api/rabota-s-vypiskami) работы с выписками: можно получать движения по счетам через API, необязательно заходить в интернет-банк.
