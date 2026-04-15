---
source: https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platezhi
title: "Платёжные поручения (исходящие платежи)"
description: "Для работы с исходящими платежами у вас должны быть включены разрешения CreatePaymentForSign и CreatePaymentOrder."
scraped_at: 2026-04-15
---
# Платёжные поручения (исходящие платежи)

> **ИНФО**
> 
> Для работы с исходящими платежами у вас должны быть включены разрешения `CreatePaymentForSign` и `CreatePaymentOrder`.

Платёжные поручения (платёжки) нужны для проведения исходящих платежей по реквизитам. Например, когда вам нужно рассчитаться с контрагентом за товары или услуги.

Для проведения такого платежа нужно:

1.  Создать платёжку. Она появится в интернет-банке в разделе «На подпись».
2.  Подписать её. Это может сделать любой сотрудник вашей компании, которому в интернет-банке выдан тип доступа «С правом подписи». Чтобы подписать платёжку, сотруднику нужно просто ввести смс-код, и деньги отправятся получателю.

Для работы с платёжками есть несколько методов:

-   [Create Payment For Sign](https://developers.tochka.com/docs/tochka-api/api/create-payment-for-sign-payment-v-1-0-for-sign-post) — с помощью него можно создать платёжку и отправить её на подпись. В ответе приходит ссылка в поле `Data.redirectURL` — она ведёт на страницу с созданным поручением для его подписания.
    
-   [Get Payment For Sign List](https://developers.tochka.com/docs/tochka-api/api/get-payment-for-sign-list-payment-v-1-0-for-sign-get) — возвращает все платежи из раздела «На подпись» в интернет-банке и информацию о каждом из них. Обратите внимание, что в ответе приходят платежи, созданные как в интернет-банке, так и по API, а данные платежей актуальны только на момент вызова метода.
    
-   [Get Payment Status](https://developers.tochka.com/docs/tochka-api/api/get-payment-status-payment-v-1-0-status-request-id-get) — для проверки статуса платежа, созданного методом [Create Payment For Sign](https://developers.tochka.com/docs/tochka-api/api/create-payment-for-sign-payment-v-1-0-for-sign-post). Если платёж создан по API, но затем был отредактирован в интернет-банке, узнать его актуальный статус с помощью этого метода не получится — он всегда будет отображаться как `Created`.
