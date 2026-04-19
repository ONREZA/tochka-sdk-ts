import { TochkaClient } from "../../src/index.js";

export const SMOKE_ENABLED = process.env.TOCHKA_SMOKE === "1";

/** Передать в `test.skipIf(...)` / `describe.skipIf(...)` — скипнет всё, если smoke выключен. */
export const skipIfNoSmoke = !SMOKE_ENABLED;

type Mode = "sandbox" | "jwt";

function resolveMode(): Mode {
	const raw = process.env.TOCHKA_MODE?.trim().toLowerCase();
	if (raw === "jwt") return "jwt";
	return "sandbox";
}

export interface SmokeConfig {
	mode: Mode;
	baseUrl: string | undefined;
	jwt: string | undefined;
	customerCode: string | undefined;
}

export function getSmokeConfig(): SmokeConfig {
	return {
		mode: resolveMode(),
		baseUrl: process.env.TOCHKA_BASE_URL || undefined,
		jwt: process.env.TOCHKA_JWT || undefined,
		customerCode: process.env.TOCHKA_CUSTOMER_CODE || undefined,
	};
}

/** Создать клиент из env. В sandbox не требует никаких кредов. */
export function makeSmokeClient(overrides: { customerCode?: string } = {}): TochkaClient {
	const cfg = getSmokeConfig();
	const customerCode = overrides.customerCode ?? cfg.customerCode;

	if (cfg.mode === "jwt") {
		if (!cfg.jwt) {
			throw new Error("TOCHKA_MODE=jwt, но TOCHKA_JWT не задан");
		}
		return new TochkaClient({
			auth: { jwt: cfg.jwt },
			...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
			...(customerCode ? { customerCode } : {}),
		});
	}

	return new TochkaClient({
		auth: { sandbox: true },
		...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
		...(customerCode ? { customerCode } : {}),
	});
}

/**
 * Получить рабочий customerCode: либо из env, либо первый из `customers.list()`.
 * В sandbox всегда есть тестовый клиент — для prod/jwt лучше задать явно в env.
 */
export async function resolveCustomerCode(client: TochkaClient): Promise<string> {
	const envCode = getSmokeConfig().customerCode;
	if (envCode) return envCode;
	const list = await client.customers.list();
	const first = list.Customer?.[0];
	if (!first?.customerCode) {
		throw new Error("customers.list() вернул пусто — невозможно получить customerCode");
	}
	return first.customerCode;
}
