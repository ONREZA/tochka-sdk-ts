/**
 * Источник заголовков авторизации для каждого HTTP-запроса.
 *
 * Контракт: `getHeaders()` вызывается перед каждым запросом. Реализация
 * отвечает за кэширование, refresh, введение `Authorization` и прочего.
 */
export interface AuthProvider {
	getHeaders(): Promise<Record<string, string>> | Record<string, string>;
}
