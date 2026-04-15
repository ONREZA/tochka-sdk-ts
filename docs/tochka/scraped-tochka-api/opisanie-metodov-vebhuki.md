---
source: https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki
title: "Вебхуки"
description: "Для работы с вебхуками должно быть выдано разрешение ManageWebhookData."
scraped_at: 2026-04-15
---
# Вебхуки

Для работы с вебхуками должно быть выдано разрешение `ManageWebhookData`.

Вебхуки нужны, чтобы получать уведомления о важных событиях в вашем сервисе или Телеграм-каналах, связанных с вашими счетами.

Вебхук — это POST-запрос на указанный URL, в теле которого находится JWT-токен в виде строки.  
Этот JWT-объект нужно расшифровать — алгоритм шифрования тела вебхука `RS256`.

Чтобы убедиться, что вебхук пришёл от Точка Банка, используйте наш [публичный ключ OpenAPI](https://enter.tochka.com/doc/openapi/static/keys/public).

Сейчас доступны пять видов событий:

-   `incomingPayment`
-   `outgoingPayment`
-   `incomingSbpPayment`
-   `incomingSbpB2BPayment`
-   `acquiringInternetPayment`.

incomingPayment — о входящих платежах

Вебхук нужен для отправки информации о входящих платежах.

В течение 20 секунд после каждого входящего платежа будет отправлено уведомление с основными данными:

-   реквизиты получателя и отправителя платежа
-   **purpose** — назначение
-   **amount** — сумма
-   **webhookType** — incomingPayment
-   **customerCode** - уникальный идентификатор клиента
-   **paymentId** — уникальный идентификатор платежа, который также содержится в выписке

**Пример с телом вебхука по событию incomingPayment:**

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJTaWRlUGF5ZXIiOiB7ImJhbmtDb2RlIjogIjAwMDAwMDAwMCIsICJiYW5rTmFtZSI6ICJcdTA0MWVcdTA0MWVcdTA0MWUgXHUwNDExXHUwNDMwXHUwNDNkXHUwNDNhIFx1MDQyMlx1MDQzZVx1MDQ0N1x1MDQzYVx1MDQzMCIsICJiYW5rQ29ycmVzcG9uZGVudEFjY291bnQiOiAiMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCAiYWNjb3VudCI6ICIwMDAwMDAwMDAwMDAwMDAwMDAwMCIsICJuYW1lIjogIlx1MDQxOFx1MDQxZiBcdTA0MjJcdTA0MzVcdTA0NDFcdTA0NDIiLCAiYW1vdW50IjogIjQwLjAiLCAiY3VycmVuY3kiOiAiUlVCIiwgImlubiI6ICIwMDAwMDAwMDAwIiwgImtwcCI6ICIwMDAwMDAwMDAwIn0sICJTaWRlUmVjaXBpZW50IjogeyJiYW5rQ29kZSI6ICIwMDAwMDAwMDAiLCAiYmFua05hbWUiOiAiXHUwNDFlXHUwNDFlXHUwNDFlIFx1MDQxMVx1MDQzMFx1MDQzZFx1MDQzYSBcdTA0MjJcdTA0M2VcdTA0NDdcdTA0M2FcdTA0MzAiLCAiYmFua0NvcnJlc3BvbmRlbnRBY2NvdW50IjogIjAwMDAwMDAwMDAwMDAwMDAwMDAwIiwgImFjY291bnQiOiAiMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCAibmFtZSI6ICJcdTA0MThcdTA0MWYgXHUwNDIyXHUwNDM1XHUwNDQxXHUwNDQyIiwgImFtb3VudCI6ICI0MC4wIiwgImN1cnJlbmN5IjogIlJVQiIsICJpbm4iOiAiMDAwMDAwMDAwMCIsICJrcHAiOiAiMDAwMDAwMDAwMCJ9LCAicHVycG9zZSI6ICJcdTA0MjJcdTA0MzVcdTA0NDFcdTA0NDJcdTA0M2VcdTA0MzJcdTA0M2VcdTA0MzUgXHUwNDNkXHUwNDMwXHUwNDM3XHUwNDNkXHUwNDMwXHUwNDQ3XHUwNDM1XHUwNDNkXHUwNDM4XHUwNDM1IFx1MDQzZlx1MDQzYlx1MDQzMFx1MDQ0Mlx1MDQzNVx1MDQzNlx1MDQzMCIsICJkb2N1bWVudE51bWJlciI6ICIwMDAwMCIsICJwYXltZW50SWQiOiAiMDAwMDAwMDAwMCIsICJkYXRlIjogIjIwMTgtMTAtMDEiLCAid2ViaG9va1R5cGUiOiAiaW5jb21pbmdQYXltZW50IiwgImN1c3RvbWVyQ29kZSI6ICIzMDAxMjMxMjMifQ.j7FCYrHL6pmR7m8TZxtBPBdsHG3uOu6bBl7HZq-VaK_LDj7Lyjb_B0L6zWZjVTRWvyfi6CZ-T-yT8IWzXdN5csoIEiwSuzLeC17oW-9c359Z5AYbL9x4SHSlYd3Q_hPM4DQVxPnPKb_IYpZGDCTovU_wtlAxiBdXQbY3qWEzzDzCuqZNjlVQalu7XipuSt7nNDBuwcDWJAC8Ry0U7UwRH6wboufhL7WcrQgsEn-2ZV--sKzinhUyfyYMw8_cFt9MNX3x_x3Fhu56708MDviu57O5u9t-diWrw2X75QKjnlf-PAamb0idK_8bJ5XbLXymnaBuYgSZSd-HZMHYLWiMHDL-z1OIsLgPKanUPJeKsSlmiVA1VJH2oZVRMv9Pf05O_cbN26d-LIjqn9z_m8XeZ1w0I9sfGP96IfT7xONsTLdbTCiKAJ-he4nzscxpzQc3tYnaeqETTZiyjB1U_chh88bG2n_0tNlQEtRT3j0sPyCWX3qLSFlkp6kKmQkIfeBn
```

outgoingPayment — об исходящих платежах

Вебхук нужен для отправки информации об исходящих платежах.

В течение 20 секунд после каждого исходящего платежа будет отправлено уведомление с основными данными:

-   реквизиты получателя и отправителя платежа
-   **purpose** — назначение
-   **amount** — сумма
-   **webhookType** — outgoingPayment
-   **customerCode** - уникальный идентификатор клиента
-   **paymentId** — уникальный идентификатор платежа, который также содержится в выписке

**Пример с телом вебхука по событию outgoingPayment:**

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJTaWRlUGF5ZXIiOiB7ImJhbmtDb2RlIjogIjAwMDAwMDAwMCIsICJiYW5rTmFtZSI6ICJcdTA0MWVcdTA0MWVcdTA0MWUgXHUwNDExXHUwNDMwXHUwNDNkXHUwNDNhIFx1MDQyMlx1MDQzZVx1MDQ0N1x1MDQzYVx1MDQzMCIsICJiYW5rQ29ycmVzcG9uZGVudEFjY291bnQiOiAiMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCAiYWNjb3VudCI6ICIwMDAwMDAwMDAwMDAwMDAwMDAwMCIsICJuYW1lIjogIlx1MDQxOFx1MDQxZiBcdTA0MjJcdTA0MzVcdTA0NDFcdTA0NDIiLCAiYW1vdW50IjogIjQwLjAiLCAiY3VycmVuY3kiOiAiUlVCIiwgImlubiI6ICIwMDAwMDAwMDAwIiwgImtwcCI6ICIwMDAwMDAwMDAwIn0sICJTaWRlUmVjaXBpZW50IjogeyJiYW5rQ29kZSI6ICIwMDAwMDAwMDAiLCAiYmFua05hbWUiOiAiXHUwNDFlXHUwNDFlXHUwNDFlIFx1MDQxMVx1MDQzMFx1MDQzZFx1MDQzYSBcdTA0MjJcdTA0M2VcdTA0NDdcdTA0M2FcdTA0MzAiLCAiYmFua0NvcnJlc3BvbmRlbnRBY2NvdW50IjogIjAwMDAwMDAwMDAwMDAwMDAwMDAwIiwgImFjY291bnQiOiAiMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCAibmFtZSI6ICJcdTA0MThcdTA0MWYgXHUwNDIyXHUwNDM1XHUwNDQxXHUwNDQyIiwgImFtb3VudCI6ICI0MC4wIiwgImN1cnJlbmN5IjogIlJVQiIsICJpbm4iOiAiMDAwMDAwMDAwMCIsICJrcHAiOiAiMDAwMDAwMDAwMCJ9LCAicHVycG9zZSI6ICJcdTA0MjJcdTA0MzVcdTA0NDFcdTA0NDJcdTA0M2VcdTA0MzJcdTA0M2VcdTA0MzUgXHUwNDNkXHUwNDMwXHUwNDM3XHUwNDNkXHUwNDMwXHUwNDQ3XHUwNDM1XHUwNDNkXHUwNDM4XHUwNDM1IFx1MDQzZlx1MDQzYlx1MDQzMFx1MDQ0Mlx1MDQzNVx1MDQzNlx1MDQzMCIsICJkb2N1bWVudE51bWJlciI6ICIwMDAwMCIsICJwYXltZW50SWQiOiAiMDAwMDAwMDAwMCIsICJkYXRlIjogIjIwMTgtMTAtMDEiLCAid2ViaG9va1R5cGUiOiAib3V0Z29pbmdQYXltZW50IiwgImN1c3RvbWVyQ29kZSI6ICIzMDAxMjMxMjMifQ.UCRqWxMHocDG83NeHxL9DdaZuLdnvWKC-zcbQL80PM3LAauP9H98tC80krR_jfGP7aXa8kOKrP2Qq5JSy4_lITViSuJKhQW9tHxQA0zJwwHmUOGIU6RNDmPVKQScoh2LlTcCpu-94v8O2GSa5nssVVj4_3mZT8VdjagpxMCuISYFRaUTnvjskkNOSmrXZIuoUHHL9h5sc6o7E8i6mMI0tMHRArgsM2Ge7de4ajkEsGQsJNBXEJV9rA4Ba5a4XdPlo1wE5nMLziKh5w-CVkotO2KyKCTLgIlg6tNwmBs0saRMJU3kJfiBrLsuPoW34ZKPoqvgQEP8q9AayjC-eTrtsC94cNoiwz2I8-KLhnZmIXKahO_p-6kCBzQfJyz-H0sfJQjDBC1zFQieP79sarBPqYmCJ7eNNttyoGdJz2xDoLFStBRU2ua198PYSHsuBsdoBQ_6FO6BWCnnL66mzMKXPRpQ-uOIa-t73wTuzCre3HZVUpFKlzrfts4BxuG4Yy6o
```

incomingSbpPayment — о входящих платежах через СБП

По этому типу вебхука мы отправляем уведомление, только если деньги зачисляются через Систему быстрых платежей. В нём указываются:

-   **operationId** — идентификатор операции
-   **qrcId** — идентификатор QR-кода
-   **payerName** — данные покупателя: имя, отчество и первая буква фамилии
-   **payerMobileNumber** — номер телефона
-   **amount** — сумма операции
-   **brandName** — наименование ТСП
-   **webhookType** — incomingSbpPayment
-   **customerCode** — уникальный идентификатор клиента
-   **merchantId** — идентификатор ТСП
-   **refTransactionId** — идентификатор транзакции, по которой осуществляется возврат
-   **purpose** — назначение платежа

Уведомление обычно приходит в течение 5 секунд с момента зачисления денег по QR-коду.

**Пример с телом вебхука по событию incomingSbpPayment:**

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJvcGVyYXRpb25JZCI6ICJBMjIwMDExMDAyNjM4MjAxMDAwMDA1MzNFNjI1RkNCMyIsICJxcmNJZCI6ICJBUzEwMDA2RFBSVEVGUEZTOUhKOVNRU0RTVlJISkQzTCIsICJhbW91bnQiOiAiMC4zMyIsICJwYXllck1vYmlsZU51bWJlciI6ICIrOTk5OTEyMzQ1NjciLCAicGF5ZXJOYW1lIjogIlx1MDQxOFx1MDQzMlx1MDQzMFx1MDQzZCBcdTA0MThcdTA0MzJcdTA0MzBcdTA0M2RcdTA0M2VcdTA0MzJcdTA0MzhcdTA0NDcgXHUwNDE4LiIsICJicmFuZE5hbWUiOiAiXHUwNDFhXHUwNDNlXHUwNDQ0XHUwNDM1XHUwNDM5XHUwNDNkXHUwNDRmIFx1MDQ0MyBcdTA0MTBcdTA0NDBcdTA0NDJcdTA0MzVcdTA0M2NcdTA0MzAiLCAibWVyY2hhbnRJZCI6ICJNRjAwMDAwMDAwMDEiLCAicHVycG9zZSI6ICJcdTA0MWVcdTA0M2ZcdTA0M2JcdTA0MzBcdTA0NDJcdTA0MzAgXHUwNDNmXHUwNDNlIFx1MDQ0MVx1MDQ0N1x1MDQzNVx1MDQ0Mlx1MDQ0MyBcdTIxMTYgMSBcdTA0M2VcdTA0NDIgMDEuMDEuMjAyMS4gXHUwNDExXHUwNDM1XHUwNDM3IFx1MDQxZFx1MDQxNFx1MDQyMSIsICJ3ZWJob29rVHlwZSI6ICJpbmNvbWluZ1NicFBheW1lbnQiLCAiY3VzdG9tZXJDb2RlIjogIjMwMDEyMzEyMyIsICJyZWZUcmFuc2FjdGlvbklkIjogImNiMWVmMTBiLTM5ZTktNGU1NS1hZWY5LWQ2YmNjMzk2ZmYwZiJ9.QroEOEYw-fxniFzvjcrgihSeYOhE9GLVuMwI9Uuc0ubuwc-wYP2pHRYF4Lu2-bqHZk2jP5QHn2aDYWFVWi3vBi6sbVTa_n3Y9qZ1ROjbRaF-Uuah5XyzijwNG0I--0jj-vvn3D3caC1mw6dOCP1Ehkd5ipZWtcsrzu0wPxni8bsiqDIBVcA4hg3a6Iu5AORANwy4whiFo295bzf1Y_fdBhZO1QjZqv3-Cc_fF9liKd56UMfljm3ChqVwCdNF85e69PXAjkeicp-pH12kkgeflA2zLq_LFurAZj9_JkrOS9qSpfDqYf0m-ciHYFVYJNGH4PZnIPOa7iYNlGi0WjVbxE6uJX2EDHnYCZ1qXAkdGlm3K1CNvmBzjIUEowWOmD9bkq4INGsd9MMmRRSo-K3fqqjPNXkVGw2-_ZbIgemG9TD4bGeZCWN4shXpzrWGcyfQ7mrhRW0XiECGxTy8K4QuK-WsijGBlkYGd-bZuBa9qyZXLnsX4FhTIdEHYDc_eW6v
```

incomingSbpB2BPayment — о входящих платежах через B2B QR-код по СБП

По этому типу вебхука мы отправляем уведомление только при зачислении денег через B2B QR-коды, созданные через Систему быстрых платежей. В вебхуке указываются:

-   **qrcId** — идентификатор QR-кода
-   **customerCode** — уникальный идентификатор клиента
-   **webhookType** — incomingSbpB2BPayment
-   **amount** — сумма операции
-   **purpose** — назначение платежа

Уведомление обычно приходит в течение 10 секунд с момента зачисления денег по QR-коду.

**Пример с телом вебхука по событию incomingSbpB2BPayment:**

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJxcmNJZCI6ICJBUzEwMDA2RFBSVEVGUEZTOUhKOVNRU0RTVlJISkQzTCIsICJhbW91bnQiOiAiMC4zMyIsICJwdXJwb3NlIjogIlx1MDQxZVx1MDQzZlx1MDQzYlx1MDQzMFx1MDQ0Mlx1MDQzMCBcdTA0M2ZcdTA0M2UgXHUwNDQxXHUwNDQ3XHUwNDM1XHUwNDQyXHUwNDQzIFx1MjExNiAxIFx1MDQzZVx1MDQ0MiAwMS4wMS4yMDIxLiBcdTA0MTFcdTA0MzVcdTA0MzcgXHUwNDFkXHUwNDE0XHUwNDIxIiwgIndlYmhvb2tUeXBlIjogImluY29taW5nU2JwQjJCUGF5bWVudCIsICJjdXN0b21lckNvZGUiOiAiMzAwMTIzMTIzIn0.dty4QICBwDnglK9VKFchdKxG_QbOPHKHmqxSan5uDUadMT61391lNiRj7cKGiH35heZc7GEKp3rwmuqLIEwLcUQts2t90Baw7gVeHQSQMyeBjIEFoBXgkDCNsRwqJISmW8NfEv6xX87IEjLp6wKJi3VmfF_sffW6EpaXzyScA9DPIKjtUA9U-W5t8JmjgWMbXK41ghfiSlYiCOpOVOleod3R-jjzsGI3nEYExDqWWz3VgjsFGwHLGKoWBzhqtSL-NBTp5rE82N5eZrWF_4n8tkAmPzShQY9Rh2VxFVwAyqIezqYHYAcBBW_6vbZvA_XFVB8UkjOqJKRWSFHEOsmu7o3JYOq0WnI1iJ_Hfsi0W1HjjgaZuMhyezqNsGWib6u_g-86ekEPxXGFFlKglHg52t8iU-YE8dt7e7s890l_4_C2tRBbOuLrdnITrHzepiby6A74Qdt29j2Ffo0Vkd8qRNWx7RmWjy1X7NN0h595imLbBFWeYPYNOdG0M7CBQUox
```

acquiringInternetPayment — о входящих платежах только по платёжным ссылкам

По этому типу вебхука мы отправляем уведомление, только если по ссылке платят с карты или через Систему быстрых платежей.  
Обычно он доставляется за 5-10 секунд с момента оплаты.

При платеже по номеру карты мы передадим следующую информацию:

-   **amount** — сумма платежа
-   **paymentType** — card
-   **operationId** — идентификатор платежа
-   **webhookType** — acquiringInternetPayment
-   **customerCode** — уникальный идентификатор клиента
-   **merchantId** — идентификатор торговой точки в интернет-эквайринге
-   **consumerId** — идентификатор покупателя
-   **purpose** — назначение платежа
-   **status** — статус платежа, может принимать значения:
    -   `AUTHORIZED` — деньги успешно заморожены на счёте плательщика (значение актуально только для [двухэтапной оплаты](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki#%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5-%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D0%B8-%D1%81-%D0%B4%D0%B2%D1%83%D1%85%D1%8D%D1%82%D0%B0%D0%BF%D0%BD%D0%BE%D0%B9-%D0%BE%D0%BF%D0%BB%D0%B0%D1%82%D0%BE%D0%B9))
    -   `APPROVED` — деньги успешно списаны со счёта, оплата завершена
-   **paymentLinkId** — номер заказа, который вы передали в одноимённом поле при создании платёжной ссылки или подписки

**Пример с телом вебхука по событию acquiringInternetPayment при оплате картой:**

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJjdXN0b21lckNvZGUiOiAiMzAwMTIzMTIzIiwgImFtb3VudCI6ICIwLjMzIiwgInBheW1lbnRUeXBlIjogImNhcmQiLCAib3BlcmF0aW9uSWQiOiAiYmVlYWM4YTQtNjA0Ny0zZjM4LTg5MjItYTY2NGU2YjVjNDNiIiwgInB1cnBvc2UiOiAiXHUwNDFlXHUwNDNmXHUwNDNiXHUwNDMwXHUwNDQyXHUwNDMwIFx1MDQzZlx1MDQzZSBcdTA0NDFcdTA0NDdcdTA0MzVcdTA0NDJcdTA0NDMgXHUyMTE2IDEgXHUwNDNlXHUwNDQyIDAxLjAxLjIwMjEuIFx1MDQxMVx1MDQzNVx1MDQzNyBcdTA0MWRcdTA0MTRcdTA0MjEiLCAid2ViaG9va1R5cGUiOiAiYWNxdWlyaW5nSW50ZXJuZXRQYXltZW50IiwgIm1lcmNoYW50SWQiOiAiMjAwMDAwMDAwMDAxMjM0IiwgImNvbnN1bWVySWQiOiAiOTE3ZWQzODktYTEyMC00MjkxLThlNzMtMzhjNmVmN2Q2NzcwIiwgInN0YXR1cyI6ICJBUFBST1ZFRCIsICJwYXltZW50TGlua0lkIjogIjEyMzQ1LWFiLWNkIn0.pk1ToiIUopK7WxcdLnXEmD1I_Z7H_1yQcYyp3xxiQIltS0aqlTV2eA8R0RzvA3M39F7jApls6CTisslKB_sN1bn9zMJeLyGxezRXC1jljYLbvraLSvsyFZzh6t848hbcn1uUsM1lFwCVIXXZ-sMHkHobGlb0hdGbiX13O1cAwCa55bBhxHjoMJRDWc_0GaWteCBxmGUo2sDEgFmE5vUMvNB35dPNE5GrOKcnTXIpOSe-KX_kHUW8ECYEdQTP_9533LagQI5dP2gvbcyuUn0JApMxnSqS0uzrDiic84SLGwL3bICzxYd6nh8B-zJl5yWiswnwW7lH1xr6qnIjLRZzi2SPiarRnn5rKV-VRr7jKHQoUUZ993aYOFM8cDRN4gArziC-RMOiX-Qu4Gv1ZcZWYgOYhC2brNG3buvGcTAzkiQ9iaJyR2GCEryveSEqckmi0EEUfQdgWGsyjX1CbkwC4-enXWMKWhnpWG0g_8TjsL_MB9m5egEnyCItkWUYr-s6
```

При платеже через Систему быстрых платежей (СБП) мы передадим следующую информацию:

-   **amount** — сумма платежа
-   **paymentType** — sbp
-   **transactionId** — идентификатор платежа в СБП
-   **purpose** — назначение платежа
-   **qrcId** — идентификатор QR-кода
-   **merchantId** — идентификатор торговой точки в интернет-эквайринге
-   **operationId** — идентификатор платежа
-   **webhookType** — acquiringInternetPayment
-   **customerCode** — уникальный идентификатор клиента
-   **payerName** — данные покупателя: имя, отчество и первая буква фамилии
-   **status** — статус платежа, для платежей через СБП всегда будет значение `APPROVED`
-   **paymentLinkId** — номер заказа, который вы передали в одноимённом поле при создании платёжной ссылки или подписки

**Пример с телом вебхука по событию acquiringInternetPayment при оплате через СБП:**

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJjdXN0b21lckNvZGUiOiAiMzAwMTIzMTIzIiwgImFtb3VudCI6ICIwLjMzIiwgInBheW1lbnRUeXBlIjogInNicCIsICJvcGVyYXRpb25JZCI6ICJiZWVhYzhhNC02MDQ3LTNmMzgtODkyMi1hNjY0ZTZiNWM0M2IiLCAidHJhbnNhY3Rpb25JZCI6ICI0M2M2M2VjMS00MmZhLWE3MDQtZGRlNy02MDI1YzIwYjk2Y2UiLCAicHVycG9zZSI6ICJcdTA0MWVcdTA0M2ZcdTA0M2JcdTA0MzBcdTA0NDJcdTA0MzAgXHUwNDNmXHUwNDNlIFx1MDQ0MVx1MDQ0N1x1MDQzNVx1MDQ0Mlx1MDQ0MyBcdTIxMTYgMSBcdTA0M2VcdTA0NDIgMDEuMDEuMjAyMS4gXHUwNDExXHUwNDM1XHUwNDM3IFx1MDQxZFx1MDQxNFx1MDQyMSIsICJxcmNJZCI6ICJBUzEwMDA2RFBSVEVGUEZTOUhKOVNRU0RTVlJISkQzTCIsICJwYXllck5hbWUiOiAiXHUwNDE4XHUwNDMyXHUwNDMwXHUwNDNkIFx1MDQxOFx1MDQzMlx1MDQzMFx1MDQzZFx1MDQzZVx1MDQzMlx1MDQzOFx1MDQ0NyBcdTA0MTguIiwgIndlYmhvb2tUeXBlIjogImFjcXVpcmluZ0ludGVybmV0UGF5bWVudCIsICJtZXJjaGFudElkIjogIjIwMDAwMDAwMDAwMTIzNCIsICJzdGF0dXMiOiAiQVBQUk9WRUQiLCAicGF5bWVudExpbmtJZCI6ICIxMjM0NS1hYi1jZCJ9.nSLGpQd0H1BgVtC-W4KV4tb9dSB8Trw0v58rLE1fKgfnZtK0BRXvj-9mTxKXXFMDNZ5ngwHS8_dXC11VfeRWOBH31GFF6lBd7wh0DLnFzlVpPbwNBbwLFS3k0S8vyz7MkJsAc43JniARDfnGSVz6jwK2Ou6QVCCYcF4LGfyYmXAvYXpnhnopO4_KOBTiY3dcP89WGbDGUT_b-9tSPPnxlDBJamnhRkqnRPsCJurcwaud6E7shQHiG0uCugMZig_iNjt2mE4Thll_OI2BH7Hs-4IiXw2O8MFEvIkIECPjpD3wlszGA7piOtOjyOkeLuGsAXk4D0YrptiR7qReo2eyOE9SajmcjjvV9OfpEOHwo4uHkLOOjHqPke9ITVW3ZsvJ6gSWcQS-1z60BUKa81HLTM_SGj8g4g-3nOy6CEfyNk68cnTfjxgRMCrxDkpWOs33LnafGNfP8r97NArwIZCThVXME4SnaDu2hShMEvkxG-WJSjVXOgPhvAe_Q7M1PF9X
```

При платеже через сервис «Долями» мы передадим следующую информацию:

-   **customerCode** — уникальный идентификатор клиента
-   **operationId** — идентификатор платежа
-   **status** — статус платежа, может быть только в значении `APPROVED`
-   **amount** — сумма платежа
-   **paymentType** — способ оплаты, всегда в значении `dolyame`
-   **webhookType** — тип вебхука, всегда `acquiringInternetPayment`
-   **purpose** — назначение платежа
-   **merchantId** — идентификатор торговой точки в интернет-эквайринге
-   **paymentLinkId** — номер заказа, который вы передали в одноимённом поле при создании платёжной ссылки или подписки

**Пример с телом вебхука по событию acquiringInternetPayment при оплате Долями**:

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJjdXN0b21lckNvZGUiOiAiMzAwMTIzMTIzIiwgImFtb3VudCI6ICIwLjMzIiwgInBheW1lbnRUeXBlIjogImRvbHlhbWUiLCAib3BlcmF0aW9uSWQiOiAiYmVlYWM4YTQtNjA0Ny0zZjM4LTg5MjItYTY2NGU2YjVjNDNiIiwgInB1cnBvc2UiOiAiXHUwNDFlXHUwNDNmXHUwNDNiXHUwNDMwXHUwNDQyXHUwNDMwIFx1MDQzZlx1MDQzZSBcdTA0NDFcdTA0NDdcdTA0MzVcdTA0NDJcdTA0NDMgXHUyMTE2IDEgXHUwNDNlXHUwNDQyIDAxLjAxLjIwMjEuIFx1MDQxMVx1MDQzNVx1MDQzNyBcdTA0MWRcdTA0MTRcdTA0MjEiLCAid2ViaG9va1R5cGUiOiAiYWNxdWlyaW5nSW50ZXJuZXRQYXltZW50IiwgIm1lcmNoYW50SWQiOiAiMjAwMDAwMDAwMDAxMjM0IiwgInN0YXR1cyI6ICJBUFBST1ZFRCIsICJwYXltZW50TGlua0lkIjogIjEyMzQ1LWFiLWNkIn0.J5GZjKgeScrbD5lHqbQEP3oJkmwMYKDSUBUrrSN07qNELpApEp9IclABEolS-ANh7_xVXF-9D8uLm4rNzrLhid90SHMwWOFTUW4BT-7lNM4jogaBUFqUf2d-kPfUI16-jFdNQIy-are6d9HbMjZGXunBUZpBOr2Pz8wEGJyaaywh4tBdgKMQbC-an1sY0JwJqdRK7memw-hv9gsDIAqLSSih80L4N7F2PUrSbzfbTrNj7u5nvYFPT3DkKknGh2IvHx27nzo9tK-JBNxgHN0HQOg3EOYFJV3e0H_JhGZqlxoU0zo2YNHeB7cZJ0qZy7HZMXv2g1Qlae-2JthyJjF9NEC2f8W79d8Z3CZJw40l4z0QXDIrMAgf01bHFt4eanP6fhq39iko04EbBiHH8Zmjhn5hLkAGymoc_rC60wDl8v11Tb1YJYO2xdNsRNaMaYuvFOhLqnjmgjQeEQoL6iHGB7ObUbAWB4_BU4M524Z_KpmNqmigRNSZDEdDCrYYPncd
```

## Несколько особенностей в работе вебхуков

-   Если на отправленный вебхук мы не получили ответ с кодом состояния HTTP 200, а получили любой другой код, то будем отправлять его повторно 30 раз с периодичностью в 10 секунд.
-   Для проверки доступности указанного вами хоста при создании или изменении вебхука мы отправим на ваш URL по одному тестовому вебхуку на каждое из событий, на которые вы подписаны.  
    Если в статусе ответа не придёт код HTTP 200, то вебхук не будет создан или изменён.
-   Подключить или изменить вебхук можно только по протоколу HTTPS на порт 443. Создать вебхук на другой порт или протокол не получится.
-   Вебхук отправляется с заголовком `Content-Type: text/plain`.

## Примеры обработки вебхуков

Примеры кода, который успешно обрабатывает вебхук

Python

```
from aiohttp import webimport jwtfrom jwt import exceptionsimport json# Публичный ключ Точка Банка. Может быть получен из https://enter.tochka.com/doc/openapi/static/keys/publickey_json = '{"kty":"RSA","e":"AQAB","n":"rwm77av7GIttq-JF1itEgLCGEZW_zz16RlUQVYlLbJtyRSu61fCec_rroP6PxjXU2uLzUOaGaLgAPeUZAJrGuVp9nryKgbZceHckdHDYgJd9TsdJ1MYUsXaOb9joN9vmsCscBx1lwSlFQyNQsHUsrjuDk-opf6RCuazRQ9gkoDCX70HV8WBMFoVm-YWQKJHZEaIQxg_DU4gMFyKRkDGKsYKA0POL-UgWA1qkg6nHY5BOMKaqxbc5ky87muWB5nNk4mfmsckyFv9j1gBiXLKekA_y4UwG2o1pbOLpJS3bP_c95rm4M9ZBmGXqfOQhbjz8z-s9C11i-jmOQ2ByohS-ST3E5sqBzIsxxrxyQDTw--bZNhzpbciyYW4GfkkqyeYoOPd_84jPTBDKQXssvj8ZOj2XboS77tvEO1n1WlwUzh8HPCJod5_fEgSXuozpJtOggXBv0C2ps7yXlDZf-7Jar0UYc_NJEHJF-xShlqd6Q3sVL02PhSCM-ibn9DN9BKmD"}'key = json.loads(key_json)jwk_key = jwt.jwk_from_dict(key)async def handle(request: web.Request):    payload = await request.text()    try:        # тело вебхука        webhook_jwt = jwt.JWT().decode(            message=payload,            key=jwk_key,        )    except exceptions.JWTDecodeError:        # Неверная подпись, вебхук не от Точка Банка или с ним что-то не так        pass    return web.Response(status=200)app = web.Application()app.router.add_route('POST', '/', handle)if __name__ == '__main__':    web.run_app(app, port=80)
```

PHP

```
<?phprequire __DIR__ . "/vendor/autoload.php";use Firebase\JWT\JWK;use Firebase\JWT\JWT;$entityBody = file_get_contents("php://input");// Публичный ключ Точка Банка. Может быть получен из https://enter.tochka.com/doc/openapi/static/keys/public$json_key = '{"kty":"RSA","e":"AQAB","n":"rwm77av7GIttq-JF1itEgLCGEZW_zz16RlUQVYlLbJtyRSu61fCec_rroP6PxjXU2uLzUOaGaLgAPeUZAJrGuVp9nryKgbZceHckdHDYgJd9TsdJ1MYUsXaOb9joN9vmsCscBx1lwSlFQyNQsHUsrjuDk-opf6RCuazRQ9gkoDCX70HV8WBMFoVm-YWQKJHZEaIQxg_DU4gMFyKRkDGKsYKA0POL-UgWA1qkg6nHY5BOMKaqxbc5ky87muWB5nNk4mfmsckyFv9j1gBiXLKekA_y4UwG2o1pbOLpJS3bP_c95rm4M9ZBmGXqfOQhbjz8z-s9C11i-jmOQ2ByohS-ST3E5sqBzIsxxrxyQDTw--bZNhzpbciyYW4GfkkqyeYoOPd_84jPTBDKQXssvj8ZOj2XboS77tvEO1n1WlwUzh8HPCJod5_fEgSXuozpJtOggXBv0C2ps7yXlDZf-7Jar0UYc_NJEHJF-xShlqd6Q3sVL02PhSCM-ibn9DN9BKmD"}';$jwks = json_decode($json_key, true, 512, JSON_THROW_ON_ERROR);try {    $decoded = JWT::decode($entityBody, JWK::parseKey($jwks,"RS256"));} catch (\UnexpectedValueException $e) {    // Неверная подпись, вебхук не от Точка Банка или с ним что-то не так    echo "Invalid webhook";}// Тело вебхука$decoded_array = (array) $decoded;http_response_code(200);
```

Java

```
import com.nimbusds.jose.JOSEException;import com.nimbusds.jose.crypto.RSASSAVerifier;import com.nimbusds.jose.jwk.JWK;import com.nimbusds.jwt.SignedJWT;import org.springframework.web.bind.annotation.PostMapping;import org.springframework.web.bind.annotation.RequestBody;import org.springframework.web.bind.annotation.RequestMapping;import org.springframework.web.bind.annotation.RestController;import java.text.ParseException;@RestController@RequestMapping("/")public class WebhookResource {    @PostMapping(value = "/")    public void tochkaWebhook(@RequestBody String webhookData) throws ParseException, JOSEException {        // Публичный ключ Точка Банка. Может быть получен из https://enter.tochka.com/doc/openapi/static/keys/public        var jsonKey = "{\"kty\":\"RSA\",\"e\":\"AQAB\",\"n\":\"raJQJyBXIgS1YzYFkmQGq5XtadLVvMcx5u-guR2r5ZgSb-HGUG7HF5NM-NJeL9YrVtjjGf8VNLpwGbeejsS9LRniPfKkCYaVqV1DSGOZ6RTOtqN3jKW1W86cVb-LffrQo3eFhPX5V464uduPu9RouFplQ7wprY5ewke0Yj0FCOr6Ebxlpql-aJp_wk8JSzzFN17IC5tfUXgGDjEmnMjxag_CntnJtKWmw69ivhrq5sTPspclL3Ij8K_Qk0MwAZFCci25WxIuKQe7Mk4dvay6CUfrCbAgEtqMcWUSqoG7pdBig59lo-kIMWvVQIAWjo2JhI7VlI_ssvFtiJg5T9myE914aESFZ8jEheQv-4kZ81F0qk02k2mJ4C7AasGhbzC4F8YQ7nbr49v1n_j8udNZZXA8vI2hacG517A66-uvEHIxXRUo_gIcubR-vdbJbaK_k8JRLJNmdf4B9HchJ6VD9aGjMT0GYfhQ8jf16E1L_U4G4XLB5cnb0h88PD2MaMGP\"}";        var jwkKey = JWK.parse(jsonKey);        var jwtData = SignedJWT.parse(webhookData);        var verifier = new RSASSAVerifier(jwkKey.toRSAKey().toRSAPublicKey());        if (!jwtData.verify(verifier)) {            // Неверная подпись, вебхук не от Точка Банка или с ним что-то не так            System.out.println("Invalid webhook");            return;        }        // Тело вебхука        var webhookParsedData = jwtData.getJWTClaimsSet().getClaims();        return;    }}
```

## Вебхуками можно управлять с помощью методов:

-   [Get Webhooks](https://developers.tochka.com/docs/tochka-api/api/get-webhooks-webhook-v-1-0-client-id-get) — чтобы получить список всех вебхуков, настроенных на приложение
-   [Create Webhook](https://developers.tochka.com/docs/tochka-api/api/create-webhook-webhook-v-1-0-client-id-put) — чтобы создать новый вебхук
-   [Edit Webhook](https://developers.tochka.com/docs/tochka-api/api/edit-webhook-webhook-v-1-0-client-id-post) — чтобы изменить URL или тип существующего вебхука
-   [Delete Webhook](https://developers.tochka.com/docs/tochka-api/api/delete-webhook-webhook-v-1-0-client-id-delete) — чтобы удалить вебхук
-   [Send Webhook](https://developers.tochka.com/docs/tochka-api/api/send-webhook-webhook-v-1-0-client-id-test-send-post) — чтобы отправить тестовый вебхук
