---
source: https://developers.tochka.com/docs/pay-gateway/api-references
title: "Справочники"
description: "Причины отклонения операции"
scraped_at: 2026-04-15
---
# Справочники

## Причины отклонения операции

Общий вид статуса отклонённой операции:

```
"status": {  "value": "DECLINED",  "changedDateTime": "2099-01-01T12:34:56Z",  "reasonSource": <Источник причины отклонения операции>,  "reasonCode": <Коды причины отклонения операции>,  "reasonMessage": "Какое-либо пояснение причины отклонения",  ...}
```

**Источники причины отклонения в проведении операции (`reasonSource`):**

| Код | Описание |
| --- | --- |
| PROCESSING | Платёжный процессинг |
| ACQUIRER | Шлюз-эквайрер |
| PAY\_SYSTEM | Платёжная система |
| ISSUER | Эмитент, выпустивший карту |
| MPI | В процессе проведения 3DS |
| FRAUD | Служба фрод-мониторинга |

**Коды причины отклонения операции (`reasonCode`):**

| Код | Описание | Карточные операции | СБП операции |
| --- | --- | --- | --- |
| INTERNAL\_ERROR | Ошибка в бизнес-логике | ✓ | ✓ |
| TECH\_ERROR | Общая техническая ошибка | ✓ | ✓ |
| LIMIT\_EXCEEDED | Достигнут один из лимитов (оборот, количество операций и прочее) | ✓ | ✓ |
| OPERATION\_NOT\_SUPPORTED | Операция не поддерживается на стороне источника | ✓ | ✓ |
| PAYMENT\_NOT\_FOUND | Не найдена исходная операция списания средств | ✓ | ✓ |
| INVALID\_CARD | В запросе передана некорректная карта | ✓ | ✗ |
| EXPIRED\_CARD | Срок действия карты завершён | ✓ | ✗ |
| NOT\_PERMITTED | Проведение операции запрещено | ✓ | ✓ |
| INTEGRATION\_ERROR | Ошибка в интеграции с внешним эквайрером | ✓ | ✓ |
| VALIDATION\_ERROR | Запрос не прошел проверку | ✓ | ✓ |
| INCORRECT\_TRANSACTION\_STATE | Попытка перевести операцию в некорректное состояние | ✓ | ✗ |
| INCORRECT\_AMOUNT | В запросе передана некорректная сумма | ✓ | ✗ |
| TOO\_MANY\_REQUESTS | Сработало ограничение на число запросов к процессингу | ✓ | ✓ |
| ISSUER\_NOT\_AVAILABLE | Эмитент недоступен по техническим причинам | ✓ | ✗ |
| REATTEMPT\_NOT\_PERMITTED | Повторение операции запрещено правилами платёжной системы | ✓ | ✗ |
| INSUFFICIENT\_FUNDS | Недостаточно средств на счёте клиента | ✓ | ✓ |
| BLOCKED\_CARD | Карта заблокирована | ✓ | ✗ |
| INCORRECT\_CVV | Передан некорректный CVV-код | ✓ | ✗ |
| EXPIRED\_3DS | 3DS не был завершён вовремя | ✓ | ✗ |
| SUSPECTED\_FRAUD | Операция отклонена из-за подозрения в мошенничестве | ✓ | ✓ |
| QR\_CODE\_NOT\_FOUND | QR-код не найден | ✗ | ✓ |
| GATEWAY\_TIMEOUT | Время ожидания ответа от шлюза истекло | ✗ | ✓ |
| UNEXPECTED\_GATEWAY\_RESPONSE | Неожиданный ответ от шлюза | ✗ | ✓ |
| SUBSCRIPTION\_REJECTED\_BY\_PAYER | Плательщик отказался от привязки счёта | ✗ | ✓ |
| SUBSCRIPTION\_TOKEN\_NOT\_FOUND | Привязка счёта не найдена | ✗ | ✓ |
| PAYMENT\_EXECUTION\_REJECTED | Отказ в выполнении платежа | ✗ | ✓ |
| REFUND\_AMOUNT\_EXCEEDS\_PAYMENT\_AMOUNT | Сумма возврата превышает сумму исходной операции СБП C2B | ✗ | ✓ |
| PAYER\_BANK\_TIMEOUT | Истекло время ожидания решения банка плательщика | ✗ | ✓ |
| REFUND\_ID\_ALREADY\_TAKEN | Дублирование идентификатора `agentRefundRequestId` | ✗ | ✓ |
| PREVIOUS\_REFUND\_IN\_PROGRESS | Предыдущий запрос на возврат по операции СБП C2B ещё не обработан | ✗ | ✓ |
| REFUND\_NOT\_FOUND | Запрос на возврат по операции СБП C2B не найден | ✗ | ✓ |
| SUBSCRIPTION\_UNAVAILABLE | Сценарии с привязкой счёта для ИП и юрлиц недоступны | ✗ | ✓ |
| ACCOUNT\_BLOCKED | Счёт заблокирован | ✗ | ✓ |
| ACCOUNT\_CLOSED | Счёт закрыт | ✗ | ✓ |
| OPERATION\_IN\_PROGRESS | Операция уже начата | ✗ | ✓ |
| UNKNOWN\_ERROR | Неизвестная ошибка | ✗ | ✓ |

## Статусы и коды ошибок

Общий вид ответа:

```
{  "code": <HTTP_STATUS>,  "id":"4a0f8085-c255-4693-8f1e-68a5e4b0adb7",  "message": <Категория ошибки>,  "Errors":[    {        "errorCode": <Подкатегория ошибки>,        "message":"Более детальное пояснение проблемы",        "url":"https://enter.tochka.com/uapi/pay"    }  ]}
```

Бывает, что формат ответа отличается от представленного выше. В таком случае нужно повторить операцию. Если при повторной операции проблема сохранится, обратитесь в поддержку Точка Банка.

Описание возможных вариантов параметров ответа:

**400** _(HTTP\_STATUS)_

-   REQUEST\_PARSING\_ERROR _(Категория)_
-   REQUEST\_VALIDATION\_ERROR _(Категория)_

**401** _(HTTP\_STATUS)_

-   INVALID\_TOKEN _(Категория)_
    -   UNKNOWN\_TOKEN _(Подкатегория)_
    -   TOKEN\_EXPIRED _(Подкатегория)_
    -   INCORRECT\_FORMAT _(Подкатегория)_

**403** _(HTTP\_STATUS)_

-   OPERATION\_FORBIDDEN _(Категория)_
    -   SIGNATURE\_VERIFICATION\_ERROR _(Подкатегория)_
    -   UNAUTHORIZED\_BY\_TOKEN _(Подкатегория)_
    -   FEATURE\_DISABLED\_FOR\_MERCHANT\_SITE _(Подкатегория)_

**404** _(HTTP\_STATUS)_

-   ENTITY\_NOT\_FOUND _(Категория)_
    -   MERCHANT\_NOT\_FOUND _(Подкатегория)_
    -   MERCHANT\_SITE\_NOT\_FOUND _(Подкатегория)_
    -   PAYMENT\_NOT\_FOUND _(Подкатегория)_

**423** _(HTTP\_STATUS)_

-   OPERATION\_LOCKED _(Категория)_
    -   PAYMENT\_LOCKED _(Подкатегория)_

**429** _(HTTP\_STATUS)_

-   OPERATION\_RATE\_LIMIT _(Категория)_

**500** _(HTTP\_STATUS)_

-   INTERNAL\_ERROR _(Категория)_
    -   CARD\_PROCESSING\_ERROR _(Подкатегория)_

**501** _(HTTP\_STATUS)_

-   UNSUPPORTED\_OPERATION _(Категория)_
    -   NOT\_SUPPORTED\_BY\_PROCESSING _(Подкатегория)_
    -   UNSUPPORTED\_PAYMENT\_METHOD _(Подкатегория)_

**503** _(HTTP\_STATUS)_

-   UNDERLYING\_SERVICE\_UNAVAILABLE _(Категория)_
    -   CONNECTION\_BROKEN _(Подкатегория)_
    -   CONNECTION\_TIMEOUT _(Подкатегория)_
