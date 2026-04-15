---
source: https://developers.tochka.com/docs/tochka-api/algoritm-raboty-po-oauth-2.0
title: "Авторизация по OAuth 2.0"
description: "Принцип работы"
scraped_at: 2026-04-15
---
# Авторизация по OAuth 2.0

## Принцип работы

1.  [Зарегистрируйте своё приложение](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-po-oauth-2.0#%D0%B7%D0%B0%D1%80%D0%B5%D0%B3%D0%B8%D1%81%D1%82%D1%80%D0%B8%D1%80%D1%83%D0%B9%D1%82%D0%B5-%D1%81%D0%B2%D0%BE%D1%91-%D0%BF%D1%80%D0%B8%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5). В ответ вы получите `client_id` и `client_secret`, с которыми и будете запрашивать данные;
2.  [Получите токен для работы с разрешениями](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-po-oauth-2.0#%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D0%B5-%D1%82%D0%BE%D0%BA%D0%B5%D0%BD-%D0%B4%D0%BB%D1%8F-%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B-%D1%81-%D1%80%D0%B0%D0%B7%D1%80%D0%B5%D1%88%D0%B5%D0%BD%D0%B8%D1%8F%D0%BC%D0%B8);
3.  [Задайте разрешения](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-po-oauth-2.0#%D0%B7%D0%B0%D0%B4%D0%B0%D0%B9%D1%82%D0%B5-%D1%80%D0%B0%D0%B7%D1%80%D0%B5%D1%88%D0%B5%D0%BD%D0%B8%D1%8F);
4.  [Сформируйте запрос на подписание списка разрешений и попросите пользователя подтвердить список](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-po-oauth-2.0#%D1%81%D1%84%D0%BE%D1%80%D0%BC%D0%B8%D1%80%D1%83%D0%B9%D1%82%D0%B5-%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81-%D0%BD%D0%B0-%D0%BF%D0%BE%D0%B4%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5-%D1%81%D0%BF%D0%B8%D1%81%D0%BA%D0%B0-%D1%80%D0%B0%D0%B7%D1%80%D0%B5%D1%88%D0%B5%D0%BD%D0%B8%D0%B9-%D0%B8-%D0%BF%D0%BE%D0%BF%D1%80%D0%BE%D1%81%D0%B8%D1%82%D0%B5-%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F-%D0%BF%D0%BE%D0%B4%D1%82%D0%B2%D0%B5%D1%80%D0%B4%D0%B8%D1%82%D1%8C-%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA);
5.  [Обменяйте код на токен для доступа к API](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-po-oauth-2.0#%D0%BE%D0%B1%D0%BC%D0%B5%D0%BD%D1%8F%D0%B9%D1%82%D0%B5-%D0%BA%D0%BE%D0%B4-%D0%BD%D0%B0-%D1%82%D0%BE%D0%BA%D0%B5%D0%BD-%D0%B4%D0%BB%D1%8F-%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%B0-%D0%BA-api);
6.  [Обменяйте refresh токен на новую пару access/refresh токенов](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-po-oauth-2.0#%D0%BE%D0%B1%D0%BC%D0%B5%D0%BD%D1%8F%D0%B9%D1%82%D0%B5-refresh-%D1%82%D0%BE%D0%BA%D0%B5%D0%BD-%D0%BD%D0%B0-%D0%BD%D0%BE%D0%B2%D1%83%D1%8E-%D0%BF%D0%B0%D1%80%D1%83-accessrefresh-%D1%82%D0%BE%D0%BA%D0%B5%D0%BD%D0%BE%D0%B2);
7.  [При необходимости проверьте Access Token Hybrid](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-po-oauth-2.0#%D0%BA%D0%B0%D0%BA-%D0%BF%D1%80%D0%BE%D0%B2%D0%B5%D1%80%D0%B8%D1%82%D1%8C-access-token-hybrid).

Также можно настроить интеграцию упрощённым методом с помощью [веб-токена](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-s-jwt-tokenom)

### Простая схема

На схеме представлен общий флоу работы от первого запроса разрешений до получения результата. Пройти этот путь нужно только один раз, чтобы создать токен oAuth.

Далее добавляйте `Access Token Hybrid` в заголовок `Authorization: Bearer <Access Token Hybrid>` при совершении запросов.

### Модель запросов

При совершении запросов всегда нужно добавлять токен в заголовок авторизации. Если вы создаёте запрос по компании, обязательно указывайте идентификатор этой компании в заголовке `CustomerCode`. Запросить список компаний клиента можно вот [так](https://developers.tochka.com/docs/tochka-api/api/get-customers-list-open-banking-v-1-0-customers-get).

## Зарегистрируйте своё приложение

Если у вашей компании ещё нет счёта в Точка Банке, оставьте заявку на нашем [сайте](https://tochka.com/public-api/). Мы свяжемся с вами в течение 2 рабочих дней, а затем отправим необходимые данные на вашу электронную почту.

Если вы уже работаете в Точка Банке, зарегистрируйте приложение в интернет-банке: раздел «Интеграции и API» — [«Подключить»](https://i.tochka.com/bank/services/m/integration/new). Нажмите на кнопку «Зарегистрировать oAuth 2.0 приложение» и выберите необходимые разрешения для приложения.

## Получите токен для работы с разрешениями

Пройти oAuth авторизацию по принципу `client_credentials`.

### Примеры запросов

Пример запроса Партнёр -> Точка Банк:

```
curl --request POST 'https://enter.tochka.com/connect/token' \--header 'Content-Type: application/x-www-form-urlencoded' \--data-urlencode 'client_id=test_app' \--data-urlencode 'client_secret=test_secret' \--data-urlencode 'grant_type=client_credentials' \--data-urlencode 'scope=accounts balances customers statements sbp payments' 
```

Пример ответа:

```
{    "token_type": "bearer",    "access_token": "p6awaKAleytQh6mKc61vXd22YniDerme",    "expires_in": 86400}
```

## Задайте разрешения

`expirationDateTime` — это срок действия разрешений. Если нужны бессрочные, не передавайте этот параметр.

### Примеры запросов

Пример запроса Партнёр -> Точка Банк:

```
curl --request POST 'https://enter.tochka.com/uapi/v1.0/consents' \--header 'Authorization: Bearer p6awaKAleytQh6mKc61vXd22YniDerme' \--header 'Content-Type: application/json' \--data-raw '{  "Data": {    "permissions": [      "ReadAccountsBasic",      "ReadAccountsDetail",      "MakeAcquiringOperation",      "ReadAcquiringData",      "ReadBalances",      "ReadStatements",      "ReadCustomerData",      "ReadSBPData",      "EditSBPData",      "CreatePaymentForSign",      "CreatePaymentOrder",      "ManageWebhookData",      "ManageInvoiceData"    ],    "expirationDateTime": "2030-10-03T00:00:00+00:00"  }}'
```

Пример ответа:

```
{    "Data": {        "status": "AwaitingAuthorisation",        "creationDateTime": "2024-01-10T11:40:16.941480+00:00",        "statusUpdateDateTime": "2024-01-10T11:40:16.941498+00:00",        "permissions": [            "ReadAccountsBasic",            "ReadAccountsDetail",            "MakeAcquiringOperation",            "ReadAcquiringData",            "ReadBalances",            "ReadStatements",            "ReadCustomerData",            "ReadSBPData",            "EditSBPData",            "CreatePaymentForSign",            "CreatePaymentOrder",            "ManageWebhookData",            "ManageInvoiceData"        ],        "consentId": "705ba15f-a109-4156-bb7f-50c21413c158",        "applicationName": "test_name",        "clientId": "test_app"    },    "Links": {        "self": "https://enter.tochka.com/uapi/v1.0/consents"    },    "Meta": {        "totalPages": 1    }}
```

## Сформируйте запрос на подписание списка разрешений и попросите пользователя подтвердить список

Сформируйте ссылку для подтверждения списка разрешений и перенаправьте пользователя на неё. В параметрах нужно передать следующий набор:

-   client\_id — идентификатор клиента;
-   response\_type — код авторизации;
-   state — произвольная строка (подойдёт для связи запроса и ответа, то есть идентификации клиента);
-   redirect\_uri — URI, предварительно зарегистрированный на авторизационном сервере. На него перенаправим пользователя;
-   scope — `accounts balances customers statements sbp payments acquiring` то есть запрашиваемая область действия токена доступа;
-   consent\_id — id разрешения из ответа с предыдущего шага.

Пример URL, куда направляем пользователя:

```
https://enter.tochka.com/connect/authorize?client_id=test_app&response_type=code&state=Vuihvsds&redirect_uri=http://localhost:8000/&scope=accounts%20balances%20customers%20statements%20sbp%20payments&consent_id=705ba15f-a109-4156-bb7f-50c21413c158
```

## Обменяйте код на токен для доступа к API

Подхватываем пользователя на `redirect_uri` и меняем код на токен запросом:

```
curl --request POST 'https://enter.tochka.com/connect/token' \--header 'Content-Type: application/x-www-form-urlencoded' \--data-urlencode 'client_id=test_app' \--data-urlencode 'client_secret=test_secret' \--data-urlencode 'grant_type=authorization_code' \--data-urlencode 'scope=accounts balances customers statements sbp payments' \--data-urlencode 'code=' \--data-urlencode 'redirect_uri=http://localhost:8000/'
```

Ответ:

```
{    "access_token": "JlvB7rgB0Q9vuuh0YNVQ4hBkGChIqovR",    "refresh_token": "ViYnf8sDILwKpvUMcIQJEqCYy88zW1ys",    "token_type": "bearer",    "expires_in": 86400,    "state": "Vuihvsds",    "user_id": "b00b0f00-00b0-00cd-a0e0-642162432000" }
```

## Обменяйте refresh токен на новую пару access/refresh токенов

Для обмена токена выполните запрос:

```
curl --request POST 'https://enter.tochka.com/connect/token' \--header 'Content-Type: application/x-www-form-urlencoded' \--data-urlencode 'client_id=test_app' \--data-urlencode 'client_secret=test_secret' \--data-urlencode 'grant_type=refresh_token' \--data-urlencode 'refresh_token=ViYnf8sDILwKpvUMcIQJEqCYy88zW1ys'
```

Ответ:

```
{    "access_token": "scD56TmsyrCV9kpExKlY2p61BrCY0tNj",    "refresh_token": "7lsLqrr2ug3j4KPPWgkUC8zPQ9W2HKH6",    "token_type": "bearer",    "expires_in": 86400,    "state": null,    "user_id": "b00b0f00-00b0-00cd-a0e0-642162432000"}
```

## Как проверить Access Token Hybrid

Для этого проверьте аутентификацию клиента по полученному токену. В ответе будет [jwt](https://jwt.io/introduction), в котором зашифрован Customer Code (sub) и Client ID (aud). Этот метод — не обязательный для работы с API.

```
curl --request POST 'https://enter.tochka.com/connect/introspect' \--header 'Content-Type: application/x-www-form-urlencoded' \--data-urlencode 'access_token=dnjsndamklcmda8n3m2jkndsa76'
```

Ответ:

```
"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.ewogICJpc3MiOiAiZW50ZXIudG9jaGthLmNvbSIsCiAgInN1YiI6ICIzMDk4NzY1NDMiLAogICJhdWQiOiAiQU1KanMzbmFkamFuMjFqa2Exc211NyIKfQ.vPOLUlTzMm3HJz4D76JfO3Y8dJHf57v2oMMhbWJowVqAIhs2wAAOGouORzoo2Az28bbEYxaHeITDpMWg035UVwGQYskL7qeFBO2m5bFlPoAnt1RyFMblhjG8iLb5yAFWtJUD1tyJDR1FYAdJshVMddY4_ZDyMUIK3fJElbr2xAWuk_cX9Y5hoGe1plB0JpWLEgPaFuB9TjCjvpz9sWbMBvczC3bx_07-t0I8Jodh82THaz7o63IctEwlJ3vqNyr4l01JA6cZidmpAgQJ-448wQbOWBT_WOHMHWwc2EuQy1vDni3jHm6AvWlnnXJyKGBXClMqpj67m2lpuPfIoqyC_g"
```
