/** Top-down empty berth. Cyan piers, a gold painter with nothing on the end. */
function emptyBerth(): string {
	return `<svg class="glyph" viewBox="0 0 168 104" aria-hidden="true">
<path d="M16 26 H152" stroke="#3a5a70" stroke-width="3" fill="none"/>
<path d="M34 26 V90" stroke="#7ef4ff" stroke-width="3" fill="none"/>
<path d="M134 26 V90" stroke="#7ef4ff" stroke-width="3" fill="none"/>
<rect x="42" y="34" width="84" height="52" fill="rgb(126 244 255 / 0.07)"/>
<path d="M72 26 H96" stroke="#c9a227" stroke-width="2.5" fill="none"/>
<path d="M84 26 V58" stroke="#c9a227" stroke-width="1.6" stroke-dasharray="3 3.5" fill="none"/>
<circle cx="84" cy="66" r="3.2" fill="none" stroke="#fde68a" stroke-width="1.4"/>
<path d="M46 92 H70 M98 92 H122" stroke="#3a5a70" stroke-width="1.6" fill="none"/>
</svg>`;
}

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
.head { display: flex; gap: 0.9rem; align-items: center; }
.glyph { flex: none; width: 5.75rem; height: auto; }
.mark { margin: 0; color: #7ef4ff; letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.78rem; font-weight: 700; }
h1 { margin: 0.55rem 0 0; font-size: 1.45rem; font-weight: 600; color: #fde68a; }
p { margin: 0.7rem 0 0; color: #a8a8b0; }
.hint { color: #ececef; }
a { color: #7ef4ff; }
</style>
</head>
<body>
<main>
<div class="head">
${emptyBerth()}
<div>
<p class="mark">Slip</p>
<h1>${esc(opts.heading)}</h1>
</div>
</div>
<p>${esc(opts.detail)}</p>
<p class="hint">${esc(opts.hint)}</p>
<p><a href="/">Back to the board</a></p>
</main>
</body>
</html>`;
}
