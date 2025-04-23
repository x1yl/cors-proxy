/*
CORS Proxy on Cloudflare Worker!
(c) 2025 by Kevin (www.kevinzheng.fyi)
email: contact AT kevinzheng DOT fyi
https://github.com/x1yl/cloudflare-cors-anywhere
Based on Zibri's CORS Anywhere
https://github.com/Zibri/cloudflare-cors-anywhere

This Cloudflare Worker script acts as a CORS proxy that allows
cross-origin resource sharing for specified origins and URLs.
It handles OPTIONS preflight requests and modifies response headers accordingly to enable CORS.
The script also includes functionality to parse custom headers and provide detailed information
about the CORS proxy service when accessed without specific parameters.
The script is configurable with whitelist and blacklist patterns.
The main goal is to facilitate cross-origin requests while enforcing specific security and rate-limiting policies.
*/

// ======================
// CONFIGURATION
// ======================
const whitelistOrigins = ['.*']; // Allow all origins by default
const blacklistUrls = [];
const CONTENT_TYPES = {
	SSE: 'text/event-stream',
	OCTET_STREAM: 'application/octet-stream',
};

// ======================
// SECURITY FUNCTIONS
// ======================
function passesSecurityChecks(targetUrl, originHeader) {
	return !isBlacklisted(targetUrl) && isWhitelisted(originHeader);
}

function isBlacklisted(url) {
	return blacklistUrls.some((pattern) => new RegExp(pattern).test(url));
}

function isWhitelisted(origin) {
	if (!origin) return true;
	return whitelistOrigins.some((pattern) => new RegExp(pattern).test(origin));
}

function isValidUrl(string) {
	try {
		new URL(string);
		return true;
	} catch {
		return false;
	}
}

// ======================
// HEADER MANAGEMENT
// ======================
function filterRequestHeaders(originalHeaders) {
	const filtered = new Headers();
	const excludedHeaders = /^(origin|referer|cf-|x-forw|x-cors-headers)/i;

	for (const [key, value] of originalHeaders.entries()) {
		if (!excludedHeaders.test(key)) {
			filtered.set(key, value);
		}
	}

	// Process custom headers if present
	const customHeaders = originalHeaders.get('x-cors-headers');
	if (customHeaders) {
		try {
			Object.entries(JSON.parse(customHeaders)).forEach(([key, value]) => {
				filtered.set(key, value);
			});
		} catch (e) {
			console.error('Invalid x-cors-headers:', e);
		}
	}

	return filtered;
}

function createCORSHeaders(event, headers) {
	headers.set('Access-Control-Allow-Origin', event.request.headers.get('Origin') || '*');

	if (event.request.method === 'OPTIONS') {
		headers.set('Access-Control-Allow-Methods', event.request.headers.get('access-control-request-method') || '*');

		const requestedHeaders = event.request.headers.get('access-control-request-headers');
		if (requestedHeaders) {
			headers.set('Access-Control-Allow-Headers', requestedHeaders);
		}
		headers.delete('X-Content-Type-Options');
	}

	return headers;
}

// ======================
// REQUEST PROCESSING
// ======================
async function handleProxyRequest(event, targetUrl) {
	const isPreflightRequest = event.request.method === 'OPTIONS';
	const newRequest = new Request(targetUrl, {
		method: event.request.method,
		headers: filterRequestHeaders(event.request.headers),
		body: isPreflightRequest ? null : event.request.body,
		redirect: 'follow',
	});

	const response = await fetch(newRequest);
	const responseHeaders = createCORSHeaders(event, new Headers(response.headers));

	// Setup exposed CORS headers
	const exposedHeaders = [...response.headers.keys(), 'cors-received-headers'];
	responseHeaders.set('Access-Control-Expose-Headers', exposedHeaders.join(','));
	responseHeaders.set('cors-received-headers', JSON.stringify(Object.fromEntries(response.headers)));

	// Check for streaming responses
	const contentType = response.headers.get('content-type') || '';
	const isChunked = response.headers.get('transfer-encoding') === 'chunked';
	const isStreamable = new RegExp(`^(${CONTENT_TYPES.SSE}|${CONTENT_TYPES.OCTET_STREAM})`, 'i').test(contentType) || isChunked;

	if (isStreamable && !isPreflightRequest) {
		// Handle Server-Sent Events specifically
		if (new RegExp(`^${CONTENT_TYPES.SSE}`, 'i').test(contentType)) {
			responseHeaders.set('Content-Type', CONTENT_TYPES.SSE);
			responseHeaders.set('Cache-Control', 'no-cache');
			responseHeaders.set('Connection', 'keep-alive');

			// Create a ReadableStream from the SSE response
			const reader = response.body.getReader();
			const encoder = new TextEncoder();
			const decoder = new TextDecoder('utf-8');

			const stream = new ReadableStream({
				start(controller) {
					async function pump() {
						try {
							while (true) {
								const { done, value } = await reader.read();

								if (done) {
									controller.close();
									break;
								}

								// Force proper UTF-8 decoding and re-encoding to ensure line breaks are preserved
								const text = decoder.decode(value, { stream: true });
								const reEncoded = encoder.encode(text);

								controller.enqueue(reEncoded);
							}
						} catch (err) {
							console.error('SSE Stream Error:', err);
							controller.error(err);
						}
					}

					pump();
				},
			});

			return new Response(stream, {
				headers: responseHeaders,
				status: response.status,
				statusText: response.statusText,
			});
		}

		// For other stream types (binary, chunked, etc.)
		return new Response(response.body, {
			headers: responseHeaders,
			status: response.status,
			statusText: response.statusText,
		});
	}

	// Handle non-streamed responses normally
	const responseBody = isPreflightRequest ? null : await response.arrayBuffer();
	return new Response(responseBody, {
		headers: responseHeaders,
		status: isPreflightRequest ? 200 : response.status,
		statusText: isPreflightRequest ? 'OK' : response.statusText,
	});
}

// ======================
// WEBSOCKET HANDLING
// ======================
async function handleWebSocketRequest(request, targetUrl) {
	// Parse the target URL to create the WebSocket connection
	const url = new URL(targetUrl);
	const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	const wsUrl = `${wsProtocol}//${url.host}${url.pathname}${url.search}`;

	// Create and return a WebSocketPair
	const webSocketPair = new WebSocketPair();
	const [client, server] = Object.values(webSocketPair);

	server.accept();

	// Connect to the target WebSocket
	const targetWebSocket = new WebSocket(wsUrl);

	// Forward messages from client to target
	server.addEventListener('message', (event) => {
		if (targetWebSocket.readyState === 1) {
			// OPEN
			targetWebSocket.send(event.data);
		}
	});

	// Forward messages from target to client
	targetWebSocket.addEventListener('message', (event) => {
		server.send(event.data);
	});

	// Handle closing from either end
	server.addEventListener('close', () => {
		if (targetWebSocket.readyState === 1) {
			targetWebSocket.close();
		}
	});

	targetWebSocket.addEventListener('close', () => {
		if (server.readyState === 1) {
			server.close();
		}
	});

	// Handle errors
	server.addEventListener('error', (err) => {
		console.error('Server WebSocket error:', err);
		if (targetWebSocket.readyState === 1) {
			targetWebSocket.close();
		}
	});

	targetWebSocket.addEventListener('error', (err) => {
		console.error('Target WebSocket error:', err);
		if (server.readyState === 1) {
			server.close(1011, 'Error connecting to target WebSocket');
		}
	});

	return new Response(null, {
		status: 101,
		webSocket: client,
	});
}

// ======================
// LANDING PAGE
// ======================
function createLandingPage(originUrl) {
	const html = `<!DOCTYPE html>
                <html>
                <head>
                    <title>CORS Proxy Service</title>
                    <style>
                        body {
                            background:rgb(54, 54, 54);
                            max-width: 90vw;
                            font-family: Arial, sans-serif;
                            margin: 0 auto;
                            padding: 2rem;
                            line-height: 1.6;
                            color: #333;
                        }
                        h1 {
                            color: #2c3e50;
                            border-bottom: 1px solid #eee;
                            padding-bottom: 0.5rem;
                        }
                        code {
                            background: #f5f5f5;
                            padding: 0.2rem 0.4rem;
                            border-radius: 3px;
                            font-family: monospace;
                        }
                        .container {
                            background: #f9f9f9;
                            padding: 2rem;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        a {
                            color: #3498db;
                            text-decoration: none;
                        }
                        a:hover {
                            text-decoration: underline;
                        }
                        footer {
                            margin-top: 2rem;
                            text-align: center;
                            color: #7f8c8d;
                            font-size: 0.9rem;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Welcome to CORS Proxy</h1>
                        <p>This is a Cloudflare Worker-based CORS proxy service. For more information and how to deploy your own proxy, <a href="https://github.com/Zibri/cloudflare-cors-anywhere">click here</a>.</p>
                        
                        <h2>How to Use</h2>
                        <p>Append your target URL as a query parameter:</p>
                        <p><code>${originUrl.origin}/?https://httpbin.org/get</code></p>
                        <i>or</i>
                        <p><code>${originUrl.origin}/?link=https://httpbin.org/get</code></p>
                        
                        <h2>Features</h2>
                        <ul>
                            <li>Automatic CORS headers</li>
                            <li>Supports GET, POST, PUT, DELETE methods</li>
                            <li>Header passthrough</li>
                            <li>HTTPS only</li>
                        </ul>
                        
                        <h2>Example</h2>
                        <p>Fetch data from an API:</p>
                        <p><code>fetch("${originUrl.origin}/?https://api.example.com/data")</code></p>
                        
                        <footer>
                            <p>Powered by <a href="https://workers.cloudflare.com" target="_blank">Cloudflare Workers</a></p>
                            <p>Based on <a href="https://github.com/Zibri/cloudflare-cors-anywhere" target="_blank">Zibri's CORS Anywhere</a></p>
                            <a href="https://www.buymeacoffee.com/xtyl"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="200" /></a>
                        </footer>
                    </div>
                </body>
                </html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html',
			'Cache-Control': 'no-cache',
			...Object.fromEntries(createCORSHeaders({ request: new Request(originUrl) }, new Headers())),
		},
	});
}

// ======================
// MAIN HANDLER
// ======================
export default {
	async fetch(request) {
		const url = new URL(request.url);
		const isPreflightRequest = request.method === 'OPTIONS';
		const isWebSocketRequest = request.headers.get('upgrade')?.toLowerCase() === 'websocket';

		// Handle preflight requests
		if (isPreflightRequest) {
			return new Response(null, {
				headers: createCORSHeaders({ request }, new Headers()),
				status: 204,
			});
		}

		// Show landing page if no query parameters
		if (url.search === '') {
			return createLandingPage(url);
		}

		// Get target URL - supports both ?link=URL and ?URL formats
		let targetUrl = url.searchParams.get('link');
		if (!targetUrl) {
			// Handle ?https://example.com format (direct URL)
			targetUrl = decodeURIComponent(url.search.slice(1));
		} else {
			targetUrl = decodeURIComponent(targetUrl);
		}

		// Security checks
		if (!isValidUrl(targetUrl)) {
			return new Response('Invalid URL format', {
				status: 400,
				statusText: 'Bad Request',
			});
		}

		if (!passesSecurityChecks(targetUrl, request.headers.get('Origin'))) {
			return new Response('Blocked by security rules', {
				status: 403,
				statusText: 'Forbidden',
			});
		}

		// Process request based on type
		try {
			if (isWebSocketRequest) {
				return await handleWebSocketRequest(request, targetUrl);
			} else {
				return await handleProxyRequest({ request }, targetUrl);
			}
		} catch (error) {
			return new Response(`Error: ${error.message}`, {
				status: 500,
				statusText: 'Internal Server Error',
				headers: createCORSHeaders({ request }, new Headers()),
			});
		}
	},
};
