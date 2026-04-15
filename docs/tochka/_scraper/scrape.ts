#!/usr/bin/env bun
import * as cheerio from "cheerio";
import TurndownService from "turndown";
// @ts-expect-error no types
import { gfm } from "turndown-plugin-gfm";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

const URLS = process.argv.slice(2).filter((a) => a.startsWith("http"));
const flagIdx = process.argv.findIndex((a) => a === "--out");
const OUT_DIR = flagIdx >= 0 ? process.argv[flagIdx + 1]! : "/tmp/tochka-scrape/out";
const ASSETS_DIR = join(OUT_DIR, "assets");
const prefixIdx = process.argv.findIndex((a) => a === "--strip-prefix");
const STRIP_PREFIX = prefixIdx >= 0 ? process.argv[prefixIdx + 1]! : "/docs/pay-gateway/";

const td = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
	bulletListMarker: "-",
	emDelimiter: "_",
});
td.use(gfm);

td.addRule("tochka-code-lang", {
	filter: (node) => node.nodeName === "PRE" && !!(node as any).querySelector?.("code"),
	replacement: (_c, node) => {
		const code = (node as any).querySelector("code");
		const cls: string = code?.getAttribute("class") ?? (node as any).getAttribute?.("class") ?? "";
		const lang = /language-(\S+)/.exec(cls)?.[1] ?? "";
		const text = code?.textContent ?? "";
		return `\n\n\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
	},
});

td.addRule("strip-hash-anchors", {
	filter: (node) =>
		node.nodeName === "A" && ((node as any).getAttribute("class") ?? "").includes("hash-link"),
	replacement: () => "",
});

function slugify(url: string, stripPrefix: string): string {
	const path = new URL(url).pathname.replace(new RegExp(`^${stripPrefix.replace(/\//g, "\\/")}`), "");
	return (path || "index").replace(/\/$/, "").replace(/\//g, "-");
}

async function downloadAsset(src: string, baseUrl: string): Promise<string | null> {
	try {
		const abs = new URL(src, baseUrl).toString();
		const name = basename(new URL(abs).pathname).replace(/[^\w.\-]/g, "_");
		if (!name) return null;
		const path = join(ASSETS_DIR, name);
		const res = await fetch(abs);
		if (!res.ok) return null;
		await mkdir(ASSETS_DIR, { recursive: true });
		await writeFile(path, Buffer.from(await res.arrayBuffer()));
		return `./assets/${name}`;
	} catch {
		return null;
	}
}

async function scrape(url: string) {
	process.stdout.write(`  ${url} ... `);
	const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (tochka-docs-scraper)" } });
	if (!res.ok) { console.log(`FAIL ${res.status}`); return null; }
	const html = await res.text();
	const $ = cheerio.load(html);

	const title = $("article h1").first().text().trim() ||
		$("title").text().replace(/\s*\|\s*Точка\.API.*$/, "").trim();
	const description = $('meta[name="description"]').attr("content") ?? "";

	const $content = $("article .theme-doc-markdown").first();
	if ($content.length === 0) { console.log("NO CONTENT"); return null; }

	$content.find("button, .theme-doc-toc-mobile, .pagination-nav, .theme-edit-this-page, nav, .hash-link").remove();
	$content.find("h1").first().remove();

	$content.find(".theme-admonition").each((_, el) => {
		const $el = $(el);
		const kind = /theme-admonition-(\w+)/.exec($el.attr("class") ?? "")?.[1] ?? "note";
		const heading = $el.find("[class*='admonitionHeading']").first().text().trim() || kind;
		$el.find("[class*='admonitionHeading']").remove();
		const inner = $el.html() ?? "";
		$el.replaceWith(`<blockquote><p><strong>${heading.toUpperCase()}</strong></p>${inner}</blockquote>`);
	});

	$content.find(".mermaid, pre.language-mermaid, code.language-mermaid").each((_, el) => {
		const $el = $(el);
		const text = $el.text().trim();
		if (text) $el.replaceWith(`<pre><code class="language-mermaid">${text}</code></pre>`);
	});

	for (const img of $content.find("img").toArray()) {
		const $img = $(img);
		const src = $img.attr("src");
		if (!src || src.includes("yandex.ru")) { $img.remove(); continue; }
		const local = await downloadAsset(src, url);
		if (local) $img.attr("src", local);
	}

	$content.find("a[href^='/']").each((_, el) => {
		const $el = $(el);
		const href = $el.attr("href");
		if (href) $el.attr("href", `https://developers.tochka.com${href}`);
	});

	const md = td.turndown($content.html() ?? "").trim();
	const front = [
		"---",
		`source: ${url}`,
		`title: ${JSON.stringify(title)}`,
		description ? `description: ${JSON.stringify(description)}` : null,
		`scraped_at: ${new Date().toISOString().slice(0, 10)}`,
		"---",
		"",
	].filter(Boolean).join("\n");
	const body = `${front}\n# ${title}\n\n${md}\n`;
	console.log(`ok (${title}, ${body.length}B)`);
	return { slug: slugify(url, STRIP_PREFIX), body };
}

if (URLS.length === 0) { console.error("Usage: bun scrape.ts [--out DIR] [--strip-prefix P] URL..."); process.exit(1); }
await mkdir(OUT_DIR, { recursive: true });
for (const u of URLS) {
	const r = await scrape(u);
	if (r) await writeFile(join(OUT_DIR, `${r.slug}.md`), r.body);
}
console.log(`\nDone → ${OUT_DIR}`);
