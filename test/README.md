# CORS Proxy Test Suite

This folder contains a comprehensive test suite for validating the CORS proxy functionality. The test suite includes a browser-based client for testing the proxy against standard HTTP endpoints and WebSocket connections.

## Test Client Features

The browser-based test client includes:

### Automated Tests

- **Basic Endpoints**: GET, POST, PUT, DELETE, PATCH, HEAD requests
- **Status Codes**: Tests various HTTP status codes (200, 201, 204, 400, 401, 403, 404, 500)
- **Response Headers**: Validates header handling and passthrough
- **Special Formats**: JSON, HTML, XML, and other content types
- **Encoding & Compression**: GZIP, Deflate, Base64 encoding/decoding
- **Authentication**: Basic Auth, Bearer token handling
- **Streaming**: Chunked transfers, byte streams, range requests
- **Redirects & Cookies**: Redirect handling and cookie management
- **Images**: Testing image proxying (JPEG, PNG, SVG, WEBP)
- **WebSockets**: Echo testing with multiple messages
- **Server-Sent Events**: Real-time data streaming

### Individual Endpoint Testing

- Custom endpoint path input
- HTTP method selection (GET, POST, PUT, etc.)
- Request body configuration
- Custom headers configuration
- Quick test buttons for common endpoints

### WebSocket Testing

- Direct WebSocket testing interface
- Connection management
- Manual message sending
- Automated echo test (sends 5 messages and verifies responses)

## Setup and Usage

1. Start your CORS proxy worker (local or deployed):

   ```
   pnpm dev
   ```

2. Open `client.html` in your browser:

   ```
   pnpm test:client
   ```

3. Configure the proxy URL in the test client:

   - Default is `http://localhost:8787` for local testing
   - Change to your deployed proxy URL for production testing

4. Run tests:

   - Use the "Run All Tests" button for comprehensive testing
   - Select individual test categories as needed
   - Use the WebSocket tab to test WebSocket functionality

5. Review results:
   - Success/failure indicators for each test
   - Detailed error messages for failed tests
   - Download test reports for documentation

## Testing WebSockets

The test client includes a dedicated WebSocket testing tab:

1. Enter the target WebSocket URL (default: `wss://echo.websocket.org/`)
2. Click "Connect" to establish a connection through your proxy
3. Send individual messages or run the echo test
4. Verify that messages are properly echoed back

The automated WebSocket test sends 5 messages and verifies each is correctly echoed back, ensuring bidirectional communication works through your proxy.

## Expected Behavior

A fully functional CORS proxy should:

1. Add proper CORS headers to all responses
2. Forward all HTTP methods correctly
3. Preserve request and response headers
4. Handle binary data without corruption
5. Support streaming connections (SSE)
6. Properly tunnel WebSocket connections
7. Maintain content types and encodings
8. Pass through status codes correctly
9. Handle large payloads and timeouts appropriately

## Troubleshooting

If tests fail, check:

1. Network connectivity between components
2. Browser console for JavaScript errors
3. Proxy worker logs for backend errors
4. Ensure the proxy URL is correctly configured
5. Verify that target endpoints are accessible
