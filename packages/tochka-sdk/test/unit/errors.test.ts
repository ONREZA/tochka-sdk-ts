import { describe, expect, test } from "bun:test";
import {
	EntityNotFoundError,
	InternalServerError,
	InvalidTokenError,
	OperationForbiddenError,
	OperationLockedError,
	OperationRateLimitError,
	ServiceUnavailableError,
	TochkaError,
	type TochkaErrorInit,
	UnsupportedOperationError,
	ValidationError,
} from "../../src/errors/index.js";

function make(overrides: Partial<TochkaErrorInit> = {}): TochkaErrorInit {
	return {
		status: 400,
		url: "https://enter.tochka.com/uapi/foo",
		method: "GET",
		...overrides,
	};
}

describe("TochkaError.from — dispatch по category", () => {
	const cases: Array<[string, typeof TochkaError]> = [
		["INVALID_TOKEN", InvalidTokenError],
		["OPERATION_FORBIDDEN", OperationForbiddenError],
		["ENTITY_NOT_FOUND", EntityNotFoundError],
		["OPERATION_LOCKED", OperationLockedError],
		["OPERATION_RATE_LIMIT", OperationRateLimitError],
		["REQUEST_VALIDATION_ERROR", ValidationError],
		["REQUEST_PARSING_ERROR", ValidationError],
		["INTERNAL_ERROR", InternalServerError],
		["UNSUPPORTED_OPERATION", UnsupportedOperationError],
		["UNDERLYING_SERVICE_UNAVAILABLE", ServiceUnavailableError],
	];

	for (const [category, Cls] of cases) {
		test(`${category} → ${Cls.name}`, () => {
			const err = TochkaError.from(make({ payload: { message: category } }));
			expect(err).toBeInstanceOf(Cls);
			expect(err).toBeInstanceOf(TochkaError);
			expect(err.category).toBe(category);
		});
	}

	test("неизвестная category → базовый TochkaError", () => {
		const err = TochkaError.from(make({ payload: { message: "UNKNOWN_CATEGORY" } }));
		expect(err).toBeInstanceOf(TochkaError);
		expect(err.constructor).toBe(TochkaError);
		expect(err.name).toBe("TochkaError");
	});

	test("без payload → базовый TochkaError", () => {
		const err = TochkaError.from(make());
		expect(err).toBeInstanceOf(TochkaError);
		expect(err.category).toBeUndefined();
	});
});

describe("TochkaError — поля", () => {
	test("status/url/method пробрасываются", () => {
		const err = TochkaError.from(make({ status: 503, url: "https://x/y", method: "POST" }));
		expect(err.status).toBe(503);
		expect(err.url).toBe("https://x/y");
		expect(err.method).toBe("POST");
	});

	test("requestId берётся из опции, потом из payload.id", () => {
		const a = TochkaError.from(make({ requestId: "from-opt" }));
		expect(a.requestId).toBe("from-opt");
		const b = TochkaError.from(make({ payload: { id: "from-payload", message: "INVALID_TOKEN" } }));
		expect(b.requestId).toBe("from-payload");
	});

	test("details из payload.Errors", () => {
		const err = TochkaError.from(
			make({
				payload: {
					message: "INTERNAL_ERROR",
					Errors: [{ errorCode: "X", message: "Oops", url: "https://x/docs" }],
				},
			}),
		);
		expect(err.details.length).toBe(1);
		expect(err.details[0]).toEqual({
			errorCode: "X",
			message: "Oops",
			url: "https://x/docs",
		});
	});

	test("rawBody сохраняется", () => {
		const err = TochkaError.from(make({ rawBody: "raw response text" }));
		expect(err.rawBody).toBe("raw response text");
	});

	test("message содержит метод, URL, статус и детали", () => {
		const err = TochkaError.from(
			make({
				status: 400,
				payload: {
					message: "REQUEST_VALIDATION_ERROR",
					Errors: [{ errorCode: "INVALID_FIELD", message: "amount is required" }],
				},
			}),
		);
		expect(err.message).toContain("GET");
		expect(err.message).toContain("400");
		expect(err.message).toContain("REQUEST_VALIDATION_ERROR");
		expect(err.message).toContain("INVALID_FIELD");
		expect(err.message).toContain("amount is required");
	});
});
