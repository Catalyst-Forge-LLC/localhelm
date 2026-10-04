function esc(value: string): string {
	return value.replace(/[&<>"']/g, (ch) => {
		if (ch === '&') return '&amp;';
		if (ch === '<') return '&lt;';
		if (ch === '>') return '&gt;';
		if (ch === '"') return '&quot;';
		return '&#39;';
	});
}

/** Same plate as LocalSlip's not-up page. Inlined so this file does not import the other repo. */
export function slipOpenPage(opts: { title: string; heading: string; detail: string; hint: string }): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(opts.title)}</title>
<style>
html, body { height: 100%; margin: 0; }
body {
  background:
    linear-gradient(rgb(126 244 255 / 0.11) 1px, transparent 1px) 0 0 / 100% 1.25rem,
    linear-gradient(90deg, rgb(126 244 255 / 0.11) 1px, transparent 1px) 0 0 / 1.25rem 100%,
    #03060c;
  color: #ececef;
  font: 15px/1.45 ui-sans-serif, system-ui, sans-serif;
  display: grid;
  place-items: center;
  padding: 1.5rem;
}
main {
  width: min(28rem, 100%);
  background: rgb(12 22 40 / 0.72);
  border: 1px solid #3a5a70;
  border-radius: 0 0 8px 8px;
  padding: 1.25rem 1.35rem 1.4rem;
  box-shadow: 0 16px 36px rgb(0 0 0 / 0.45), 0 0 22px rgb(126 244 255 / 0.22);
}
.mark { margin: 0; color: #7ef4ff; letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.78rem; font-weight: 700; }
h1 { margin: 0.55rem 0 0; font-size: 1.45rem; font-weight: 600; color: #fde68a; }
p { margin: 0.7rem 0 0; color: #a8a8b0; }
.hint { color: #ececef; }
a { color: #7ef4ff; }
</style>
</head>
<body>
<main>
<p class="mark">Slip</p>
<h1>${esc(opts.heading)}</h1>
<p>${esc(opts.detail)}</p>
<p class="hint">${esc(opts.hint)}</p>
<p><a href="/">Back to the board</a></p>
</main>
</body>
</html>`;
}
