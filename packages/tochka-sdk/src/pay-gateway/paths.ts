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

export function withQuery(
	path: string,
	query: Record<string, string | number | undefined>,
): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) search.set(key, String(value));
	}
	const serialized = search.toString();
	return serialized ? `${path}?${serialized}` : path;
}
