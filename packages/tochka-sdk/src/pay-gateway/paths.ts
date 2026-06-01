/** Версия API «Приём платежей» в составе пути. */
export const PAY_API_VERSION = "v1.0";

/**
 * Построить путь эндпоинта Pay Gateway с привязкой к сайту мерчанта.
 * `baseUrl` клиента — только хост (без `/uapi/...`); префикс с `siteUid`
 * добавляется здесь, чтобы один клиент мог обслуживать несколько сайтов.
 */
export function sitePath(siteUid: string, suffix: string): string {
	return `/uapi/pay/${PAY_API_VERSION}/sites/${encodeURIComponent(siteUid)}${suffix}`;
}
