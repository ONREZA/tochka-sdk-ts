export function slugify(url: string, stripPrefix: string): string {
	const pathname = new URL(url).pathname;
	const path = pathname.startsWith(stripPrefix) ? pathname.slice(stripPrefix.length) : pathname;
	return (path || "index").replace(/\/$/, "").replace(/\//g, "-");
}
