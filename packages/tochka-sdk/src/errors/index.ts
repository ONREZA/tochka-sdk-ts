/**
 * Иерархия ошибок SDK.
 *
 * Формат ответа банка (из docs/tochka/scraped/api-references.md):
 *   { code, id, message, Errors: [{ errorCode, message, url }] }
 */

export type TochkaErrorCategory =
	| "REQUEST_PARSING_ERROR"
	| "REQUEST_VALIDATION_ERROR"
	| "INVALID_TOKEN"
	| "OPERATION_FORBIDDEN"
	| "ENTITY_NOT_FOUND"
	| "OPERATION_LOCKED"
	| "OPERATION_RATE_LIMIT"
	| "INTERNAL_ERROR"
	| "UNSUPPORTED_OPERATION"
	| "UNDERLYING_SERVICE_UNAVAILABLE"
	| (string & {});

export interface TochkaErrorDetail {
	errorCode?: string;
	message?: string;
	url?: string;
}

export interface TochkaErrorPayload {
	code?: number;
	id?: string;
	/** Категория ошибки от банка (не человекочитаемое сообщение). */
	message?: TochkaErrorCategory;
	Errors?: TochkaErrorDetail[];
}

export interface TochkaErrorInit {
	status: number;
	url: string;
	method: string;
	requestId?: string | undefined;
	payload?: TochkaErrorPayload | undefined;
	/** Сырой текст тела ответа — используется когда JSON распарсить не удалось. */
	rawBody?: string | undefined;
	cause?: unknown;
}

export class TochkaError extends Error {
	override readonly name: string = "TochkaError";
	readonly status: number;
	readonly url: string;
	readonly method: string;
	readonly requestId: string | undefined;
	readonly category: TochkaErrorCategory | undefined;
	readonly details: readonly TochkaErrorDetail[];
	readonly payload: TochkaErrorPayload | undefined;
	readonly rawBody: string | undefined;

	constructor(init: TochkaErrorInit) {
		const msg = buildMessage(init);
		super(msg, init.cause !== undefined ? { cause: init.cause } : undefined);
		this.status = init.status;
		this.url = init.url;
		this.method = init.method;
		this.requestId = init.requestId ?? init.payload?.id;
		this.category = init.payload?.message;
		this.details = init.payload?.Errors ?? [];
		this.payload = init.payload;
		this.rawBody = init.rawBody;
	}

	static from(init: TochkaErrorInit): TochkaError {
		const cat = init.payload?.message;
		switch (cat) {
			case "INVALID_TOKEN":
				return new InvalidTokenError(init);
			case "OPERATION_FORBIDDEN":
				return new OperationForbiddenError(init);
			case "ENTITY_NOT_FOUND":
				return new EntityNotFoundError(init);
			case "OPERATION_LOCKED":
				return new OperationLockedError(init);
			case "OPERATION_RATE_LIMIT":
				return new OperationRateLimitError(init);
			case "REQUEST_VALIDATION_ERROR":
			case "REQUEST_PARSING_ERROR":
				return new ValidationError(init);
			case "INTERNAL_ERROR":
				return new InternalServerError(init);
			case "UNSUPPORTED_OPERATION":
				return new UnsupportedOperationError(init);
			case "UNDERLYING_SERVICE_UNAVAILABLE":
				return new ServiceUnavailableError(init);
			default:
				return new TochkaError(init);
		}
	}
}

export class InvalidTokenError extends TochkaError {
	override readonly name = "InvalidTokenError";
}
export class OperationForbiddenError extends TochkaError {
	override readonly name = "OperationForbiddenError";
}
export class EntityNotFoundError extends TochkaError {
	override readonly name = "EntityNotFoundError";
}
export class OperationLockedError extends TochkaError {
	override readonly name = "OperationLockedError";
}
export class OperationRateLimitError extends TochkaError {
	override readonly name = "OperationRateLimitError";
}
export class ValidationError extends TochkaError {
	override readonly name = "ValidationError";
}
export class InternalServerError extends TochkaError {
	override readonly name = "InternalServerError";
}
export class UnsupportedOperationError extends TochkaError {
	override readonly name = "UnsupportedOperationError";
}
export class ServiceUnavailableError extends TochkaError {
	override readonly name = "ServiceUnavailableError";
}

/** Сетевые/транспортные сбои до получения HTTP-ответа. */
export class TochkaNetworkError extends Error {
	override readonly name = "TochkaNetworkError";
	readonly url: string;
	readonly method: string;
	constructor(message: string, opts: { url: string; method: string; cause?: unknown }) {
		super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
		this.url = opts.url;
		this.method = opts.method;
	}
}

/** Внутренний invariant-violation (не ошибка банка). */
export class TochkaSDKError extends Error {
	override readonly name = "TochkaSDKError";
}

function buildMessage(init: TochkaErrorInit): string {
	const cat = init.payload?.message;
	const sub = init.payload?.Errors?.[0]?.errorCode;
	const detail = init.payload?.Errors?.[0]?.message;
	const head = `[${init.method} ${init.url}] ${init.status}${cat ? ` ${cat}` : ""}${sub ? `/${sub}` : ""}`;
	return detail ? `${head}: ${detail}` : head;
}
