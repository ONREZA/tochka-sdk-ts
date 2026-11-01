import { expect, test } from "bun:test";
import { slugify } from "../docs/tochka/_scraper/slugify.js";

test("scraper slugs preserve ordinary paths and an empty index", () => {
	expect(slugify("https://example.com/docs/pay-gateway/orders/", "/docs/pay-gateway/")).toBe(
		"orders",
	);
	expect(slugify("https://example.com/docs/pay-gateway/", "/docs/pay-gateway/")).toBe("index");
	expect(slugify("https://example.com/docs/pay-gateway/orders/new", "/docs/pay-gateway/")).toBe(
		"orders-new",
	);
	expect(slugify("https://example.com/other/orders/", "/docs/pay-gateway/")).toBe("-other-orders");
});

test.each([
	["/docs.pay/orders", "/docs.pay/", "orders"],
	["/docsXpay/orders", "/docs.pay/", "-docsXpay-orders"],
	["/docs/[pay]/orders", "/docs/[pay]/", "orders"],
	["/docs/[pay/orders", "/docs/[pay/", "orders"],
])("scraper strips literal prefix in %s", (path, prefix, expected) => {
	expect(slugify(`https://example.com${path}`, prefix)).toBe(expected);
});
