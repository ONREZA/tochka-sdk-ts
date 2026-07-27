/**
 * Клиент Pay Gateway (прямой приём карт/СБП с собственной формы мерчанта).
 *
 * Отличия от основного API Точки:
 *   - Отдельный хост (выдаётся при онбординге, требуется PCI DSS AOC)
 *   - JWT-токен в Authorization
 *   - RSA-SHA256 подпись тела запроса в заголовке `Signature` для 3 эндпоинтов:
 *     создание платежа (`.../payments`), подтверждение (`.../captures`),
 *     возврат (`.../refunds`)
 *
 * @see docs/tochka/scraped/request-signature-and-authorization.md
 * @see docs/tochka/scraped/webhooks.md
 */

import { PayGatewayCardTokensModule } from "./card-tokens.js";
import { PayGatewayCashRegisterQrcModule } from "./cash-register.js";
import {
	type PayGatewayClientOptions as BaseOptions,
	PayGatewayClient as TransportClient,
} from "./client.js";
import { PayGatewayInvoicesModule } from "./invoices.js";
import { PayGatewayPaymentsModule } from "./payments.js";
import { PayGatewaySbpFunctionalLinksModule } from "./sbp.js";

export type { DeactivateCardTokenRequest } from "./card-tokens.js";
export { PayGatewayCardTokensModule } from "./card-tokens.js";
export type {
	ActivateCashRegisterQrcRequest,
	ActivateCashRegisterQrcResponse,
	CashRegisterQrc,
	CashRegisterQrcPayment,
	CashRegisterQrcStatus,
	CreateCashRegisterQrcRequest,
} from "./cash-register.js";
export { PayGatewayCashRegisterQrcModule } from "./cash-register.js";
export type { PayGatewayClientOptions } from "./client.js";
export { DEFAULT_SIGNED_PATHS, PayGatewayClient as PayGatewayTransport } from "./client.js";
export type {
	CancelInvoiceRequest,
	CreateInvoiceRequest,
	PayGatewayInvoice,
} from "./invoices.js";
export { PayGatewayInvoicesModule } from "./invoices.js";
export { PAY_API_VERSION, sitePath, withQuery } from "./paths.js";
export {
	type CapturePaymentList,
	type CapturePaymentRequest,
	type CapturePaymentResponse,
	type CardPaymentMethod,
	type CompletePaymentRequest,
	type CreatePaymentRequest,
	type PayGatewayAmount,
	type PayGatewayOperation,
	type PayGatewayPaymentMethod,
	PayGatewayPaymentsModule,
	type RefundList,
	type RefundRequest,
	type RefundResponse,
	type SavedCardPaymentMethod,
	type SbpCustomerPresentedQrPaymentMethod,
	type SbpNspkTokenPaymentMethod,
	type SbpTokenPaymentMethod,
	type ThreeDsRequirement,
	type TokenizationCredentials,
	type TokenizationCredentialsType,
} from "./payments.js";
export {
	type CreateSbpFunctionalLinkRequest,
	type CreateSbpFunctionalLinkResponse,
	PayGatewaySbpFunctionalLinksModule,
	type SbpAmount,
	type SbpFunctionalLinkPayments,
	type SbpFunctionalLinkPaymentToken,
	type SbpFunctionalLinkQrcType,
	type SbpQrcIdType,
	type SbpTokenizationResult,
	type SbpTokenizationServiceDetails,
	type SbpTokenizationStatus,
} from "./sbp.js";
export type { BodySigner, PrivateKeyInput } from "./signature.js";
export { createBodySigner } from "./signature.js";
export {
	type CaptureUpdatedWebhook,
	type PayGatewayReasonSource,
	type PayGatewaySbpReasonCode,
	type PayGatewayWebhookEvent,
	type PayGatewayWebhookEventName,
	type PaymentUpdatedWebhook,
	type RefundUpdatedWebhook,
	type SbpTokenDeclinedWebhook,
	type SbpTokenIssuedWebhook,
	type VerifyWebhookOptions,
	verifyPayGatewayWebhook,
	WebhookVerificationError,
	type WebhookVerificationReason,
} from "./webhooks.js";

/**
 * Основной клиент Pay Gateway с предустановленными модулями.
 *
 * @example
 *   const pg = new PayGatewayClient({
 *     token: process.env.PG_JWT!,
 *     baseUrl: "https://pay.tochka.com",
 *     privateKey: fs.readFileSync("private_pkcs8.pem", "utf8"),
 *   });
 *   await pg.payments.create({
 *     siteUid,
 *     paymentUid: "payment-123",
 *     amount: { currency: "RUB", amount: "100.00" },
 *     paymentMethod: { type: "SBP_TOKEN", token: "..." },
 *   });
 */
export class PayGatewayClient {
	readonly transport: TransportClient;
	readonly cardTokens: PayGatewayCardTokensModule;
	readonly cashRegisterQrc: PayGatewayCashRegisterQrcModule;
	readonly invoices: PayGatewayInvoicesModule;
	readonly payments: PayGatewayPaymentsModule;
	readonly sbpFunctionalLinks: PayGatewaySbpFunctionalLinksModule;

	constructor(opts: BaseOptions) {
		this.transport = new TransportClient(opts);
		this.cardTokens = new PayGatewayCardTokensModule(this.transport);
		this.cashRegisterQrc = new PayGatewayCashRegisterQrcModule(this.transport);
		this.invoices = new PayGatewayInvoicesModule(this.transport);
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
