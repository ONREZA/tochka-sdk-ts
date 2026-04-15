import type { AuthProvider } from "./types.js";

/**
 * Простой JWT-ключ, выданный в интернет-банке Точки.
 * Подробнее: docs/tochka/scraped-tochka-api/algoritm-raboty-s-jwt-tokenom.md
 */
export class JwtAuth implements AuthProvider {
	constructor(private readonly token: string) {
		if (!token) throw new Error("JwtAuth: token is required");
	}

	getHeaders(): Record<string, string> {
		return { Authorization: `Bearer ${this.token}` };
	}
}

/**
 * Песочница Точки принимает фиксированную строку `sandbox.jwt.token`.
 * Подробнее: docs/tochka/scraped-tochka-api/pesochnica.md
 */
export class SandboxAuth implements AuthProvider {
	getHeaders(): Record<string, string> {
		return { Authorization: "Bearer sandbox.jwt.token" };
	}
}
