/*
CORS Proxy on Cloudflare Worker
https://github.com/x1yl/cloudflare-cors-anywhere
*/

// Configuration
const whitelistOrigins = ['.*'];
const blacklistUrls = [];
const CONTENT_TYPES = {
	SSE: 'text/event-stream',
	OCTET_STREAM: 'application/octet-stream',
};

// Security and validation
function isValidUrl(string) {
	try {
		new URL(string);
		return true;
	} catch {
		return false;
	}
}

function passesSecurityChecks(targetUrl, originHeader) {
	return (
		!blacklistUrls.some((pattern) => new RegExp(pattern).test(targetUrl)) &&
		(!originHeader || whitelistOrigins.some((pattern) => new RegExp(pattern).test(originHeader)))
	);
}

// Header processing
function filterRequestHeaders(originalHeaders) {
	const filtered = new Headers();
	const preserveHeaders = [
		'upgrade',
		'connection',
		'sec-websocket-key',
		'sec-websocket-version',
		'sec-websocket-protocol',
		'sec-websocket-extensions',
	];

	const excludedHeaders = /^(origin|referer|cf-|x-forw|x-cors-headers)/i;

	for (const [key, value] of originalHeaders.entries()) {
		const lowerKey = key.toLowerCase();
		if (preserveHeaders.includes(lowerKey) || !excludedHeaders.test(key)) {
			filtered.set(key, value);
		}
	}

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
	const originHeader = event.request.headers.get('Origin');
	headers.set('Access-Control-Allow-Origin', originHeader || '*');
	headers.set('Access-Control-Allow-Credentials', 'true');

	if (event.request.method === 'OPTIONS') {
		const requestMethod = event.request.headers.get('access-control-request-method');
		headers.set('Access-Control-Allow-Methods', requestMethod || 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');

		const requestedHeaders = event.request.headers.get('access-control-request-headers');
		if (requestedHeaders) {
			headers.set('Access-Control-Allow-Headers', requestedHeaders);
		} else {
			headers.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CORS-Headers');
		}

		headers.set('Access-Control-Max-Age', '86400');
		headers.delete('X-Content-Type-Options');
	}

	headers.set('Access-Control-Expose-Headers', '*');
	return headers;
}

// Request handling
async function handleProxyRequest(event, targetUrl) {
	const isPreflightRequest = event.request.method === 'OPTIONS';

	if (isPreflightRequest) {
		const headers = createCORSHeaders(event, new Headers());
		return new Response(null, {
			status: 204,
			statusText: 'No Content',
			headers,
		});
	}

	const newRequest = new Request(targetUrl, {
		method: event.request.method,
		headers: filterRequestHeaders(event.request.headers),
		body: event.request.body,
		redirect: 'follow',
	});

	try {
		const response = await fetch(newRequest);
		const responseHeaders = new Headers(response.headers);
		const corsHeaders = createCORSHeaders(event, responseHeaders);

		const allResponseHeaders = Object.fromEntries(response.headers.entries());
		corsHeaders.set('cors-received-headers', JSON.stringify(allResponseHeaders));

		const contentType = response.headers.get('content-type') || '';
		const isChunked = response.headers.get('transfer-encoding') === 'chunked';
		const isStreamable = contentType.includes(CONTENT_TYPES.SSE) || contentType.includes(CONTENT_TYPES.OCTET_STREAM) || isChunked;

		if (isStreamable) {
			if (contentType.includes(CONTENT_TYPES.SSE)) {
				corsHeaders.set('Content-Type', CONTENT_TYPES.SSE);
				corsHeaders.set('Cache-Control', 'no-cache');
				corsHeaders.set('Connection', 'keep-alive');

				return new Response(processEventStream(response.body), {
					headers: corsHeaders,
					status: response.status,
					statusText: response.statusText,
				});
			}

			return new Response(response.body, {
				headers: corsHeaders,
				status: response.status,
				statusText: response.statusText,
			});
		}

		const responseBody = await response.arrayBuffer();
		return new Response(responseBody, {
			headers: corsHeaders,
			status: response.status,
			statusText: response.statusText,
		});
	} catch (error) {
		const errorHeaders = createCORSHeaders(
			event,
			new Headers({
				'Content-Type': 'application/json',
			})
		);

		return new Response(
			JSON.stringify({
				error: error.message,
				status: 'error',
			}),
			{
				status: 500,
				statusText: 'Internal Server Error',
				headers: errorHeaders,
			}
		);
	}
}

function processEventStream(body) {
	const reader = body.getReader();
	const encoder = new TextEncoder();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	return new ReadableStream({
		start(controller) {
			async function pump() {
				try {
					while (true) {
						const { done, value } = await reader.read();

						if (done) {
							if (buffer.length > 0) {
								controller.enqueue(encoder.encode(buffer));
							}
							controller.close();
							break;
						}

						buffer += decoder.decode(value, { stream: true });

						const events = buffer.split(/\r\n\r\n|\n\n/);
						buffer = events.pop() || '';

						if (events.length > 0) {
							const formattedEvents = events.map((event) => `${event}\n\n`).join('');
							controller.enqueue(encoder.encode(formattedEvents));
						}
					}
				} catch (err) {
					if (err.name === 'AbortError' || err.message?.includes('aborted')) {
						if (buffer.length > 0) {
							controller.enqueue(encoder.encode(buffer));
						}
						controller.close();
					} else {
						controller.error(err);
					}
				}
			}

			pump();
		},
		cancel() {
			reader.cancel('Stream cancelled by client').catch((err) => console.error('Error cancelling reader:', err));
		},
	});
}

// WebSocket handling
async function handleWebSocketOverHTTP(request, targetUrl) {
	try {
		let wsTargetUrl = targetUrl;
		if (targetUrl.startsWith('http://')) {
			wsTargetUrl = targetUrl.replace('http://', 'ws://');
		} else if (targetUrl.startsWith('https://')) {
			wsTargetUrl = targetUrl.replace('https://', 'wss://');
		}

		const acceptHeader = request.headers.get('Accept');
		const wantsSSE = acceptHeader && acceptHeader.includes('text/event-stream');

		if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			server.accept();

			const targetWebSocket = new WebSocket(wsTargetUrl);
			let targetConnected = false;

			targetWebSocket.addEventListener('open', () => {
				targetConnected = true;
				server.send(
					JSON.stringify({
						type: 'system',
						message: 'WebSocket connection established',
					})
				);
			});

			targetWebSocket.addEventListener('message', (event) => {
				if (server.readyState === 1) {
					server.send(event.data);
				}
			});

			targetWebSocket.addEventListener('close', (event) => {
				targetConnected = false;
				if (server.readyState === 1) {
					server.close(event.code, event.reason || 'Target connection closed');
				}
			});

			targetWebSocket.addEventListener('error', (error) => {
				if (server.readyState === 1) {
					server.send(
						JSON.stringify({
							type: 'error',
							message: 'WebSocket connection error',
						})
					);
					server.close(1011, 'Error in target WebSocket');
				}
			});

			server.addEventListener('message', (event) => {
				if (targetConnected && targetWebSocket.readyState === 1) {
					targetWebSocket.send(event.data);
				} else if (server.readyState === 1) {
					server.send(
						JSON.stringify({
							type: 'error',
							message: 'Target WebSocket not ready',
						})
					);
				}
			});

			return new Response(null, {
				status: 101,
				statusText: 'Switching Protocols',
				headers: {
					Upgrade: 'websocket',
					Connection: 'Upgrade',
					'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
					'Access-Control-Allow-Credentials': 'true',
				},
				webSocket: client,
			});
		} else if (wantsSSE || request.url.includes('eventsource=true')) {
			const { readable, writable } = new TransformStream();
			const encoder = new TextEncoder();
			const writer = writable.getWriter();

			const targetWebSocket = new WebSocket(wsTargetUrl);

			writer.write(
				encoder.encode(
					`data: ${JSON.stringify({
						type: 'system',
						message: 'Establishing WebSocket connection...',
					})}\n\n`
				)
			);

			targetWebSocket.addEventListener('open', () => {
				writer.write(
					encoder.encode(
						`data: ${JSON.stringify({
							type: 'open',
							message: 'WebSocket connection established',
						})}\n\n`
					)
				);
			});

			targetWebSocket.addEventListener('message', (event) => {
				writer.write(
					encoder.encode(
						`data: ${JSON.stringify({
							type: 'message',
							data: event.data,
						})}\n\n`
					)
				);
			});

			targetWebSocket.addEventListener('close', (event) => {
				writer.write(
					encoder.encode(
						`data: ${JSON.stringify({
							type: 'close',
							code: event.code,
							reason: event.reason || 'Connection closed',
						})}\n\n`
					)
				);

				writer.close();
			});

			targetWebSocket.addEventListener('error', () => {
				writer.write(
					encoder.encode(
						`data: ${JSON.stringify({
							type: 'error',
							message: 'WebSocket connection error',
						})}\n\n`
					)
				);
			});

			if (request.method === 'POST') {
				const body = await request.text();
				if (body) {
					targetWebSocket.send(body);
				}
			}

			const headers = new Headers({
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			});

			const responseHeaders = createCORSHeaders({ request }, headers);

			return new Response(readable, {
				headers: responseHeaders,
			});
		} else {
			return new Response(
				JSON.stringify({
					success: true,
					message: "This is a WebSocket URL but you're accessing it via HTTP.",
					targetUrl: wsTargetUrl,
					instructions:
						"To use this WebSocket endpoint, connect with a WebSocket client or use EventSource with 'eventsource=true' parameter.",
				}),
				{
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
						'Access-Control-Allow-Headers': '*',
					},
				}
			);
		}
	} catch (error) {
		const headers = new Headers({
			'Content-Type': 'application/json',
		});
		const responseHeaders = createCORSHeaders({ request }, headers);

		return new Response(
			JSON.stringify({
				error: error.message,
				success: false,
			}),
			{
				status: 500,
				headers: responseHeaders,
			}
		);
	}
}

// Landing page
function createLandingPage(url) {
	const html = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CORS Proxy</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 80vw;
          margin: 0 auto;
          padding: 20px;
        }
        
        .container {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 25px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
          color: #2c3e50;
          border-bottom: 2px solid #3498db;
          padding-bottom: 10px;
        }
        
        h2 {
          color: #3498db;
          margin-top: 25px;
        }
        
        code {
          background: #f4f4f4;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #ddd;
          font-family: Consolas, Monaco, 'Courier New', monospace;
          word-break: break-all;
        }
        
        ul {
          padding-left: 20px;
        }
        
        li {
          margin-bottom: 8px;
        }
        
        footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 0.9rem;
        }
        
        a {
          color: #3498db;
          text-decoration: none;
        }
        
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to CORS Proxy using Cloudflare Workers</h1>
        <p>This is a Cloudflare Worker-based CORS proxy service. For more information and how to deploy your own proxy, <a href="https://github.com/x1yl/cors-proxy">click here</a>.</p>
        
        <h2>How to Use</h2>
        <p>Append your target URL as a query parameter:</p>
        <p><code>${url.origin}/?https://api.example.com/data</code></p>
        <i>or</i>
        <p><code>${url.origin}/?link=https://api.example.com/data</code></p>
        
        <h2>WebSocket Support</h2>
        <p>This proxy also supports WebSocket connections:</p>
        <p><code>ws://${url.host}/?wss://echo.websocket.org</code></p>
        
        <h2>Features</h2>
        <ul>
          <li>Automatic CORS headers</li>
          <li>Supports GET, POST, PUT, DELETE methods</li>
          <li>WebSocket proxying support</li>
          <li>Header passthrough</li>
          <li>Server-Sent Events (SSE) support</li>
          <li>HTTPS only</li>
        </ul>
        
        <h2>Example</h2>
        <p>Fetch data from an API:</p>
        <p><code>fetch("${url.origin}/?https://api.example.com/data")</code></p>
        
        <footer>
          <p>Powered by <a href="https://workers.cloudflare.com" target="_blank">Cloudflare Workers</a></p>
          <p>Based on <a href="https://github.com/Zibri/cloudflare-cors-anywhere" target="_blank">Zibri's CORS Anywhere</a></p>
          <a href="https://www.buymeacoffee.com/xtyl"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="200"></a>
        </footer>
      </div>
    </body>
  </html>
  `;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html',
			'Cache-Control': 'no-store',
		},
	});
}

// Main handler
export default {
	async fetch(request) {
		const url = new URL(request.url);
		const isPreflightRequest = request.method === 'OPTIONS';

		if (isPreflightRequest) {
			const corsHeaders = createCORSHeaders({ request }, new Headers());
			return new Response(null, {
				headers: corsHeaders,
				status: 204,
			});
		}

		if (url.search === '') {
			return createLandingPage(url);
		}

		let targetUrl = url.searchParams.get('link');
		if (!targetUrl) {
			targetUrl = decodeURIComponent(url.search.slice(1));
		} else {
			targetUrl = decodeURIComponent(targetUrl);
		}

		if (!isValidUrl(targetUrl)) {
			const errorHeaders = createCORSHeaders(
				{ request },
				new Headers({
					'Content-Type': 'text/plain',
				})
			);

			return new Response('Invalid URL format', {
				status: 400,
				statusText: 'Bad Request',
				headers: errorHeaders,
			});
		}

		if (!passesSecurityChecks(targetUrl, request.headers.get('Origin'))) {
			const errorHeaders = createCORSHeaders(
				{ request },
				new Headers({
					'Content-Type': 'text/plain',
				})
			);

			return new Response('Blocked by security rules', {
				status: 403,
				statusText: 'Forbidden',
				headers: errorHeaders,
			});
		}

		try {
			const isWsTarget = targetUrl.startsWith('ws://') || targetUrl.startsWith('wss://');

			if (isWsTarget) {
				return await handleWebSocketOverHTTP(request, targetUrl);
			} else {
				return await handleProxyRequest({ request }, targetUrl);
			}
		} catch (error) {
			const corsHeaders = createCORSHeaders(
				{ request },
				new Headers({
					'Content-Type': 'application/json',
				})
			);

			return new Response(
				JSON.stringify({
					error: error.message,
					success: false,
				}),
				{
					status: 500,
					statusText: 'Internal Server Error',
					headers: corsHeaders,
				}
			);
		}
	},
};
