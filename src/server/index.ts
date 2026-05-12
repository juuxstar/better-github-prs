import express, { type Request } from 'express';
import { existsSync }            from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { dirname, resolve }      from 'path';
import { fileURLToPath }         from 'url';

const moduleDir = dirname(fileURLToPath(import.meta.url));

const CLIENT_ID       = process.env.GITHUB_CLIENT_ID || 'Ov23li1HRzJJ8O56Pz5p';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL       = 'https://github.com/login/oauth/access_token';
const REQUIRED_GITHUB_SCOPES = [ 'repo', 'read:org' ];
const GITHUB_SCOPES          = [
	...new Set([
		...REQUIRED_GITHUB_SCOPES,
		...(process.env.GITHUB_OAUTH_SCOPES || '').split(/\s+/).filter(Boolean),
	]),
].join(' ');

const app = express();
app.use(express.json());

// --- GitHub App device-flow routes ---

app.post('/api/auth/device-code', async function(_req, res) {
	try {
		const response = await fetch(DEVICE_CODE_URL, {
			method  : 'POST',
			headers : { 'Content-Type' : 'application/json', 'Accept' : 'application/json' },
			body    : JSON.stringify({ client_id : CLIENT_ID, scope : GITHUB_SCOPES }),
		});
		res.json(await response.json());
	}
	catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		res.status(502).json({ error : message });
	}
});

app.post('/api/auth/poll-token', async function(req, res) {
	try {
		const deviceCode = (req.body as { device_code?: string }).device_code;
		const response   = await fetch(TOKEN_URL, {
			method  : 'POST',
			headers : { 'Content-Type' : 'application/json', 'Accept' : 'application/json' },
			body    : JSON.stringify({
				client_id   : CLIENT_ID,
				device_code : deviceCode,
				grant_type  : 'urn:ietf:params:oauth:grant-type:device_code',
			}),
		});
		res.json(await response.json());
	}
	catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		res.status(502).json({ error : message });
	}
});

// --- GitHub API proxy ---

app.use(
	'/api/github',
	createProxyMiddleware({
		target       : 'https://api.github.com',
		changeOrigin : true,
		pathRewrite  : { '^/api/github' : '' },
		on           : {
			proxyReq(proxyReq, req) {
				const auth = req.headers.authorization;
				if (auth) {
					proxyReq.setHeader('Authorization', auth);
				}

				// Express.json() consumes the raw body stream before the proxy sees it,
				// so re-serialize and rewrite Content-Length for POST/PATCH/PUT requests.
				const body = (req as Request).body;
				if (body && typeof body === 'object' && Object.keys(body).length > 0) {
					const bodyData = JSON.stringify(body);
					proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData).toString());
					proxyReq.write(bodyData);
				}
			},
		},
	})
);

// --- Serve SPA in production ---

const distDir = resolve(moduleDir, '..', '..', 'dist');
if (existsSync(distDir)) {
	app.use(express.static(distDir));
	app.get('*', (_req, res) => {
		res.sendFile(resolve(distDir, 'index.html'));
	});
}

const PORT = parseInt(process.env.PORT || '3002', 10);
app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});
