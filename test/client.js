// Automated tester for httpbingo.org endpoints through CORS proxy

class EndpointTester {
	constructor(proxyUrl = 'http://localhost:8787', outputElement = null) {
		this.proxyUrl = proxyUrl;
		this.outputElement = outputElement || document.getElementById('testOutput');
		this.successes = 0;
		this.failures = 0;
		this.total = 0;
		this.streamCount = 5; // For SSE testing
	}

	// Helper methods
	async makeRequest(path, options = {}) {
		try {
			const url = `${this.proxyUrl}/?https://httpbingo.org${path}`;
			const response = await fetch(url, options);
			return { success: true, response, url };
		} catch (error) {
			return { success: false, error, path };
		}
	}

	log(message, isError = false) {
		const logEntry = document.createElement('div');
		logEntry.className = isError ? 'test-error' : 'test-log';
		logEntry.textContent = message;
		this.outputElement.appendChild(logEntry);
		this.outputElement.scrollTop = this.outputElement.scrollHeight;
	}

	async checkResponse(response, expectedStatus = 200) {
		// For unstable endpoint, accept any status code if expectedStatus is set to 'any'
		if (expectedStatus === 'any') {
			return { valid: true, status: response.status };
		}

		if (response.status !== expectedStatus) {
			return { valid: false, message: `Expected status ${expectedStatus}, got ${response.status}` };
		}

		// For HEAD requests, don't try to parse the body (there is none)
		if (response.method === 'HEAD' || (response.bodyUsed === false && response.headers.get('content-length') === '0')) {
			return { valid: true, headers: Object.fromEntries(response.headers.entries()) };
		}

		// Try to parse response as JSON if it has JSON content type
		const contentType = response.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			try {
				const data = await response.json();
				return { valid: true, data };
			} catch (e) {
				return { valid: false, message: 'Failed to parse JSON response' };
			}
		} else {
			const text = await response.text();
			return { valid: true, text };
		}
	}

	async runTest(name, path, options = {}, expectedStatus = 200, validator) {
		this.total++;
		this.log(`Testing ${name}: ${path}`);

		const result = await this.makeRequest(path, options);

		if (!result.success) {
			this.failures++;
			this.log(`❌ ${name} failed: ${result.error.message}`, true);
			return false;
		}

		const responseCheck = await this.checkResponse(result.response, expectedStatus);

		if (!responseCheck.valid) {
			this.failures++;
			this.log(`❌ ${name} failed: ${responseCheck.message}`, true);
			return false;
		}

		if (validator && !validator(responseCheck)) {
			this.failures++;
			this.log(`❌ ${name} failed validation`, true);
			return false;
		}

		this.successes++;
		this.log(`✅ ${name} passed`);
		return true;
	}

	// Individual endpoint test methods
	async testIndividualEndpoint(endpoint, method = 'GET', body = null, headers = {}) {
		this.log(`===== Testing Individual Endpoint =====`);
		this.log(`Endpoint: ${endpoint}`);
		this.log(`Method: ${method}`);

		try {
			const options = {
				method: method,
				headers: headers,
			};

			if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
				options.body = typeof body === 'string' ? body : JSON.stringify(body);
				if (!headers['Content-Type']) {
					options.headers['Content-Type'] = 'application/json';
				}
			}

			this.log(`Making request to ${endpoint}...`);
			const url = `${this.proxyUrl}/?https://httpbingo.org${endpoint}`;
			const response = await fetch(url, options);

			this.log(`Response Status: ${response.status} ${response.statusText}`);
			this.log(`Response Headers:`);

			response.headers.forEach((value, key) => {
				this.log(`  ${key}: ${value}`);
			});

			// Special handling for HEAD requests
			if (method === 'HEAD') {
				this.log(`Response is HEAD request - no body expected`);
				this.log(`Response Headers:`);

				response.headers.forEach((value, key) => {
					this.log(`  ${key}: ${value}`);
				});

				return {
					success: true,
					status: response.status,
					headers: Object.fromEntries(response.headers.entries()),
					body: null,
				};
			}

			// Try to parse response based on content type
			const contentType = response.headers.get('content-type') || '';
			let responseBody;

			if (contentType.includes('application/json')) {
				try {
					responseBody = await response.json();
					this.log(`Response Body (JSON):`);
					this.log(JSON.stringify(responseBody, null, 2));
				} catch (e) {
					this.log(`Failed to parse JSON response: ${e.message}`, true);
					responseBody = await response.text();
					this.log(`Response Body (Text):`);
					this.log(responseBody);
				}
			} else if (contentType.includes('image/')) {
				this.log(`Response is an image (${contentType})`);
				const blob = await response.blob();
				this.log(`Image size: ${blob.size} bytes`);

				// Create image preview
				const imagePreview = document.createElement('img');
				imagePreview.src = URL.createObjectURL(blob);
				imagePreview.style.maxWidth = '200px';
				imagePreview.style.maxHeight = '200px';
				imagePreview.style.border = '1px solid #ccc';
				imagePreview.style.marginTop = '10px';
				this.outputElement.appendChild(imagePreview);

				responseBody = `[Image: ${blob.size} bytes]`;
			} else {
				responseBody = await response.text();
				this.log(`Response Body (Text):`);
				this.log(responseBody);
			}

			return {
				success: true,
				status: response.status,
				headers: Object.fromEntries(response.headers.entries()),
				body: responseBody,
			};
		} catch (error) {
			this.log(`Error: ${error.message}`, true);
			return {
				success: false,
				error: error.message,
			};
		}
	}

	// Test categories
	async testBasicEndpoints() {
		this.log('===== Testing Basic Endpoints =====');
		await this.runTest('GET request', '/get');
		await this.runTest('POST request', '/post', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ test: 'data' }),
		});
		await this.runTest('PUT request', '/put', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ test: 'data' }),
		});
		await this.runTest('DELETE request', '/delete', { method: 'DELETE' });
		await this.runTest('PATCH request', '/patch', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ test: 'data' }),
		});

		// Special handling for HEAD request - don't expect a body
		this.log(`Testing HEAD request: /head`);
		this.total++;
		try {
			const result = await this.makeRequest('/head', { method: 'HEAD' });
			if (!result.success) {
				this.failures++;
				this.log(`❌ HEAD request failed: ${result.error.message}`, true);
			} else {
				// Just check status code and headers for HEAD requests
				if (result.response.status === 200) {
					this.successes++;
					this.log(`✅ HEAD request passed - Status: ${result.response.status}`);
					this.log(`Headers received: ${result.response.headers.size}`);
				} else {
					this.failures++;
					this.log(`❌ HEAD request failed: Unexpected status ${result.response.status}`, true);
				}
			}
		} catch (error) {
			this.failures++;
			this.log(`❌ HEAD request failed: ${error.message}`, true);
		}

		await this.runTest('Headers', '/headers');
		await this.runTest('User-Agent', '/user-agent');
		await this.runTest('IP', '/ip');
		await this.runTest('UUID', '/uuid');
		await this.runTest('Hostname', '/hostname');
		await this.runTest('Anything', '/anything/test123');
	}

	async testStatusCodes() {
		this.log('===== Testing Status Codes =====');
		await this.runTest('200 OK', '/status/200', {}, 200);
		await this.runTest('201 Created', '/status/201', {}, 201);
		await this.runTest('204 No Content', '/status/204', {}, 204);
		await this.runTest('400 Bad Request', '/status/400', {}, 400);
		await this.runTest('401 Unauthorized', '/status/401', {}, 401);
		await this.runTest('403 Forbidden', '/status/403', {}, 403);
		await this.runTest('404 Not Found', '/status/404', {}, 404);
		await this.runTest('500 Server Error', '/status/500', {}, 500);
	}

	async testResponseHeaders() {
		this.log('===== Testing Response Headers =====');
		await this.runTest('Custom Headers', '/response-headers?X-Test-Header=test-value');
		await this.runTest('Cache Control', '/cache/60');
		await this.runTest('ETag', '/etag/test-etag');
	}

	async testSpecialFormats() {
		this.log('===== Testing Special Formats =====');
		await this.runTest('JSON', '/json');
		await this.runTest('HTML', '/html');
		await this.runTest('XML', '/xml');
		await this.runTest('Links', '/links/5');
		await this.runTest('Robots.txt', '/robots.txt');
		await this.runTest('Forms', '/forms/post');
		await this.runTest('UTF-8 Encoding', '/encoding/utf8');
	}

	async testEncodingAndCompression() {
		this.log('===== Testing Encoding & Compression =====');
		await this.runTest('GZIP', '/gzip');
		await this.runTest('Deflate', '/deflate');
		// Brotli is not implemented in httpbingo.org

		// Base64
		await this.runTest('Base64 Encode', '/base64/encode/test_string');
		await this.runTest('Base64 Decode', '/base64/decode/dGVzdF9zdHJpbmc=');
	}

	async testAuthentication() {
		this.log('===== Testing Authentication =====');
		// Note: These tests are expected to fail without proper auth
		await this.runTest('Basic Auth (no credentials)', '/basic-auth/user/pass', {}, 401);

		// Add auth credentials
		const base64Credentials = btoa('user:pass');
		await this.runTest('Basic Auth (with credentials)', '/basic-auth/user/pass', {
			headers: { Authorization: `Basic ${base64Credentials}` },
		});

		await this.runTest('Bearer Auth (no token)', '/bearer', {}, 401);
		await this.runTest('Bearer Auth (with token)', '/bearer', {
			headers: { Authorization: 'Bearer test-token' },
		});

		// These tests are expected to fail without proper authentication
		await this.runTest('Digest Auth', '/digest-auth/auth/user/pass', {}, 401);
		await this.runTest('Hidden Basic Auth', '/hidden-basic-auth/user/pass', {}, 404);
	}

	async testStreaming() {
		this.log('===== Testing Streaming =====');
		await this.runTest('Stream 5 lines', '/stream/5');
		await this.runTest('Stream bytes (1000)', '/stream-bytes/1000');
		await this.runTest('Range response', '/range/1024?chunk_size=256');
		await this.runTest('Drip response', '/drip?numbytes=100&duration=1');
		// SSE is tested separately
	}

	async testRedirectsAndCookies() {
		this.log('===== Testing Redirects & Cookies =====');
		// Note: Some browsers/fetch implementations may follow redirects automatically
		await this.runTest('Redirect (1)', '/redirect/1');
		await this.runTest('Relative Redirect (1)', '/relative-redirect/1');
		await this.runTest('Absolute Redirect (1)', '/absolute-redirect/1');
		await this.runTest('Redirect To', '/redirect-to?url=https://httpbingo.org/get');

		// Cookies
		await this.runTest('Cookies set', '/cookies/set?name=testcookie&value=testvalue');
		await this.runTest('Cookies info', '/cookies');
		await this.runTest('Cookies delete', '/cookies/delete?name=testcookie');

		// Cache tests
		await this.runTest('Cache test', '/cache');
	}

	async testImages() {
		this.log('===== Testing Images =====');
		await this.runTest('JPEG image', '/image/jpeg');
		await this.runTest('PNG image', '/image/png');
		await this.runTest('SVG image', '/image/svg');
		await this.runTest('WEBP image', '/image/webp');
		await this.runTest('Dynamic image based on Accept', '/image', {
			headers: { Accept: 'image/webp,image/*,*/*' },
		});
	}

	async testDelayAndTimeout() {
		this.log('===== Testing Delay & Timeout =====');
		// Using short delays for testing
		await this.runTest('Delay (1s)', '/delay/1');

		// Special handling for unstable endpoint - accept any status code
		this.log(`Testing unstable endpoint - may succeed or fail`);
		this.total++;
		try {
			const result = await this.makeRequest('/unstable?failure_rate=0.5');
			if (!result.success) {
				this.failures++;
				this.log(`❌ Unstable endpoint test failed: ${result.error.message}`, true);
			} else {
				// For unstable endpoint, both success and failure responses are valid
				const status = result.response.status;
				if (status === 200) {
					this.successes++;
					this.log(`✅ Unstable endpoint returned success (200) - Test passed`);
				} else if (status === 500) {
					this.successes++;
					this.log(`✅ Unstable endpoint returned error (500) - This is expected behavior`);
				} else {
					this.failures++;
					this.log(`❌ Unstable endpoint returned unexpected status: ${status}`, true);
				}
			}
		} catch (error) {
			this.failures++;
			this.log(`❌ Unstable endpoint test error: ${error.message}`, true);
		}
	}

	async testTrailers() {
		this.log('===== Testing HTTP Trailers =====');
		await this.runTest('Trailers', '/trailers?test_trailer=test-value');
	}

	async testMiscEndpoints() {
		this.log('===== Testing Miscellaneous Endpoints =====');
		await this.runTest('Environment variables', '/env');
		await this.runTest('Request dump', '/dump/request');
		await this.runTest('Deny (robots.txt)', '/deny');
	}

	async testSSE() {
		return new Promise((resolve) => {
			this.log('===== Testing Server-Sent Events =====');
			this.total++;
			let successAlreadyRecorded = false;

			try {
				const url = `${this.proxyUrl}/?https://httpbingo.org/sse?duration=3s&count=${this.streamCount}`;
				this.log(`Opening SSE connection to ${url}`);

				const eventSource = new EventSource(url);
				let receivedMessages = 0;
				let userInitiatedClose = false;

				eventSource.onopen = () => {
					this.log('SSE connection opened');
				};

				// Function to handle SSE events with proper logging
				const handleSSEEvent = (event, type) => {
					try {
						if (event.data) {
							const data = JSON.parse(event.data);
							this.log(`[${type}] Received: ${JSON.stringify(data, null, 2)}`);

							// Count received messages
							receivedMessages++;

							// Check if we've received all expected messages
							if (receivedMessages >= this.streamCount && !successAlreadyRecorded) {
								this.successes++;
								successAlreadyRecorded = true;
								this.log(`✅ SSE test passed - Received all ${this.streamCount} messages`);

								// Auto-close after all messages received
								setTimeout(() => {
									if (eventSource.readyState !== EventSource.CLOSED) {
										userInitiatedClose = true;
										eventSource.close();
										resolve();
									}
								}, 500);
							}
						} else {
							this.log(`[${type}] Event received but no data`);
						}
					} catch (error) {
						this.log(`Error handling SSE event: ${error.message}`, true);
					}
				};

				// Listen for specific event types
				eventSource.addEventListener('message', (event) => {
					handleSSEEvent(event, 'message');
				});

				// Add generic event handler for unnamed events
				eventSource.onmessage = (event) => {
					handleSSEEvent(event, 'default');
				};

				// Listen for server events from httpbingo
				['server', 'id', 'data', 'ping'].forEach((eventType) => {
					eventSource.addEventListener(eventType, (event) => {
						handleSSEEvent(event, eventType);
					});
				});

				eventSource.onerror = (error) => {
					if (userInitiatedClose) {
						this.log('SSE connection closed by test');
					} else if (receivedMessages >= this.streamCount && !successAlreadyRecorded) {
						this.successes++;
						successAlreadyRecorded = true;
						this.log('✅ SSE test passed - Connection closed after receiving all messages');
					} else if (!successAlreadyRecorded) {
						this.failures++;
						this.log(`❌ SSE test failed: Connection error after only ${receivedMessages}/${this.streamCount} messages received`, true);
					}

					eventSource.close();
					resolve();
				};

				// Ensure the test doesn't hang
				setTimeout(() => {
					if (eventSource.readyState !== EventSource.CLOSED) {
						this.log('Closing SSE connection due to timeout');
						eventSource.close();

						if (!successAlreadyRecorded) {
							if (receivedMessages === 0) {
								this.failures++;
								this.log('❌ SSE test failed: No messages received in timeout period', true);
							} else if (receivedMessages < this.streamCount) {
								this.failures++;
								this.log(`❌ SSE test failed: Only received ${receivedMessages}/${this.streamCount} messages before timeout`, true);
							} else {
								this.successes++;
								successAlreadyRecorded = true;
								this.log(`✅ SSE test passed - Received ${receivedMessages}/${this.streamCount} messages`);
							}
						}

						resolve();
					}
				}, 15000);
			} catch (error) {
				this.failures++;
				this.log(`❌ SSE test failed: ${error.message}`, true);
				resolve();
			}
		});
	}

	async testWebSockets() {
		return new Promise((resolve) => {
			this.log('===== Testing WebSockets =====');
			this.total++;

			try {
				// Use a public WebSocket echo server for testing
				const targetUrl = 'wss://echo.websocket.org';

				// Convert HTTP proxy URL to WebSocket URL
				let wsProxyUrl = this.proxyUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');

				// Create the WebSocket URL through our proxy
				const wsUrl = `${wsProxyUrl}/?${targetUrl}`;

				this.log(`Connecting to WebSocket through proxy: ${wsUrl}`);

				// Create a WebSocket connection
				const ws = new WebSocket(wsUrl);

				// Track sent and received messages for testing
				const sentMessages = [];
				const receivedMessages = [];
				let connectionClosed = false;
				let messageCount = 0;
				let connectionReady = false; // Flag to track if connection is fully ready

				// Setup event handlers
				ws.onopen = () => {
					this.log('WebSocket connection opened, waiting to ensure proper establishment...');

					// Wait a moment to ensure system messages are processed
					setTimeout(() => {
						connectionReady = true;
						this.log('✅ WebSocket connection fully established, starting echo test');

						// Send the 5 test messages in sequence
						sendTestMessages();
					}, 1000); // Give a 1 second buffer for system messages and stability
				};

				// Function to send test messages sequentially
				const sendTestMessages = async () => {
					for (let i = 1; i <= 5; i++) {
						const testMessage = `Test message ${i} - ${Date.now()}`;
						sentMessages.push(testMessage);

						this.log(`Sending message ${i}/5: ${testMessage}`);
						ws.send(testMessage);

						// Add a small delay between messages
						await new Promise((r) => setTimeout(r, 500));
					}

					// Set a timeout to close if not all responses received
					setTimeout(() => {
						if (!connectionClosed && receivedMessages.length < 5) {
							this.log(`Timeout reached after receiving only ${receivedMessages.length}/5 messages`, true);
							ws.close();
						}
					}, 10000);
				};

				ws.onmessage = (event) => {
					// Check if it's a system message (may be JSON)
					try {
						const data = JSON.parse(event.data);
						if (data.type === 'system' || data.type === 'open') {
							this.log(`Received system message: ${JSON.stringify(data)}`);
							return; // Don't count system messages as echo responses
						}
					} catch (e) {
						// Not JSON or not a system message, process as normal echo
					}

					// Process regular message
					messageCount++;
					const msg = event.data;
					receivedMessages.push(msg);
					this.log(`Received message ${messageCount}/5: ${msg}`);

					// Once we have all 5 messages, verify and close
					if (receivedMessages.length === 5) {
						// Check if all sent messages were echoed back correctly
						const allMessagesEchoed = sentMessages.every((sent) => receivedMessages.some((received) => received === sent));

						if (allMessagesEchoed) {
							this.log(`✅ WebSocket echo test successful - All 5 messages echoed correctly`);
							this.successes++;
						} else {
							this.log(`❌ WebSocket echo test failed - Not all messages were echoed correctly`, true);

							// Find which messages weren't echoed
							const missingMessages = sentMessages.filter((sent) => !receivedMessages.some((received) => received === sent));

							if (missingMessages.length > 0) {
								this.log(`Messages not echoed: ${missingMessages.join(', ')}`, true);
							}

							this.failures++;
						}

						// Close the connection after verification
						ws.close();
					}
				};

				ws.onerror = (error) => {
					this.failures++;
					this.log(`❌ WebSocket error: ${error.message || 'Connection error'}`, true);

					if (!connectionClosed) {
						connectionClosed = true;
						ws.close();
						resolve();
					}
				};

				ws.onclose = (event) => {
					connectionClosed = true;

					if (receivedMessages.length === 0) {
						this.failures++;
						this.log(`❌ WebSocket connection closed without receiving any messages (code: ${event.code})`, true);
					} else if (receivedMessages.length < 5 && !this.failures) {
						this.failures++;
						this.log(`❌ WebSocket connection closed after receiving only ${receivedMessages.length}/5 messages`, true);
					}

					this.log(`WebSocket connection closed (code: ${event.code})`);
					resolve();
				};
			} catch (error) {
				this.failures++;
				this.log(`❌ WebSocket test failed: ${error.message}`, true);
				resolve();
			}
		});
	}

	showSummary() {
		// Calculate pass rate, ensuring it doesn't exceed 100%
		const passRate = Math.min(100, Math.round((this.successes / this.total) * 100)) || 0;
		const summaryClass = passRate > 80 ? 'test-success' : passRate > 50 ? 'test-warning' : 'test-error';

		const summary = document.createElement('div');
		summary.className = `test-summary ${summaryClass}`;
		summary.innerHTML = `
            <h3>Test Summary</h3>
            <p>Total tests: ${this.total}</p>
            <p>Passed: ${this.successes} (${passRate}%)</p>
            <p>Failed: ${this.failures}</p>
            <button id="downloadReport" class="download-btn">Download Report</button>
        `;

		this.outputElement.appendChild(summary);

		// Add event listener for the download button
		document.getElementById('downloadReport').addEventListener('click', () => {
			this.downloadReport(passRate);
		});
	}

	// Method to generate and download test report
	downloadReport(passRate) {
		// Get current date and time for filename
		const now = new Date();
		const dateTime = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

		// Create HTML content for the report
		const reportContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CORS Proxy Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
        h1, h2 { color: #333; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { background: #f8f8f8; padding: 15px; border-bottom: 2px solid #ddd; }
        .summary { 
            padding: 15px; 
            margin: 20px 0; 
            border-radius: 5px; 
            background-color: ${passRate > 80 ? '#dff0d8' : passRate > 50 ? '#fcf8e3' : '#f2dede'};
            border: 1px solid ${passRate > 80 ? '#d0e9c6' : passRate > 50 ? '#faf2cc' : '#ebcccc'};
            color: ${passRate > 80 ? '#3c763d' : passRate > 50 ? '#8a6d3b' : '#a94442'};
        }
        .log-entry { margin-bottom: 5px; padding: 5px; }
        .log-entry.error { color: #a94442; font-weight: bold; }
        .log-entry.success { color: #3c763d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CORS Proxy Test Report</h1>
            <p>Generated: ${now.toLocaleString()}</p>
            <p>Proxy URL: ${this.proxyUrl}</p>
        </div>
        
        <div class="summary">
            <h2>Test Summary</h2>
            <p>Total tests: ${this.total}</p>
            <p>Passed: ${this.successes} (${passRate}%)</p>
            <p>Failed: ${this.failures}</p>
        </div>
        
        <div class="results">
            <h2>Test Results</h2>
            ${Array.from(this.outputElement.children)
							.filter((el) => el.className !== 'test-summary')
							.map((el) => {
								const isError = el.className === 'test-error';
								return `<div class="log-entry ${isError ? 'error' : el.textContent.includes('✅') ? 'success' : ''}">${
									el.textContent
								}</div>`;
							})
							.join('\n')}
        </div>
    </div>
</body>
</html>
`;

		// Create a blob from the HTML content
		const blob = new Blob([reportContent], { type: 'text/html' });

		// Create a download link
		const downloadLink = document.createElement('a');
		downloadLink.href = URL.createObjectURL(blob);
		downloadLink.download = `cors-proxy-test-report-${dateTime}.html`;

		// Trigger the download
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);

		// Clean up
		setTimeout(() => URL.revokeObjectURL(downloadLink.href), 100);
	}

	async runAllTests() {
		// Reset counters
		this.successes = 0;
		this.failures = 0;
		this.total = 0;

		this.outputElement.innerHTML = '';
		this.log(`Starting all tests using proxy: ${this.proxyUrl}`);

		const startTime = performance.now();

		await this.testBasicEndpoints();
		await this.testStatusCodes();
		await this.testResponseHeaders();
		await this.testSpecialFormats();
		await this.testEncodingAndCompression();
		await this.testAuthentication();
		await this.testStreaming();
		await this.testRedirectsAndCookies();
		await this.testImages();
		await this.testDelayAndTimeout();
		await this.testTrailers();
		await this.testMiscEndpoints();
		await this.testSSE();
		await this.testWebSockets(); // Add WebSocket test

		const duration = ((performance.now() - startTime) / 1000).toFixed(2);
		this.log(`All tests completed in ${duration} seconds`);
		this.showSummary();
	}
}

// Initialize when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
	const proxyUrlInput = document.getElementById('proxyUrl');
	const runButton = document.getElementById('runAllTests');
	const output = document.getElementById('testOutput');
	const categoryButtons = document.querySelectorAll('[data-test-category]');

	// Individual endpoint test elements
	const individualEndpointSection = document.getElementById('individualEndpointSection');
	const endpointInput = document.getElementById('endpointInput');
	const methodSelect = document.getElementById('methodSelect');
	const requestBodyInput = document.getElementById('requestBodyInput');
	const headersInput = document.getElementById('headersInput');
	const testEndpointBtn = document.getElementById('testEndpointBtn');

	let tester = new EndpointTester(proxyUrlInput.value, output);

	proxyUrlInput.addEventListener('change', () => {
		tester = new EndpointTester(proxyUrlInput.value, output);
	});

	runButton.addEventListener('click', () => {
		tester.runAllTests();
	});

	categoryButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const category = button.dataset.testCategory;
			if (tester[`test${category}`]) {
				output.innerHTML = '';
				tester[`test${category}`]().then(() => {
					tester.showSummary();
				});
			}
		});
	});

	// Individual endpoint test handler
	if (testEndpointBtn) {
		testEndpointBtn.addEventListener('click', async () => {
			output.innerHTML = '';

			const endpoint = endpointInput.value;
			if (!endpoint) {
				tester.log('Please enter an endpoint path', true);
				return;
			}

			const method = methodSelect.value;

			// Parse request body if present and not a GET/HEAD request
			let body = null;
			if (requestBodyInput.value && ['POST', 'PUT', 'PATCH'].includes(method)) {
				try {
					body = JSON.parse(requestBodyInput.value);
				} catch (e) {
					// If not valid JSON, use as-is
					body = requestBodyInput.value;
					tester.log('Warning: Body is not valid JSON, using as raw text', false);
				}
			}

			// Parse headers
			let headers = {};
			if (headersInput.value) {
				try {
					headers = JSON.parse(headersInput.value);
				} catch (e) {
					tester.log('Warning: Headers are not valid JSON, using default headers', true);
				}
			}

			// Execute the test
			await tester.testIndividualEndpoint(endpoint, method, body, headers);
		});
	}

	// Method select change handler to show/hide body input
	if (methodSelect) {
		methodSelect.addEventListener('change', () => {
			const method = methodSelect.value;
			const bodySection = document.getElementById('bodySection');
			if (bodySection) {
				if (['POST', 'PUT', 'PATCH'].includes(method)) {
					bodySection.style.display = 'block';
				} else {
					bodySection.style.display = 'none';
				}
			}
		});
	}

	// Quick test buttons
	document.querySelectorAll('[data-endpoint]').forEach((button) => {
		button.addEventListener('click', async () => {
			output.innerHTML = '';
			const endpoint = button.dataset.endpoint;
			const method = button.dataset.method || 'GET';

			// Load values into the form for visibility
			if (endpointInput) endpointInput.value = endpoint;
			if (methodSelect) methodSelect.value = method;

			await tester.testIndividualEndpoint(endpoint, method);
		});
	});
	const automatedTestsTab = document.getElementById('automatedTestsTab');
	const individualEndpointTab = document.getElementById('individualEndpointTab');
	const automatedTestsSection = document.getElementById('automatedTestsSection');

	automatedTestsTab.addEventListener('click', () => {
		automatedTestsTab.classList.add('active');
		individualEndpointTab.classList.remove('active');
		automatedTestsSection.style.display = 'block';
		individualEndpointSection.style.display = 'none';
	});

	individualEndpointTab.addEventListener('click', () => {
		individualEndpointTab.classList.add('active');
		automatedTestsTab.classList.remove('active');
		individualEndpointSection.style.display = 'block';
		automatedTestsSection.style.display = 'none';
	});

	// Show/hide body input based on method
	if (methodSelect) {
		methodSelect.addEventListener('change', () => {
			const bodySection = document.getElementById('bodySection');
			if (['POST', 'PUT', 'PATCH'].includes(methodSelect.value)) {
				bodySection.style.display = 'block';
			} else {
				bodySection.style.display = 'none';
			}
		});
	}
});
