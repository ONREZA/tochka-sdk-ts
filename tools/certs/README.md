# CA для синхронизации OpenAPI

`russian-trusted-root-ca.pem` — Russian Trusted Root CA (RSA), полученный
2026-10-07 по HTTPS с официального CDN Госуслуг:
https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt

Официальные инструкции:

- https://www.gosuslugi.ru/crt
- https://developers.tochka.com/docs/tochka-api/certificate

SHA-256 fingerprint DER-сертификата:
`D2:6D:2D:02:31:B7:C3:9F:92:CC:73:85:12:BA:54:10:35:19:E4:40:5D:68:B5:BD:70:3E:97:88:CA:8E:CF:31`.

Subject и issuer: `C=RU, O=The Ministry of Digital Development and Communications,
CN=Russian Trusted Root CA`. Срок действия: 2022-03-01 — 2032-02-27.

CA хранится в git для review и воспроизводимости; workflow не скачивает новый
trust anchor на каждом запуске. Доверяем корневому CA, а не leaf-сертификату
endpoint или сертификату, извлечённому из непроверенной серверной цепочки.
Сервер обязан передавать необходимые intermediate-сертификаты.

При ротации получите CA из официального источника по валидируемому HTTPS,
сверьте fingerprint, issuer, CA constraints и сроки действия, проверьте цепочки
`enter.tochka.com` и `api.tochka.com` с SNI и hostname validation. Обновите PEM и
fingerprint в тесте отдельным PR. Сохраните проверку неизвестного CA и неверного
имени хоста. Не используйте `NODE_TLS_REJECT_UNAUTHORIZED=0`, `curl -k` или
`rejectUnauthorized: false`.
