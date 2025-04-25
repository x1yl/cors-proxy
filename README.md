<div align="center" id="top"> 
  <img src="./CORS.png" alt="Proxy" width="200px" />

<a href="https://proxy.cors-proxy-ff5.workers.dev">Demo</a>

</div>

<h1 align="center">CORS Proxy on Cloudflare Worker</h1>

<p align="center">
  <img alt="Github top language" src="https://img.shields.io/github/languages/top/x1yl/cors-proxy?color=56BEB8">

  <img alt="Github language count" src="https://img.shields.io/github/languages/count/x1yl/cors-proxy?color=56BEB8">

  <img alt="Repository size" src="https://img.shields.io/github/repo-size/x1yl/cors-proxy?color=56BEB8">

  <img alt="License" src="https://img.shields.io/github/license/x1yl/cors-proxy?color=56BEB8">

  <img alt="Github issues" src="https://img.shields.io/github/issues/x1yl/cors-proxy?color=56BEB8" />

   <img alt="Github forks" src="https://img.shields.io/github/forks/x1yl/cors-proxy?color=56BEB8" />

  <img alt="Github stars" src="https://img.shields.io/github/stars/x1yl/cors-proxy?color=56BEB8" /> 
</p>

<p align="center">
  <a href="#dart-about">About</a> &#xa0; | &#xa0; 
  <a href="#globe_with_meridians-demo">Demo</a> &#xa0; | &#xa0; 
  <a href="#sparkles-features">Features</a> &#xa0; | &#xa0;
  <a href="#rocket-technologies">Technologies</a> &#xa0; | &#xa0;
  <a href="#white_check_mark-requirements">Requirements</a> &#xa0; | &#xa0;
  <a href="#checkered_flag-starting">Starting</a> &#xa0; | &#xa0;
  <a href="#memo-license">License</a> &#xa0; | &#xa0;
  <a href="https://github.com/x1yl" target="_blank">Author</a>
</p>

<br>

## :dart: About

A powerful CORS (Cross-Origin Resource Sharing) proxy implemented as a Cloudflare Worker. This service solves browser CORS restrictions by proxying requests through a Cloudflare Worker and adding necessary headers to enable cross-origin access. It supports both standard HTTP requests and WebSocket connections, making it versatile for all types of web applications.

## :globe_with_meridians: Demo

A demo instance is available at [proxy.cors-proxy-ff5.workers.dev](https://proxy.cors-proxy-ff5.workers.dev).

:warning: **Important Usage Guidelines:**

- This demo is provided for testing and evaluation purposes only
- Please deploy your own instance for production use
- Excessive usage of the demo instance may result in rate limiting
- No data persistence or privacy guarantees on the demo instance

## :sparkles: Features

:heavy_check_mark: **Automatic CORS headers** for any request  
:heavy_check_mark: **WebSocket proxying** with bidirectional communication  
:heavy_check_mark: **Server-Sent Events (SSE)** support for real-time data  
:heavy_check_mark: **Support for all HTTP methods** (GET, POST, PUT, DELETE, etc.)  
:heavy_check_mark: **Streaming response handling** for large data transfers  
:heavy_check_mark: **Binary data support** for file transfers  
:heavy_check_mark: **Custom header forwarding** and management  
:heavy_check_mark: **Origin whitelisting** capability for security  
:heavy_check_mark: **URL pattern blacklisting** to restrict access  
:heavy_check_mark: **Global deployment** on Cloudflare's network

## :rocket: Technologies

The following tools were used in this project:

- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless execution environment
- [Node.js](https://nodejs.org/en/) - JavaScript runtime for development
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - CLI tool for Cloudflare Workers
- [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) - For handling HTTP requests
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) - For WebSocket functionality

## :white_check_mark: Requirements

Before starting :checkered_flag:, you need to have:

- [Node.js](https://nodejs.org/en/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed globally

## :checkered_flag: Starting

```bash
# Clone this project
$ git clone https://github.com/x1yl/cors-proxy

# Access
$ cd cors-proxy

# Install dependencies
$ pnpm install

# Configure your Cloudflare account with Wrangler
$ pnpm wrangler login

# Test the project locally
$ pnpm dev

# Deploy to Cloudflare
$ pnpm deploy
```

## :computer: Usage Examples

### HTTP Request Example

```javascript
// Basic fetch request through the proxy
fetch('https://your-proxy.workers.dev/?https://api.example.com/data')
	.then((response) => response.json())
	.then((data) => console.log(data))
	.catch((error) => console.error('Error:', error));

// POST request with custom headers
fetch('https://your-proxy.workers.dev/?https://api.example.com/submit', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'x-cors-headers': JSON.stringify({
			// Custom headers that would normally be restricted
			Authorization: 'Bearer token123',
		}),
	},
	body: JSON.stringify({ key: 'value' }),
})
	.then((response) => {
		// Access all response headers including normally restricted ones
		const headers = JSON.parse(response.headers.get('cors-received-headers'));
		console.log(headers);
		return response.json();
	})
	.then((data) => console.log(data));
```

### WebSocket Example

```javascript
// Connect to a WebSocket through the proxy
const socket = new WebSocket('ws://your-proxy.workers.dev/?wss://echo.websocket.org');

socket.onopen = () => {
	console.log('Connected to WebSocket through proxy');
	socket.send('Hello Server!');
};

socket.onmessage = (event) => {
	console.log('Received:', event.data);
};

socket.onclose = () => {
	console.log('WebSocket connection closed');
};
```

### Server-Sent Events Example

```javascript
// Connect to SSE endpoint through the proxy
const evtSource = new EventSource('https://your-proxy.workers.dev/?https://api.example.com/events');

evtSource.onmessage = (event) => {
	const data = JSON.parse(event.data);
	console.log('New event:', data);
};

evtSource.onerror = (error) => {
	console.error('EventSource error:', error);
	evtSource.close();
};
```

## :test_tube: Testing

The project includes a comprehensive test client to verify your proxy's functionality:

```bash
# Run the test client
$ pnpm test:client
```

The test client supports:

- Testing all HTTP methods
- WebSocket connections
- Server-Sent Events
- File uploads and downloads
- Authentication methods
- Error handling

## :hammer_and_wrench: Contributing and Development

We welcome contributions! To get started contributing to this project:

1. **Fork and clone the repository**
2. **Switch to the staging branch**: `git checkout staging`
3. **Make your changes**
4. **Test thoroughly** using the included test client
5. **Submit a PR** targeting the staging branch

For detailed instructions on how to contribute, please see [CONTRIBUTING.md](CONTRIBUTING.md).

> ⚠️ **Important**: All pull requests should target the `staging` branch, not `main`!

### Test Client

The project includes a comprehensive HTML-based test client for interactively testing your proxy implementation. The test client supports:

- Full testing of https://httpbingo.com endpoints
- Individual endpoint testing with custom parameters
- Support for all HTTP methods (GET, POST, PUT, DELETE, etc.)
- Testing of streaming responses and Server-Sent Events (SSE)
- WebSocket connection testing with echo capability
- Test report generation and download

```bash
# Start the test client by opening in your browser:
$ pnpm test:client
# Or simply open test/client.html in your browser
```

## :memo: License

This project is under license from MIT. For more details, see the [LICENSE](LICENSE.md) file.

Made with :heart: by <a href="https://github.com/x1yl" target="_blank">Kevin Zheng</a>

<a href="https://www.buymeacoffee.com/xtyl"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="200" /></a>

&#xa0;

<a href="#top">Back to top</a>
