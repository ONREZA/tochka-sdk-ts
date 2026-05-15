/**
 * Клиент Pay Gateway (прямой приём карт/СБП с собственной формы мерчанта).
 *
 * Отличия от основного API Точки:
 *   - Отдельный хост (выдаётся при онбординге, требуется PCI DSS AOC)
 *   - JWT-токен в Authorization
 *   - RSA-SHA256 подпись тела запроса в заголовке `Signature` для 3 эндпоинтов:
 *     `create-payment`, `create-capture`, `create-refund`
 *
 * @see docs/tochka/scraped/request-signature-and-authorization.md
 * @see docs/tochka/scraped/webhooks.md
 */

import {
	type PayGatewayClientOptions as BaseOptions,
	PayGatewayClient as TransportClient,
} from "./client.js";
import { PayGatewayPaymentsModule } from "./payments.js";
import { PayGatewaySbpFunctionalLinksModule } from "./sbp.js";

export { DEFAULT_SIGNED_PATHS, PayGatewayClient as PayGatewayTransport } from "./client.js";
export type { PayGatewayClientOptions } from "./client.js";
export { createBodySigner } from "./signature.js";
export type { BodySigner, PrivateKeyInput } from "./signature.js";
export {
	PayGatewayPaymentsModule,
	type CreatePaymentRequest,
	type PayGatewayOperation,
	type RefundRequest,
} from "./payments.js";
export {
	PayGatewaySbpFunctionalLinksModule,
	type CreateSbpFunctionalLinkRequest,
	type CreateSbpFunctionalLinkResponse,
	type GetTokenizationResultResponse,
	type SbpAmount,
	type SbpFunctionalLinkPaymentToken,
	type SbpFunctionalLinkQrcType,
	type SbpTokenizationServiceDetails,
	type SbpTokenizationStatus,
} from "./sbp.js";

/**
 * Основной клиент Pay Gateway с предустановленными модулями.
 *
 * @example
 *   const pg = new PayGatewayClient({
 *     token: process.env.PG_JWT!,
 *     baseUrl: "https://pay.tochka.com",
 *     privateKey: fs.readFileSync("private_pkcs8.pem", "utf8"),
 *   });
 *   await pg.payments.create({ siteUid, amount: "100.00" });
 *
 *   // Recurring SBP: первый шаг — привязка счёта плательщика
 *   const link = await pg.sbpFunctionalLinks.create({
 *     qrcType: "DYNAMIC",
 *     amount: { currency: "RUB", amount: "1.00" },
 *     paymentToken: {
 *       tokenizationPurpose: "Подписка на сервис",
 *       tokenizationServiceDetails: { serviceName: "Pro", serviceId: "svc-1" },
 *     },
 *     ttl: 60,
 *   });
 */
export class PayGatewayClient {
	readonly transport: TransportClient;
	readonly payments: PayGatewayPaymentsModule;
	readonly sbpFunctionalLinks: PayGatewaySbpFunctionalLinksModule;

	constructor(opts: BaseOptions) {
		this.transport = new TransportClient(opts);
		this.payments = new PayGatewayPaymentsModule(this.transport);
		this.sbpFunctionalLinks = new PayGatewaySbpFunctionalLinksModule(this.transport);
	}

	/** Низкоуровневый запрос (для эндпоинтов, не покрытых модулями). */
	request<T = unknown>(
		method: string,
		path: string,
		body?: unknown,
		init?: { headers?: Record<string, string>; signal?: AbortSignal },
	): Promise<T> {
		return this.transport.request<T>(method, path, body, init);
	}
}
