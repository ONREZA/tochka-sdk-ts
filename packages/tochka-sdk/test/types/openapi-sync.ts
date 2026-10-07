import type { components } from "../../src/_generated/pay-gateway.js";
import type {
	AcquiringRegistry,
	ConsentCreateRequest,
	PaymentForSign,
	SbpCustomerInfo,
} from "../../src/index.js";
import type {
	CreateCashRegisterQrcRequest,
	CreateSbpFunctionalLinkRequest,
	PayGatewayOperation,
	RefundRetryRequest,
} from "../../src/pay-gateway/index.js";

const dynamic: CreateSbpFunctionalLinkRequest = {
	siteUid: "s",
	qrcType: "DYNAMIC",
	amount: { amount: "1.00", currency: "RUB" },
};
const staticCode: CreateSbpFunctionalLinkRequest = { siteUid: "s", qrcType: "STATIC" };
const cashRegister: CreateCashRegisterQrcRequest = { merchantQrcId: "merchant-qrc-1" };
const rawDynamic: components["schemas"]["QRCodeDynamic"] = {
	qrcType: "DYNAMIC",
	amount: { amount: "1.00", currency: "RUB" },
};
const rawStatic: components["schemas"]["QRCodeStatic"] = { qrcType: "STATIC" };
const rawCashRegister: components["schemas"]["CreateCashRegisterQrCodeRequest"] = {};
const digitalCode: CreateSbpFunctionalLinkRequest = {
	siteUid: "s",
	qrcType: "DYNAMIC",
	amount: { amount: "1.00", currency: "RUB" },
	paymentMethods: ["SBP", "DIGITAL_RUBLE"],
	paymentPageUrl: "https://shop.example/pay",
	customer: { fingerprint: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
};
const retry: RefundRetryRequest = {
	refundMethod: { type: "CARD", pan: "4111111111111111", cvv2: "123", expirationDate: "12/28" },
};

function readDigitalOperation(operation: PayGatewayOperation): string | undefined {
	if (operation.paymentMethod.type === "DIGITAL_RUBLE") return operation.paymentMethod.operationId;
	if (operation.paymentMethod.type === "DIGITAL_RUBLE_CASH_REGISTER_QRC")
		return operation.paymentMethod.activationUid;
	return undefined;
}

function readExistingResponseCaptureMode(
	config: components["schemas"]["CardConfig"],
): "AUTO" | "MANUAL" {
	return config.captureMode;
}

const permissions: ConsentCreateRequest["permissions"] = [
	"ReadCustomerDataMcp",
	"CreatePaymentForSignMcp",
	"ReadFeedbackData",
	"EditFeedbackData",
];

function readMainApiUpdates(
	payment: PaymentForSign,
	customer: SbpCustomerInfo,
): (string | undefined)[] {
	return [payment.gisPhoneNumber, payment.gisEmail, customer.DigitalRubleWallet?.walletId];
}

function readRegistryDigitalPayment(registry: AcquiringRegistry): boolean {
	return registry.Registry.some((entry) => entry.paymentType === "digitalRuble");
}

void [
	dynamic,
	staticCode,
	cashRegister,
	rawDynamic,
	rawStatic,
	rawCashRegister,
	digitalCode,
	retry,
	readDigitalOperation,
	readExistingResponseCaptureMode,
	permissions,
	readMainApiUpdates,
	readRegistryDigitalPayment,
];
