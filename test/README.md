# CORS Proxy Test Suite

This folder contains a comprehensive test suite for validating the CORS proxy functionality. The test suite includes both a client and server component to test various aspects of the proxy.

## Test Components

### Test Server (`server.js`)

A Node.js Express server that provides various endpoints to test different aspects of the CORS proxy:

- **Streaming data** (`/stream`): Server-sent events streaming
- **Binary streaming** (`/binary-stream`): Octet-stream binary data
- **WebSockets**: Full-duplex communication
- **HTTP Methods**: GET, POST, PUT, DELETE endpoints
- **Status Codes**: Test different HTTP status codes
- **Custom Headers**: Echo and response with custom headers
- **File Download**: Binary file download test
- **Large Payloads**: Test large JSON response handling
- **Delayed Responses**: Test timeout handling

### Test Client (`client.html`)

A browser-based test client with UI controls to test each aspect of the proxy:

- Configure proxy and test server URLs
- Test all endpoints provided by the test server
- Visual feedback on success/failure
- Display response data and timings

## Setup and Usage

1. Install dependencies:

   ```
   npm install
   ```

2. Start the test server:

   ```
   node server.js
   ```

3. Start your Cloudflare CORS proxy worker (local or deployed)

4. Open `client.html` in your browser

5. Configure the URLs:

   - Set "Proxy URL" to your CORS proxy URL (e.g., `http://localhost:8787` for local testing)
   - Set "Test Server URL" to the test server URL (e.g., `http://localhost:3000`)

6. Run the different tests and verify the proxy handles each case correctly

## Test Cases

The test suite covers the following test cases:

1. **Basic CORS Functionality**: Verify that CORS headers are properly added
2. **Streaming Data**: Test SSE (Server-Sent Events) pass-through
3. **Binary Data Handling**: Test binary data transfer
4. **WebSocket Proxying**: Test WebSocket connection tunneling
5. **HTTP Method Support**: Verify all HTTP methods work through the proxy
6. **Status Code Handling**: Test how various HTTP status codes are passed through
7. **Custom Headers**: Verify custom headers are passed correctly
8. **Binary File Downloads**: Test downloading binary files through the proxy
9. **Large Payload Handling**: Test the proxy with large amounts of data
10. **Timeout Handling**: Test the proxy with delayed responses

## Expected Behavior

A properly functioning CORS proxy should:

1. Successfully proxy all requests without changing content
2. Add proper CORS headers to responses
3. Handle streaming data including SSE and binary streams
4. Support WebSocket connections
5. Handle all HTTP methods
6. Pass through status codes correctly
7. Handle custom headers correctly
8. Not modify binary file downloads
9. Support large payloads
10. Handle timeouts appropriately

## Troubleshooting

If tests fail, check:

1. Network connectivity between components
2. CORS proxy configuration
3. Browser console for JavaScript errors
4. Test server logs for backend errors
