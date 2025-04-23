document.addEventListener('DOMContentLoaded', () => {
	// Element references
	const proxyUrlInput = document.getElementById('proxyUrl');
	const testServerUrlInput = document.getElementById('testServerUrl');

	// Stream elements
	const startStreamBtn = document.getElementById('startStreamBtn');
	const stopStreamBtn = document.getElementById('stopStreamBtn');
	const streamStatus = document.getElementById('streamStatus');
	const streamOutput = document.getElementById('streamOutput');

	// Binary stream elements
	const startBinaryBtn = document.getElementById('startBinaryBtn');
	const stopBinaryBtn = document.getElementById('stopBinaryBtn');
	const binaryStatus = document.getElementById('binaryStatus');
	const binaryOutput = document.getElementById('binaryOutput');

	// WebSocket elements
	const connectWsBtn = document.getElementById('connectWsBtn');
	const disconnectWsBtn = document.getElementById('disconnectWsBtn');
	const wsStatus = document.getElementById('wsStatus');
	const wsMessage = document.getElementById('wsMessage');
	const wsSendBtn = document.getElementById('wsSendBtn');
	const wsOutput = document.getElementById('wsOutput');

	// Stream controller
	let streamController = null;

	// WebSocket reference
	let ws = null;

	// Helper functions
	function getFullUrl(path) {
		const proxyUrl = proxyUrlInput.value.trim();
		const testServerUrl = testServerUrlInput.value.trim();
		return `${proxyUrl}/?${testServerUrl}${path}`;
	}

	function updateStatus(element, message, isError = false) {
		element.textContent = `Status: ${message}`;
		element.className = isError ? 'error' : 'success';
	}

	// Tab Functionality
	document.querySelectorAll('.tab').forEach((tab) => {
		tab.addEventListener('click', () => {
			// Deactivate all tabs and contents
			document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
			document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

			// Activate selected tab
			tab.classList.add('active');
			document.getElementById(tab.dataset.tab).classList.add('active');
		});
	});

	// Stream test
	startStreamBtn.addEventListener('click', () => {
		const proxyUrl = proxyUrlInput.value.trim();
		const testServerUrl = testServerUrlInput.value.trim();

		if (!proxyUrl || !testServerUrl) {
			alert('Please enter both Proxy URL and Test Server URL');
			return;
		}

		// Clear previous output
		streamOutput.textContent = '';
		streamStatus.textContent = 'Status: Connecting...';

		const fullUrl = `${proxyUrl}/?${testServerUrl}/stream`;

		// Disable/enable buttons appropriately
		startStreamBtn.disabled = true;
		stopStreamBtn.disabled = false;

		// Create new EventSource
		const eventSource = new EventSource(fullUrl);

		// Store the EventSource so we can close it later
		streamController = eventSource;

		// Handle connection open
		eventSource.onopen = () => {
			streamStatus.textContent = 'Status: Connected (EventSource)';
			streamStatus.className = 'success';
		};

		// Handle incoming messages
		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				// Check for stream end message
				if (data.type === 'end') {
					streamOutput.textContent += `Stream ended: ${data.message}\n`;
					streamStatus.textContent = 'Status: Stream completed normally';

					// Clean up EventSource
					eventSource.close();
					streamController = null;
					startStreamBtn.disabled = false;
					stopStreamBtn.disabled = true;
					return;
				}

				streamOutput.textContent += `Message #${data.count}: ${data.message} (${data.timestamp})\n`;
				streamOutput.scrollTop = streamOutput.scrollHeight;
			} catch (error) {
				streamOutput.textContent += `Error parsing: ${event.data}\n`;
				console.error('Parse error:', error);
			}
		};

		// Handle errors
		eventSource.onerror = (error) => {
			console.error('EventSource error:', error);
			streamStatus.textContent = 'Status: Error with EventSource connection';
			streamStatus.className = 'error';

			// Auto-close on error
			eventSource.close();
			startStreamBtn.disabled = false;
			stopStreamBtn.disabled = true;
		};
	});

	// Update the stop button handler to close the EventSource
	stopStreamBtn.addEventListener('click', () => {
		if (streamController && streamController instanceof EventSource) {
			streamController.close();
			streamStatus.textContent = 'Status: Stream stopped by user';
			startStreamBtn.disabled = false;
			stopStreamBtn.disabled = true;
			streamController = null;
		} else if (streamController) {
			// Handle the existing abort controller case
			streamController.abort();
			streamController = null;
		}
	});

	// Binary stream test
	startBinaryBtn.addEventListener('click', async () => {
		const proxyUrl = proxyUrlInput.value.trim();
		const testServerUrl = testServerUrlInput.value.trim();

		if (!proxyUrl || !testServerUrl) {
			alert('Please enter both Proxy URL and Test Server URL');
			return;
		}

		try {
			binaryOutput.textContent = '';
			binaryStatus.textContent = 'Status: Connecting...';

			const fullUrl = `${proxyUrl}/?${testServerUrl}/binary-stream`;
			streamController = new AbortController();

			startBinaryBtn.disabled = true;
			stopBinaryBtn.disabled = false;

			const response = await fetch(fullUrl, {
				signal: streamController.signal,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			binaryStatus.textContent = 'Status: Connected';
			binaryStatus.className = 'success';

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			let counter = 0;
			while (true) {
				const { value, done } = await reader.read();

				if (done) {
					binaryStatus.textContent = 'Status: Stream ended';
					break;
				}

				const text = decoder.decode(value);
				binaryOutput.textContent += `Chunk ${counter++}: ${text}`;
				binaryOutput.scrollTop = binaryOutput.scrollHeight;
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				binaryStatus.textContent = 'Status: Stream stopped by user';
			} else {
				binaryStatus.textContent = `Status: Error - ${error.message}`;
				binaryStatus.className = 'error';
				console.error('Binary stream error:', error);
			}
		} finally {
			startBinaryBtn.disabled = false;
			stopBinaryBtn.disabled = true;
		}
	});

	stopBinaryBtn.addEventListener('click', () => {
		if (streamController) {
			streamController.abort();
			streamController = null;
		}
	});

	// WebSocket test
	connectWsBtn.addEventListener('click', () => {
		const proxyUrl = proxyUrlInput.value.trim();
		const testServerUrl = testServerUrlInput.value.trim();

		if (!proxyUrl || !testServerUrl) {
			alert('Please enter both Proxy URL and Test Server URL');
			return;
		}

		try {
			wsOutput.textContent = '';
			wsStatus.textContent = 'Status: Connecting...';

			// Convert http/https to ws/wss for the test server
			const wsTestUrl = testServerUrl.replace(/^http/, 'ws');
			// Convert http/https to ws/wss for the proxy
			const wsProxyUrl = proxyUrl.replace(/^http/, 'ws');

			const fullUrl = `${wsProxyUrl}/?${wsTestUrl}`;

			ws = new WebSocket(fullUrl);

			ws.onopen = () => {
				wsStatus.textContent = 'Status: Connected';
				wsStatus.className = 'success';
				connectWsBtn.disabled = true;
				disconnectWsBtn.disabled = false;
				wsSendBtn.disabled = false;
				wsOutput.textContent += 'Connected to WebSocket\n';
			};

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					wsOutput.textContent += `[${data.type}] ${data.message}\n`;
					if (data.originalMessage) {
						wsOutput.textContent += `  Echo: ${data.originalMessage}\n`;
					}
				} catch (e) {
					wsOutput.textContent += `Raw: ${event.data}\n`;
				}
				wsOutput.scrollTop = wsOutput.scrollHeight;
			};

			ws.onclose = () => {
				wsStatus.textContent = 'Status: Disconnected';
				connectWsBtn.disabled = false;
				disconnectWsBtn.disabled = true;
				wsSendBtn.disabled = true;
				wsOutput.textContent += 'Disconnected from WebSocket\n';
				ws = null;
			};

			ws.onerror = (error) => {
				wsStatus.textContent = 'Status: Error';
				wsStatus.className = 'error';
				wsOutput.textContent += `WebSocket Error: ${error}\n`;
				console.error('WebSocket error:', error);
			};
		} catch (error) {
			wsStatus.textContent = `Status: Error - ${error.message}`;
			wsStatus.className = 'error';
			wsOutput.textContent += `Error: ${error.message}\n`;
			console.error('WebSocket connection error:', error);
		}
	});

	disconnectWsBtn.addEventListener('click', () => {
		if (ws) {
			ws.close();
		}
	});

	wsSendBtn.addEventListener('click', () => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			const message = wsMessage.value;
			if (message) {
				ws.send(message);
				wsOutput.textContent += `[Sent] ${message}\n`;
				wsOutput.scrollTop = wsOutput.scrollHeight;
				wsMessage.value = '';
			}
		}
	});

	wsMessage.addEventListener('keypress', (e) => {
		if (e.key === 'Enter' && !wsSendBtn.disabled) {
			wsSendBtn.click();
		}
	});

  // HTTP Methods Tests
  document.getElementById('sendGetBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('httpMethodOutput');
    const statusElement = document.getElementById('httpMethodStatus');

    try {
      updateStatus(statusElement, 'Sending request...');
      outputElement.textContent = '';

      let queryParams = {};
      try {
        queryParams = JSON.parse(document.getElementById('getParams').value);
      } catch (e) {
        console.error('Invalid JSON:', e);
      }

      const queryString = new URLSearchParams(queryParams).toString();
      const url = getFullUrl(`/methods/get${queryString ? '?' + queryString : ''}`);

      const response = await fetch(url);
      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: ${response.status} ${response.statusText}`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('GET request error:', error);
    }
  });

  document.getElementById('sendPostBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('httpMethodOutput');
    const statusElement = document.getElementById('httpMethodStatus');

    try {
      updateStatus(statusElement, 'Sending request...');
      outputElement.textContent = '';

      let body = {};
      try {
        body = JSON.parse(document.getElementById('postBody').value);
      } catch (e) {
        console.error('Invalid JSON:', e);
      }

      const url = getFullUrl('/methods/post');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: ${response.status} ${response.statusText}`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('POST request error:', error);
    }
  });

  document.getElementById('sendPutBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('httpMethodOutput');
    const statusElement = document.getElementById('httpMethodStatus');

    try {
      updateStatus(statusElement, 'Sending request...');
      outputElement.textContent = '';

      let body = {};
      try {
        body = JSON.parse(document.getElementById('putBody').value);
      } catch (e) {
        console.error('Invalid JSON:', e);
      }

      const url = getFullUrl('/methods/put');

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: ${response.status} ${response.statusText}`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('PUT request error:', error);
    }
  });

  document.getElementById('sendDeleteBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('httpMethodOutput');
    const statusElement = document.getElementById('httpMethodStatus');

    try {
      updateStatus(statusElement, 'Sending request...');
      outputElement.textContent = '';

      const id = document.getElementById('deleteId').value;
      const url = getFullUrl(`/methods/delete?id=${id}`);

      const response = await fetch(url, {
        method: 'DELETE',
      });
      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: ${response.status} ${response.statusText}`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('DELETE request error:', error);
    }
  });

  // Status Code Tests
  document.getElementById('testStatusBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('statusTestOutput');
    const statusElement = document.getElementById('statusTestStatus');

    try {
      const code = document.getElementById('statusCode').value;
      updateStatus(statusElement, `Requesting status code ${code}...`);
      outputElement.textContent = '';

      const url = getFullUrl(`/status/${code}`);

      const response = await fetch(url);

      updateStatus(statusElement, `Received ${response.status} ${response.statusText}`);

      try {
        const data = await response.json();
        outputElement.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        outputElement.textContent = `Response was not JSON. Status: ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Status code test error:', error);
    }
  });

  // Headers Test
  document.getElementById('testHeadersBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('headersTestOutput');
    const statusElement = document.getElementById('headersTestStatus');

    try {
      updateStatus(statusElement, 'Testing custom headers...');
      outputElement.textContent = '';

      let customHeaders = {};
      try {
        customHeaders = JSON.parse(document.getElementById('customHeaders').value);
      } catch (e) {
        console.error('Invalid JSON for headers:', e);
      }

      const url = getFullUrl('/headers');

      const response = await fetch(url, {
        headers: customHeaders,
      });

      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: Headers test completed`);
      outputElement.textContent = JSON.stringify(data, null, 2);

      // Display any custom headers that came back in the response
      const receivedHeaders = {};
      response.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('x-')) {
          receivedHeaders[key] = value;
        }
      });

      if (Object.keys(receivedHeaders).length > 0) {
        outputElement.textContent += '\n\nResponse Headers:\n' + JSON.stringify(receivedHeaders, null, 2);
      }
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Headers test error:', error);
    }
  });

  // Image Download Test
  document.getElementById('testImageDownloadBtn').addEventListener('click', async () => {
    const statusElement = document.getElementById('downloadStatus');
    const previewElement = document.getElementById('imagePreview');

    try {
      updateStatus(statusElement, 'Downloading image...');
      previewElement.innerHTML = '';

      const url = getFullUrl('/download/image');

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Create image element
      const img = document.createElement('img');
      img.src = objectUrl;
      img.style.maxWidth = '200px';
      img.style.maxHeight = '200px';
      img.style.border = '1px solid #ccc';

      previewElement.appendChild(img);

      updateStatus(statusElement, `Downloaded ${blob.size} bytes successfully`);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Image download error:', error);
    }
  });

  // Large Payload Test
  document.getElementById('testLargePayloadBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('largePayloadOutput');
    const statusElement = document.getElementById('largePayloadStatus');

    try {
      const size = document.getElementById('dataSize').value;
      updateStatus(statusElement, `Requesting ${size} items...`);
      outputElement.textContent = '';

      const startTime = performance.now();
      const url = getFullUrl(`/large-json?size=${size}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      updateStatus(statusElement, `Received ${data.count} items in ${duration} seconds`);
      outputElement.textContent = `Total items: ${data.count}\nFirst item: ${JSON.stringify(data.items[0], null, 2)}\n\n...and ${
        data.count - 1
      } more items`;
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Large payload test error:', error);
    }
  });

  // Delay Test
  document.getElementById('testDelayBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('delayTestOutput');
    const statusElement = document.getElementById('delayTestStatus');

    try {
      const seconds = document.getElementById('delaySeconds').value;
      updateStatus(statusElement, `Waiting for ${seconds} second response...`);
      outputElement.textContent = '';

      const startTime = performance.now();
      const url = getFullUrl(`/delay/${seconds}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const endTime = performance.now();
      const actualDuration = ((endTime - startTime) / 1000).toFixed(2);

      updateStatus(statusElement, `Response received after ${actualDuration} seconds (requested: ${seconds} seconds)`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Delay test error:', error);
    }
  });

  // Authentication Test
  document.getElementById('testAuthBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('authTestOutput');
    const statusElement = document.getElementById('authTestStatus');

    try {
      const token = document.getElementById('authToken').value;
      updateStatus(statusElement, 'Testing authentication...');
      outputElement.textContent = '';

      const url = getFullUrl('/headers');

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: Authentication test completed`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Authentication test error:', error);
    }
  });

  // URL Encoding Test
  document.getElementById('testUrlEncodingBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('urlEncodingOutput');
    const statusElement = document.getElementById('urlEncodingStatus');
    const urlType = document.getElementById('urlType').value;

    try {
      updateStatus(statusElement, 'Testing URL encoding...');
      outputElement.textContent = '';

      let queryParams = {};
      let path = '/methods/get';

      switch (urlType) {
        case 'spaces':
          queryParams = { 'param with spaces': 'value with spaces' };
          break;
        case 'unicode':
          queryParams = { paramünicode: 'valueöäü☺' };
          break;
        case 'fragments':
          // Fragments get stripped by the browser before sending
          queryParams = { normal: 'value' };
          path = '/methods/get#section1';
          break;
        case 'nested':
          queryParams = {
            nested: JSON.stringify({
              level1: {
                level2: 'nestedValue',
                array: [1, 2, 3],
              },
            }),
          };
          break;
      }

      const queryString = new URLSearchParams(queryParams).toString();
      const url = getFullUrl(`${path}${queryString ? '?' + queryString : ''}`);

      const response = await fetch(url);
      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: URL encoding test completed for ${urlType}`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('URL encoding test error:', error);
    }
  });

  // x-cors-headers Test
  document.getElementById('testXCorsHeadersBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('xCorsHeadersOutput');
    const statusElement = document.getElementById('xCorsHeadersStatus');

    try {
      updateStatus(statusElement, 'Testing x-cors-headers functionality...');
      outputElement.textContent = '';

      const url = getFullUrl('/headers');

      // Define headers we want to send through the x-cors-headers mechanism
      const specialHeaders = {
        'X-Special-Header-1': 'special-value-1',
        'X-Special-Header-2': 'special-value-2',
        'Content-MD5': 'Q2h1Y2sgTm9ycmlz', // Example of a header that might be stripped normally
      };

      const response = await fetch(url, {
        headers: {
          'x-cors-headers': JSON.stringify(specialHeaders),
        },
      });

      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: x-cors-headers test completed`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('x-cors-headers test error:', error);
    }
  });

  // Redirect Handling Test
  document.getElementById('testRedirectBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('redirectOutput');
    const statusElement = document.getElementById('redirectStatus');

    try {
      const redirectType = document.getElementById('redirectType').value;
      updateStatus(statusElement, `Testing ${redirectType} redirect...`);
      outputElement.textContent = '';

      const url = getFullUrl(`/redirect/${redirectType}`);

      const response = await fetch(url, {
        // Need to use manual redirect to test properly
        redirect: 'follow',
      });

      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: Redirect test completed (${redirectType})`);
      outputElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Redirect test error:', error);
    }
  });

  // Content-Type Test
  document.getElementById('testContentTypeBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('contentTypeOutput');
    const statusElement = document.getElementById('contentTypeStatus');

    try {
      const contentType = document.getElementById('contentType').value;
      updateStatus(statusElement, `Testing ${contentType} content type...`);
      outputElement.textContent = '';

      const url = getFullUrl(`/content-types/${contentType}`);

      const response = await fetch(url);

      // Check for the content-type of the response
      const responseContentType = response.headers.get('content-type');

      // Get the raw text
      const text = await response.text();

      updateStatus(statusElement, `SUCCESS: Content-type: ${responseContentType}`);
      outputElement.textContent = text;
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Content type test error:', error);
    }
  });

  // Very Long URL Test
  document.getElementById('testLongUrlBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('longUrlOutput');
    const statusElement = document.getElementById('longUrlStatus');

    try {
      const length = parseInt(document.getElementById('urlLength').value);
      updateStatus(statusElement, `Testing URL with ${length} characters...`);
      outputElement.textContent = '';

      // Generate very long query parameter
      const longString = 'a'.repeat(length);

      const url = getFullUrl(`/methods/get?longparam=${longString}`);

      const response = await fetch(url);
      const data = await response.json();

      updateStatus(statusElement, `SUCCESS: Long URL test completed (${length} characters)`);
      outputElement.textContent = `Query length: ${length}\nActual received length: ${
        data.query.longparam ? data.query.longparam.length : 0
      }\n\nFull response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`;
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Long URL test error:', error);
    }
  });

  // Non-Standard Status Code Test
  document.getElementById('testUnusualStatusBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('unusualStatusTestOutput');
    const statusElement = document.getElementById('unusualStatusTestStatus');

    try {
      const code = document.getElementById('unusualStatusCode').value;
      updateStatus(statusElement, `Testing unusual status code ${code}...`);
      outputElement.textContent = '';

      const url = getFullUrl(`/status-unusual/${code}`);

      try {
        const response = await fetch(url);

        updateStatus(statusElement, `Received ${response.status} ${response.statusText}`);

        try {
          const data = await response.json();
          outputElement.textContent = JSON.stringify(data, null, 2);
        } catch (e) {
          outputElement.textContent = `Response was not JSON. Status: ${response.status} ${response.statusText}`;
        }
      } catch (fetchError) {
        // For really unusual status codes, we might get network errors
        updateStatus(statusElement, `Fetch error: ${fetchError.message}`, true);
        outputElement.textContent = `Error: ${fetchError.message}\n\nNote: Some status codes may not be properly handled by the browser.`;
      }
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Unusual status code test error:', error);
    }
  });

  // Concurrent Requests Test
  document.getElementById('testConcurrentBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('concurrentOutput');
    const statusElement = document.getElementById('concurrentStatus');

    try {
      const count = parseInt(document.getElementById('concurrentCount').value);
      updateStatus(statusElement, `Sending ${count} concurrent requests...`);
      outputElement.textContent = '';

      const startTime = performance.now();

      // Create array of promises
      const promises = [];
      for (let i = 0; i < count; i++) {
        const url = getFullUrl(`/methods/get?concurrent=true&id=${i}`);
        promises.push(fetch(url).then((res) => res.json()));
      }

      // Wait for all requests to complete
      const results = await Promise.all(promises);

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      // Summarize results
      updateStatus(statusElement, `SUCCESS: ${count} requests completed in ${duration} seconds`);
      outputElement.textContent =
        `Total requests: ${count}\nTime: ${duration} seconds\n\n` +
        `First response ID: ${results[0].query.id}\nLast response ID: ${results[results.length - 1].query.id}`;
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Concurrent requests test error:', error);
    }
  });

  // Malformed Content Test
  document.getElementById('testMalformedBtn').addEventListener('click', async () => {
    const outputElement = document.getElementById('malformedOutput');
    const statusElement = document.getElementById('malformedStatus');

    try {
      const type = document.getElementById('malformedType').value;
      updateStatus(statusElement, `Testing malformed ${type} content...`);
      outputElement.textContent = '';

      const url = getFullUrl(`/malformed/${type}`);

      const response = await fetch(url);
      const contentType = response.headers.get('content-type');

      try {
        // Try to parse as JSON first (should fail)
        const jsonData = await response.json();
        updateStatus(statusElement, `SUCCESS but unexpected: Content was parsed as JSON`);
        outputElement.textContent = `Content-Type: ${contentType}\n\n${JSON.stringify(jsonData, null, 2)}`;
      } catch (e) {
        // Fall back to text (expected path)
        const text = await response.text();
        updateStatus(statusElement, `Expected error parsing JSON: ${e.message}`);
        outputElement.textContent = `Content-Type: ${contentType}\n\nRaw content:\n${text}`;
      }
    } catch (error) {
      updateStatus(statusElement, `ERROR: ${error.message}`, true);
      console.error('Malformed content test error:', error);
    }
  });
  
  // Comprehensive test suite implementation
  const runAllTestsBtn = document.getElementById('runAllTestsBtn');
  
  runAllTestsBtn.addEventListener('click', async () => {
    runAllTestsBtn.disabled = true;
    try {
      await runComprehensiveTests();
    } catch (error) {
      console.error('Test suite error:', error);
      document.getElementById('allTestsProgress').textContent = `Error: ${error.message}`;
    } finally {
      runAllTestsBtn.disabled = false;
    }
  });

  async function runComprehensiveTests() {
    // Reset report
    const testReportOutput = document.getElementById('testReportOutput');
    const testSuiteSummary = document.getElementById('testSuiteSummary');
    const allTestsProgress = document.getElementById('allTestsProgress');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    
    testReportOutput.textContent = '';
    testSuiteSummary.textContent = '';
    downloadReportBtn.style.display = 'none';
    
    // Start test report
    const startTime = performance.now();
    const report = {
      timestamp: new Date().toISOString(),
      proxyUrl: document.getElementById('proxyUrl').value,
      testServerUrl: document.getElementById('testServerUrl').value,
      results: [],
      summary: { passed: 0, failed: 0, total: 0, categories: {} },
    };

    // Define test matrix with all dropdown values
    const testMatrix = [
      { 
        category: "HTTP Methods", 
        tests: ["GET", "POST", "PUT", "DELETE"]
      },
      { 
        category: "Status Codes", 
        tests: Array.from(document.getElementById('statusCode').options).map(o => o.value)
      },
      {
        category: "Content Types",
        tests: Array.from(document.getElementById('contentType').options).map(o => o.value)
      },
      {
        category: "URL Encoding",
        tests: Array.from(document.getElementById('urlType').options).map(o => o.value)
      },
      {
        category: "URL Length",
        tests: Array.from(document.getElementById('urlLength').options).map(o => o.value)
      },
      {
        category: "Unusual Status Codes",
        tests: Array.from(document.getElementById('unusualStatusCode').options).map(o => o.value)
      },
      {
        category: "Large Payload",
        tests: Array.from(document.getElementById('dataSize').options).map(o => o.value)
      },
      {
        category: "Delayed Response",
        tests: Array.from(document.getElementById('delaySeconds').options).map(o => o.value)
      },
      {
        category: "Redirect Types",
        tests: Array.from(document.getElementById('redirectType').options).map(o => o.value)
      },
      {
        category: "Malformed Content",
        tests: Array.from(document.getElementById('malformedType').options).map(o => o.value)
      },
      {
        category: "Concurrent Requests",
        tests: Array.from(document.getElementById('concurrentCount').options).map(o => o.value)
      }
    ];
    
    let totalTests = testMatrix.reduce((acc, category) => acc + category.tests.length, 0);
    let completedTests = 0;
    
    // Run each category of tests
    for (const category of testMatrix) {
      report.summary.categories[category.category] = { total: 0, passed: 0, failed: 0 };
      
      // For each test in the category
      for (const testOption of category.tests) {
        allTestsProgress.textContent = `Running ${category.category} test with option: ${testOption} (${completedTests + 1}/${totalTests})`;
        
        const testResult = {
          category: category.category,
          option: testOption,
          status: 'running'
        };
        
        report.results.push(testResult);
        updateReport(report);
        
        try {
          let result;
          // Execute the appropriate test based on category
          switch (category.category) {
            case "HTTP Methods":
              result = await runHttpMethodTest(testOption);
              break;
            case "Status Codes":
              result = await runStatusCodeTest(testOption);
              break;
            case "Content Types":
              result = await testContentType(testOption);
              break;
            case "URL Encoding":
              result = await testUrlEncoding(testOption);
              break;
            case "URL Length":
              result = await testLongUrl(testOption);
              break;
            case "Unusual Status Codes":
              result = await testUnusualStatus(testOption);
              break;
            case "Large Payload":
              result = await testLargePayload(testOption);
              break;
            case "Delayed Response":
              result = await testDelayedResponse(testOption);
              break;
            case "Redirect Types":
              result = await testRedirect(testOption);
              break; 
            case "Malformed Content":
              result = await testMalformedContent(testOption);
              break;
            case "Concurrent Requests":
              result = await testConcurrentRequests(testOption);
              break;
          }
          
          testResult.status = 'passed';
          testResult.details = result || 'Test completed successfully';
          report.summary.passed++;
          report.summary.categories[category.category].passed++;
          
        } catch (error) {
          testResult.status = 'failed';
          testResult.details = error.message || 'Unknown error';
          report.summary.failed++;
          report.summary.categories[category.category].failed++;
        }
        
        completedTests++;
        report.summary.total++;
        report.summary.categories[category.category].total++;
        updateReport(report);
        
        // Small delay between tests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Additional important tests that don't have dropdowns
    const additionalTests = [
      { name: "Server-Sent Events", function: testStreamConnection },
      { name: "Binary Stream", function: testBinaryStream },
      { name: "WebSocket Connection", function: testWebSocketConnection },
      { name: "Authentication", function: testAuthentication },
      { name: "Custom Headers", function: testCustomHeaders },
      { name: "File Download", function: testFileDownload },
      { name: "X-CORS-Headers", function: testXCorsHeaders }
    ];
    
    // Add category for essential tests
    report.summary.categories["Essential Tests"] = { total: 0, passed: 0, failed: 0 };
    
    // Run essential tests
    for (const test of additionalTests) {
      allTestsProgress.textContent = `Running essential test: ${test.name} (${completedTests + 1}/${totalTests + additionalTests.length})`;
      
      const testResult = {
        category: "Essential Tests",
        option: test.name,
        status: 'running'
      };
      
      report.results.push(testResult);
      updateReport(report);
      
      try {
        const result = await test.function();
        testResult.status = 'passed';
        testResult.details = result || 'Test completed successfully';
        report.summary.passed++;
        report.summary.categories["Essential Tests"].passed++;
      } catch (error) {
        testResult.status = 'failed';
        testResult.details = error.message || 'Unknown error';
        report.summary.failed++;
        report.summary.categories["Essential Tests"].failed++;
      }
      
      completedTests++;
      report.summary.total++;
      report.summary.categories["Essential Tests"].total++;
      updateReport(report);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Complete the report
    const endTime = performance.now();
    report.duration = ((endTime - startTime) / 1000).toFixed(2) + ' seconds';
    report.completedAt = new Date().toISOString();
    allTestsProgress.textContent = `Completed ${report.summary.total} tests in ${report.duration}`;
    
    // Enable download button
    downloadReportBtn.style.display = 'block';
    downloadReportBtn.onclick = () => downloadReport(report);
    
    return report;
  }
  
  // Test helper functions
  async function testXCorsHeaders() {
    const url = getFullUrl('/headers');
    const specialHeaders = {
      'X-Special-Header-1': 'special-value-1',
      'X-Special-Header-2': 'special-value-2',
      'Content-MD5': 'Q2h1Y2sgTm9ycmlz'
    };
    
    const response = await fetch(url, {
      headers: {
        'x-cors-headers': JSON.stringify(specialHeaders)
      }
    });
    
    if (!response.ok) throw new Error(`x-cors-headers test failed: ${response.status}`);
    const data = await response.json();
    
    // Check if any of our special headers made it through
    const foundSpecialHeader = Object.keys(specialHeaders).some(key => 
      data.receivedHeaders[key.toLowerCase()] === specialHeaders[key]);
    
    if (!foundSpecialHeader) {
      throw new Error('x-cors-headers not properly processed');
    }
    
    return {
      headersSent: Object.keys(specialHeaders).length,
      headersReceived: foundSpecialHeader ? 'Successfully processed' : 'Failed'
    };
  }
  
  async function testConcurrentRequests(count) {
    const startTime = performance.now();
    
    // Create array of promises
    const promises = [];
    for (let i = 0; i < parseInt(count); i++) {
      const url = getFullUrl(`/methods/get?concurrent=true&id=${i}`);
      promises.push(fetch(url).then(res => res.json()));
    }
    
    // Wait for all requests to complete
    const results = await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    return {
      requestCount: results.length,
      uniqueResponses: new Set(results.map(r => r.query.id)).size,
      duration: duration + 's'
    };
  }
  
  async function runHttpMethodTest(method) {
    let url, body, response, data;
    
    switch (method) {
      case 'GET':
        url = getFullUrl('/methods/get?test=true');
        response = await fetch(url);
        break;
        
      case 'POST':
        url = getFullUrl('/methods/post');
        body = { test: true, method: 'POST' };
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        break;
        
      case 'PUT':
        url = getFullUrl('/methods/put');
        body = { test: true, method: 'PUT', id: 1 };
        response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        break;
        
      case 'DELETE':
        url = getFullUrl('/methods/delete?id=1');
        response = await fetch(url, { method: 'DELETE' });
        break;
    }
    
    if (!response.ok) throw new Error(`${method} request failed: ${response.status}`);
    data = await response.json();
    
    return { 
      status: response.status, 
      method: data.method || method
    };
  }

  async function runStatusCodeTest(code) {
    const url = getFullUrl(`/status/${code}`);
    const response = await fetch(url);
    return { code: response.status, text: response.statusText };
  }

  async function testStreamConnection() {
    return new Promise((resolve, reject) => {
      const url = getFullUrl('/stream');
      const eventSource = new EventSource(url);
      let messageCount = 0;

      const timeout = setTimeout(() => {
        eventSource.close();
        reject(new Error('Stream timeout - no messages received'));
      }, 5000);

      eventSource.onmessage = (event) => {
        messageCount++;
        if (messageCount >= 3) {
          clearTimeout(timeout);
          eventSource.close();
          resolve({ receivedMessages: messageCount });
        }
      };

      eventSource.onerror = (err) => {
        clearTimeout(timeout);
        eventSource.close();
        reject(new Error('Stream connection error'));
      };
    });
  }

  async function testBinaryStream() {
    const url = getFullUrl('/binary-stream');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binary stream error: ${response.status}`);

    const reader = response.body.getReader();
    let receivedChunks = 0;

    while (receivedChunks < 3) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedChunks++;
    }

    return { receivedChunks };
  }

  async function testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      const serverUrl = document.getElementById('testServerUrl').value;
      const wsProtocol = serverUrl.startsWith('https') ? 'wss:' : 'ws:';
      const serverHost = new URL(serverUrl).host;

      // Direct WebSocket to test server (not through proxy)
      const wsUrl = `${wsProtocol}//${serverHost}`;

      // Proxy WebSocket URL
      const proxyUrl = document.getElementById('proxyUrl').value;
      const proxyWsUrl = `${proxyUrl.replace('http', 'ws')}/?${wsUrl}`;

      const socket = new WebSocket(proxyWsUrl);
      let messagesReceived = 0;

      // Set timeout
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      socket.onopen = () => {
        socket.send('Test message from client');
      };

      socket.onmessage = (event) => {
        messagesReceived++;
        if (messagesReceived >= 2) {
          // Wait for welcome message + echo
          clearTimeout(timeout);
          socket.close();
          resolve({ messagesReceived });
        }
      };

      socket.onerror = (error) => {
        clearTimeout(timeout);
        socket.close();
        reject(new Error('WebSocket connection error'));
      };
    });
  }

  async function testCustomHeaders() {
    const headers = {
      'X-Custom-Header': 'test-value',
      Authorization: 'Bearer test-token',
    };

    const url = getFullUrl('/headers');
    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) throw new Error(`Headers test failed: ${response.status}`);
    const data = await response.json();

    // Verify headers were sent correctly
    return {
      receivedCustomHeader: data.customHeader === 'test-value',
      serverReceivedHeaders: Object.keys(headers).some((key) => data.receivedHeaders[key.toLowerCase()] === headers[key]),
    };
  }

  async function testFileDownload() {
    const url = getFullUrl('/download/image');
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Download test failed: ${response.status}`);

    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');
    const blob = await response.blob();

    return {
      contentType,
      contentDisposition,
      sizeBytes: blob.size,
    };
  }

  async function testLargePayload(size) {
    const url = getFullUrl(`/large-json?size=${size}`);
    const startTime = performance.now();
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Large payload test failed: ${response.status}`);

    const data = await response.json();
    const endTime = performance.now();

    return {
      itemCount: data.count,
      duration: ((endTime - startTime) / 1000).toFixed(2) + 's',
    };
  }

  async function testDelayedResponse(seconds) {
    const url = getFullUrl(`/delay/${seconds}`);
    const startTime = performance.now();
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Delayed response test failed: ${response.status}`);

    const data = await response.json();
    const endTime = performance.now();

    return {
      requestedDelay: seconds + 's',
      actualDelay: ((endTime - startTime) / 1000).toFixed(2) + 's',
    };
  }

  async function testRedirect(type) {
    const url = getFullUrl(`/redirect/${type}`);
    const response = await fetch(url, {
      redirect: 'follow',
    });

    if (!response.ok) throw new Error(`Redirect test failed: ${response.status}`);

    const data = await response.json();
    return {
      finalUrl: response.url,
      redirected: data.query.redirected === 'true',
      redirectType: data.query.from,
    };
  }

  async function testAuthentication() {
    const token = 'test-token-12345';
    const url = getFullUrl('/headers');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error(`Auth test failed: ${response.status}`);
    const data = await response.json();

    return {
      authHeaderReceived: data.receivedHeaders.authorization === `Bearer ${token}`,
    };
  }

  async function testUrlEncoding(type) {
    let queryParams = {};
    let path = '/methods/get';

    switch (type) {
      case 'spaces':
        queryParams = { 'param with spaces': 'value with spaces' };
        break;
      case 'unicode':
        queryParams = { paramünicode: 'valueöäü☺' };
        break;
      case 'fragments':
        queryParams = { normal: 'value' };
        path = '/methods/get#section1';
        break;
      case 'nested':
        queryParams = {
          nested: JSON.stringify({
            level1: {
              level2: 'nestedValue',
              array: [1, 2, 3],
            },
          }),
        };
        break;
    }

    const queryString = new URLSearchParams(queryParams).toString();
    const url = getFullUrl(`${path}${queryString ? '?' + queryString : ''}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`URL encoding test failed: ${response.status}`);

    const data = await response.json();
    return {
      query: data.query,
      type: type,
    };
  }

  async function testContentType(type) {
    const url = getFullUrl(`/content-types/${type}`);
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Content type test failed: ${response.status}`);

    const contentType = response.headers.get('content-type');
    const text = await response.text();

    return {
      contentType,
      responseSize: text.length,
    };
  }

  async function testLongUrl(length) {
    const longString = 'a'.repeat(parseInt(length));
    const url = getFullUrl(`/methods/get?longparam=${longString}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Long URL test failed: ${response.status}`);

    const data = await response.json();
    return {
      requestedLength: parseInt(length),
      receivedLength: data.query.longparam ? data.query.longparam.length : 0,
    };
  }

  async function testUnusualStatus(code) {
    const url = getFullUrl(`/status-unusual/${code}`);

    try {
      const response = await fetch(url);
      const status = response.status;
      try {
        const data = await response.json();
        return { status, message: data.message };
      } catch (e) {
        return { status, error: 'Non-JSON response' };
      }
    } catch (error) {
      throw new Error(`Unusual status test error: ${error.message}`);
    }
  }

  async function testMalformedContent(type) {
    const url = getFullUrl(`/malformed/${type}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Malformed content test failed: ${response.status}`);

    const contentType = response.headers.get('content-type');
    const text = await response.text();

    return {
      contentType,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      length: text.length,
    };
  }
  
  // Update the report display with category summaries
  function updateReport(report) {
    // Update summary
    const testSuiteSummary = document.getElementById('testSuiteSummary');
    const testReportOutput = document.getElementById('testReportOutput');
    
    testSuiteSummary.innerHTML = `
      <strong>Tests:</strong> ${report.summary.total} completed | 
      <span style="color: green;"><strong>Passed:</strong> ${report.summary.passed}</span> | 
      <span style="color: red;"><strong>Failed:</strong> ${report.summary.failed}</span>
    `;
    
    // Update detailed report
    let reportText = `CORS Proxy Test Report
Generated: ${report.timestamp}
${report.completedAt ? `Completed: ${report.completedAt}` : ''}
Proxy URL: ${report.proxyUrl}
Test Server: ${report.testServerUrl}
${report.duration ? `Duration: ${report.duration}` : ''}

=== TEST RESULTS BY CATEGORY ===\n\n`;

    // Group results by category
    const categorizedResults = {};
    report.results.forEach(result => {
      if (!categorizedResults[result.category]) {
        categorizedResults[result.category] = [];
      }
      categorizedResults[result.category].push(result);
    });

    // Display each category and its tests
    for (const [category, results] of Object.entries(categorizedResults)) {
      const categorySummary = report.summary.categories[category] || { total: 0, passed: 0, failed: 0 };
      const passRate = categorySummary.total > 0 ? 
        ((categorySummary.passed / categorySummary.total) * 100).toFixed(1) + '%' : 'N/A';
      
      reportText += `\n${category} (Pass Rate: ${passRate})\n${'-'.repeat(category.length + 20)}\n`;
      
      results.forEach((result, index) => {
        const statusText = result.status === 'passed' ? 'PASS' : 
                          result.status === 'failed' ? 'FAIL' : 'RUNNING';
        
        reportText += `${index + 1}. ${result.option}: [${statusText}]\n`;
        if (result.details && result.status !== 'running') {
          reportText += `   ${typeof result.details === 'string' ? 
            result.details : JSON.stringify(result.details, null, 2)}\n`;
        }
      });
      
      reportText += '\n';
    }
    
    if (report.duration) {
      reportText += `\n=== SUMMARY ===
Total Tests: ${report.summary.total}
Passed: ${report.summary.passed}
Failed: ${report.summary.failed}
Success Rate: ${((report.summary.passed / report.summary.total) * 100).toFixed(1)}%
Duration: ${report.duration}\n\n`;
      
      reportText += `Category Breakdown:\n`;
      for (const [category, stats] of Object.entries(report.summary.categories)) {
        const passRate = stats.total > 0 ? 
          ((stats.passed / stats.total) * 100).toFixed(1) : 0;
        reportText += `- ${category}: ${stats.passed}/${stats.total} (${passRate}% pass)\n`;
      }
    }
    
    testReportOutput.textContent = reportText;
  }
  
  // Download report as text file
  function downloadReport(report) {
    const reportText = document.getElementById('testReportOutput').textContent;
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cors-proxy-complete-test-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});
