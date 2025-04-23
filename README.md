<div align="center" id="top"> 
  <img src="./.github/app.gif" alt="Proxy" />

  &#xa0;

  <!-- <a href="https://proxy.netlify.app">Demo</a> -->
</div>

<h1 align="center">Cors Proxy on Cloudflare Worker</h1>

<p align="center">
  <img alt="Github top language" src="https://img.shields.io/github/languages/top/x1yl/cors-proxy?color=56BEB8">

  <img alt="Github language count" src="https://img.shields.io/github/languages/count/x1yl/cors-proxy?color=56BEB8">

  <img alt="Repository size" src="https://img.shields.io/github/repo-size/x1yl/cors-proxy?color=56BEB8">

  <img alt="License" src="https://img.shields.io/github/license/x1yl/cors-proxy?color=56BEB8">

  <img alt="Github issues" src="https://img.shields.io/github/issues/x1yl/cors-proxy?color=56BEB8" />

   <img alt="Github forks" src="https://img.shields.io/github/forks/x1yl/cors-proxy?color=56BEB8" /> 

  <img alt="Github stars" src="https://img.shields.io/github/stars/x1yl/cors-proxy?color=56BEB8" /> 
</p>

<!-- Status -->

<!-- <h4 align="center"> 
	🚧  Proxy 🚀 Under construction...  🚧
</h4> 

<hr> -->

<p align="center">
  <a href="#dart-about">About</a> &#xa0; | &#xa0; 
  <a href="#sparkles-features">Features</a> &#xa0; | &#xa0;
  <a href="#rocket-technologies">Technologies</a> &#xa0; | &#xa0;
  <a href="#white_check_mark-requirements">Requirements</a> &#xa0; | &#xa0;
  <a href="#checkered_flag-starting">Starting</a> &#xa0; | &#xa0;
  <a href="#memo-license">License</a> &#xa0; | &#xa0;
  <a href="https://github.com/x1yl" target="_blank">Author</a>
</p>

<br>

## :dart: About

A simple yet powerful CORS (Cross-Origin Resource Sharing) proxy implemented as a Cloudflare Worker. This service allows web applications to make requests to resources from different origins that would otherwise be blocked by browser security policies. It functions by proxying requests through a Cloudflare Worker, adding the necessary CORS headers to enable cross-origin access.

## :sparkles: Features

:heavy_check_mark: Automatic CORS headers for any request;\
:heavy_check_mark: Support for preflight (OPTIONS) requests;\
:heavy_check_mark: Custom header forwarding;\
:heavy_check_mark: Origin whitelisting capability;\
:heavy_check_mark: Request URL patterns blacklisting;\
:heavy_check_mark: Easy deployment on Cloudflare's global network;

## :rocket: Technologies

The following tools were used in this project:

- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless execution environment
- [Node.js](https://nodejs.org/en/) - JavaScript runtime for development
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - CLI tool for Cloudflare Workers
- [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) - For handling HTTP requests

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

## :computer: Usage Example

```javascript
fetch('https://yourworkerlink.dev/?https://httpbin.org/post', {
  method: 'post',
  headers: {
    'x-foo': 'bar',
    'x-bar': 'foo',
    'x-cors-headers': JSON.stringify({
      // allows to send forbidden headers
      // https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name
      'cookies': 'x=123'
    }) 
  }
}).then(res => {
  // allows to read all headers (even forbidden headers like set-cookies)
  const headers = JSON.parse(res.headers.get('cors-received-headers'))
  console.log(headers)
  return res.json()
}).then(console.log)
```

**Note:**

All received headers are also returned in "cors-received-headers" header. This allows you to access headers that would normally be inaccessible due to browser restrictions.

## :hammer_and_wrench: Contributing and Development

We welcome contributions! Here's how to set up your development environment and test your changes:

### Development Setup

1. Fork and clone the repository
2. Install dependencies with `pnpm install`
3. Make your changes to the worker code

### Testing Your Changes

This project includes testing utilities to help you verify your changes:

#### Test Server

The test server simulates various API endpoints and WebSocket connections for testing the CORS proxy functionality:

```bash
# Start the test server
$ pnpm test:client


# The server will run on http://localhost:3000 with the following capabilities:
# - Standard HTTP endpoint at the root (/)
# - Server-Sent Events (SSE) streaming at /stream
# - Binary streaming at /binary-stream
# - WebSocket server for bidirectional communication
```


#### Test Client

The project includes an HTML-based test client for interactively testing your proxy implementation:

```bash
# Start the test client by opening in your browser:
$ pnpm test:client
# Or simply double-click the file to open it in your default browser
```

**Note:**

If you are on Linux you will have to edit test:client in package.json to ```open ./test/client.html```

The test client provides a user interface for:
- Testing EventSource/SSE streaming through the proxy
- Testing binary stream handling
- Testing WebSocket proxying with interactive message sending
- Configurable proxy URL and test server URL for flexible testing

### Testing Workflow

1. Run the test server: `pnpm test:server`
2. Run your local proxy: `pnpm dev`
3. Open client.html in your browser
4. Configure the client with your proxy URL (default: http://localhost:8787) and test server URL (default: http://localhost:3000)
5. Use the interface to test everything is working

### Submitting Changes

1. Create a new branch for your feature or bugfix
2. Make your changes with appropriate tests
3. Verify all functionality works with the test client
4. Submit a pull request with a clear description of the changes and their benefits

When submitting your PR, please ensure you've tested thoroughly using the provided test client and server.

## :memo: License

This project is under license from MIT. For more details, see the [LICENSE](LICENSE.md) file.


Made with :heart: by <a href="https://github.com/x1yl" target="_blank">Kevin Zheng</a>
<a href="https://www.buymeacoffee.com/xtyl"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="200" /></a>

&#xa0;

<a href="#top">Back to top</a>
