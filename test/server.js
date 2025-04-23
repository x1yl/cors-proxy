const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Add JSON and URL-encoded body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure CORS for direct testing without proxy
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Custom-Header, Authorization');
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}
	next();
});

// Standard endpoint
app.get('/', (req, res) => {
	res.send('Test Server for CORS Proxy - Use /stream for streaming data or /ws for WebSockets');
});

// Streaming data endpoint
app.get('/stream', (req, res) => {
	// Set appropriate headers for streaming
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');

	let count = 0;

	// Send a message every second
	const interval = setInterval(() => {
		const data = {
			timestamp: new Date().toISOString(),
			message: `Stream message #${count}`,
			count: count,
		};

		res.write(`data: ${JSON.stringify(data)}\n\n`);
		count++;

		// Stop after 60 messages (1 minute)
		// In your testServer.js stream endpoint
		if (count > 30) {
			// Send end message before closing
			const endData = {
				type: 'end',
				message: 'Stream completed normally',
				timestamp: new Date().toISOString(),
			};
			res.write(`data: ${JSON.stringify(endData)}\n\n`);

			// Small delay to ensure end message is sent
			setTimeout(() => {
				clearInterval(interval);
				res.end();
			}, 100);
			return;
		}
	}, 1000);

	// Handle client disconnect
	req.on('close', () => {
		clearInterval(interval);
	});
});

// Binary stream endpoint (for testing octet-stream)
app.get('/binary-stream', (req, res) => {
	res.setHeader('Content-Type', 'application/octet-stream');

	let count = 0;

	const interval = setInterval(() => {
		// Create a buffer with incremental data
		const buffer = Buffer.from(`Binary chunk ${count}\n`);
		res.write(buffer);
		count++;

		// Stop after 30 chunks
		if (count > 30) {
			clearInterval(interval);
			res.end();
		}
	}, 1000);

	req.on('close', () => {
		clearInterval(interval);
	});
});

// HTTP Methods testing endpoints
app.get('/methods/get', (req, res) => {
	res.json({
		method: 'GET',
		query: req.query,
		headers: req.headers,
		timestamp: new Date().toISOString(),
	});
});

app.post('/methods/post', (req, res) => {
	res.json({
		method: 'POST',
		body: req.body,
		headers: req.headers,
		timestamp: new Date().toISOString(),
	});
});

app.put('/methods/put', (req, res) => {
	res.json({
		method: 'PUT',
		body: req.body,
		headers: req.headers,
		timestamp: new Date().toISOString(),
	});
});

app.delete('/methods/delete', (req, res) => {
	res.json({
		method: 'DELETE',
		query: req.query,
		headers: req.headers,
		timestamp: new Date().toISOString(),
	});
});

// Status codes testing endpoints
app.get('/status/:code', (req, res) => {
	const code = parseInt(req.params.code) || 200;
	res.status(code).json({
		status: code,
		message: `Returned status code ${code}`,
		timestamp: new Date().toISOString(),
	});
});

// Headers testing endpoint
app.get('/headers', (req, res) => {
	// Echo back all received headers
	const customHeader = req.header('x-custom-header') || 'Not provided';

	// Set a custom header in response
	res.setHeader('X-Test-Header', 'test-value');
	res.setHeader('X-Custom-Echo', customHeader);

	res.json({
		receivedHeaders: req.headers,
		customHeader: customHeader,
		timestamp: new Date().toISOString(),
	});
});

// Binary file download testing
app.get('/download/image', (req, res) => {
	const filePath = path.join(__dirname, 'test-image.jpg');

	// If file doesn't exist, create a simple test image
	if (!fs.existsSync(filePath)) {
		// Create a very simple 100x100 black image
		const size = 100;
		const buffer = Buffer.alloc(size * size * 3); // RGB format
		fs.writeFileSync(filePath, buffer);
	}

	res.setHeader('Content-Disposition', 'attachment; filename="test-image.jpg"');
	res.setHeader('Content-Type', 'image/jpeg');
	fs.createReadStream(filePath).pipe(res);
});

// Large payload testing
app.get('/large-json', (req, res) => {
	const size = parseInt(req.query.size) || 100;
	const limit = Math.min(size, 10000); // Cap at 10,000 items for safety

	const largeArray = Array.from({ length: limit }, (_, i) => ({
		id: i,
		value: `Item ${i}`,
		data: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. ${i}`,
		timestamp: Date.now(),
	}));

	res.json({
		count: largeArray.length,
		items: largeArray,
	});
});

// Delayed response testing
app.get('/delay/:seconds', (req, res) => {
	const seconds = Math.min(parseInt(req.params.seconds) || 1, 10); // Cap at 10 seconds

	setTimeout(() => {
		res.json({
			delayed: true,
			seconds: seconds,
			message: `Response delayed by ${seconds} seconds`,
			timestamp: new Date().toISOString(),
		});
	}, seconds * 1000);
});

app.get('/redirect/:type', (req, res) => {
	const redirectType = parseInt(req.params.type) || 301;
	const validTypes = [301, 302, 307, 308];

	// Default to 302 if not a valid redirect type
	const type = validTypes.includes(redirectType) ? redirectType : 302;

	res.redirect(type, '/methods/get?redirected=true&from=' + type);
});

app.get('/content-types/xml', (req, res) => {
	res.setHeader('Content-Type', 'application/xml');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<response>
<status>success</status>
<message>This is an XML response</message>
<timestamp>${new Date().toISOString()}</timestamp>
</response>`;

	res.send(xml);
});

// HTML response endpoint
app.get('/content-types/html', (req, res) => {
	res.setHeader('Content-Type', 'text/html');
	const html = `<!DOCTYPE html>
<html>
<head>
	<title>HTML Response</title>
</head>
<body>
	<h1>HTML Response</h1>
	<p>This is an HTML response from the test server.</p>
	<p>Timestamp: ${new Date().toISOString()}</p>
</body>
</html>`;

	res.send(html);
});

// Text response with custom charset
app.get('/content-types/text-charset', (req, res) => {
	res.setHeader('Content-Type', 'text/plain; charset=ISO-8859-1');
	res.send(`This is a text response with custom charset.\nTimestamp: ${new Date().toISOString()}`);
});

// Non-standard status code endpoint
app.get('/status-unusual/:code', (req, res) => {
	const code = parseInt(req.params.code) || 200;
	// For testing unusual status codes like 429 (Rate limit), 418 (I'm a teapot), etc.
	res.status(code).json({
		status: code,
		message: `Returned non-standard status code ${code}`,
		timestamp: new Date().toISOString(),
	});
});

// Malformed content endpoint
app.get('/malformed/json', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.send('{not valid JSON');
});

app.get('/malformed/incomplete', (req, res) => {
	res.writeHead(200, { 'Content-Type': 'application/json' });
	res.write('{"start": "This response will be cut');
	res.end();
});

// WebSocket connection handling
wss.on('connection', (ws) => {
	console.log('Client connected to WebSocket');

	// Send welcome message
	ws.send(
		JSON.stringify({
			type: 'info',
			message: 'Connected to test WebSocket server',
			timestamp: new Date().toISOString(),
		})
	);

	// Send periodic messages
	const interval = setInterval(() => {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(
				JSON.stringify({
					type: 'update',
					message: 'Periodic update from server',
					timestamp: new Date().toISOString(),
				})
			);
		}
	}, 5000);

	// Handle messages from client
	ws.on('message', (message) => {
		console.log(`Received message: ${message}`);

		ws.send(
			JSON.stringify({
				type: 'echo',
				message: `Received: ${message.toString()}`,
				originalMessage: message.toString(),
				timestamp: new Date().toISOString(),
			})
		);
	});

	// Handle disconnection
	ws.on('close', () => {
		console.log('Client disconnected');
		clearInterval(interval);
	});
});

// Start server
server.listen(port, () => {
	console.log(`Test server running at http://localhost:${port}`);
	console.log(`- Stream endpoint: http://localhost:${port}/stream`);
	console.log(`- Binary stream endpoint: http://localhost:${port}/binary-stream`);
	console.log(`- WebSocket endpoint: ws://localhost:${port}`);
	console.log(`- HTTP Methods tests: http://localhost:${port}/methods/*`);
	console.log(`- Status codes test: http://localhost:${port}/status/:code`);
	console.log(`- Headers test: http://localhost:${port}/headers`);
	console.log(`- Download test: http://localhost:${port}/download/image`);
	console.log(`- Large JSON: http://localhost:${port}/large-json?size=1000`);
	console.log(`- Delayed response: http://localhost:${port}/delay/3`);
	console.log(`- Redirect test: http://localhost:${port}/redirect/301`);
	console.log(`- Content types test: http://localhost:${port}/content-types/*`);
	console.log(`- Non-standard status codes: http://localhost:${port}/status-unusual/418`);
	console.log(`- Malformed content: http://localhost:${port}/malformed/json`);
});
