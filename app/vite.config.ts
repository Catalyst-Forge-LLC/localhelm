import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
	plugins: [
		{
			name: 'localhelm-long-jobs',
			configureServer(server) {
				// Ship (build + wrangler) can sit minutes with no bytes. Default socket timeouts drop the browser fetch.
				const disable = (): void => {
					server.httpServer?.setTimeout(0);
				};
				disable();
				server.httpServer?.on('listening', disable);
			},
		},
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
			},
			adapter: adapter(),
		}),
	],
	server: {
		host: '0.0.0.0',
		// Tailscale MagicDNS (*.ts.net) and other LAN names. IPs are already allowed.
		// Write APIs stay loopback-only in hooks.server.ts.
		allowedHosts: true,
		fs: { allow: [repoRoot] },
	},
	resolve: {
		alias: {
			$helm: path.join(repoRoot, 'src/lib'),
		},
	},
});
