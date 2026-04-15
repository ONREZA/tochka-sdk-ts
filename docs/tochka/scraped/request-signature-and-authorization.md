---
source: https://developers.tochka.com/docs/pay-gateway/request-signature-and-authorization
title: "Авторизация и подпись запросов"
description: "Авторизация запросов"
scraped_at: 2026-04-15
---
# Авторизация и подпись запросов

## Авторизация запросов

Для авторизации запросов используется [JWT-токен](https://developers.tochka.com/docs/tochka-api/algoritm-raboty-s-jwt-tokenom) — его нужно передавать в заголовке `Authorization`.

Токен вы сможете получить в процессе бординга или у менеджера сопровождения.

## Электронная подпись запросов

Для безопасности проведения финансовых операций через открытое API, нужно формировать и передавать цифровую подпись запросов в заголовке `Signature` для следующих типов запросов:

-   [Платёж через форму мерчанта -> Создание платежа](https://developers.tochka.com/docs/pay-gateway/api/create-payment)
-   [Подтверждение -> Подтверждение платежа](https://developers.tochka.com/docs/pay-gateway/api/create-capture)
-   [Возвраты -> Создание операции возврата](https://developers.tochka.com/docs/pay-gateway/api/create-refund)

### Формирование ключей

**Требования к ключам:**

-   Алгоритм — RSA
-   Размер ключа — 2048-bit
-   Форма передаваемого ключа — PEM формат, закодированный в Base64 одной строкой (без переносов)

**Пример на Bash:**

1.  Сгенерировать закрытый ключ

```
openssl genrsa -out private_key.pem 2048
```

2.  Получить открытый ключ на основе закрытого

```
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

3.  Закодировать открытый ключ в Base64

```
openssl base64 -A -in public_key.pem -out public_key_base64.pem
```

4.  В рамках подключения к API Точка Банка передать полученный на предыдущем шаге `public_key_base64.pem`

### Подпись запроса

**Требования к подписи:**

-   Хэш-функция — sha256
-   Заголовок для передачи подписи - `Signature`
-   Форма передачи подписи — «сырая» подпись, закодированная в Base64 одной строкой (без переносов)

**Пример на Bash:**

1.  Подготовить тело запроса (в данном случае - предположим что оно в файле request.txt)

```
hello, world
```

2.  Подписать тело запроса с помощью приватного ключа и с hash-функцией sha256

```
openssl dgst -sha256 -sign private_key.pem request.txt > sign_raw.txt
```

3.  Закодировать «сырую» подпись в Base64

```
openssl base64 -A -in sign_raw.txt -out sign_base64.txt
```

4.  Передавать содержимое `sign_base64.txt` в заголовке `Signature` запросов
