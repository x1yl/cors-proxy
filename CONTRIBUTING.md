# Contributing to CORS Proxy

Thank you for your interest in contributing to this project! This document provides guidelines and instructions to help you get started.

## Development Workflow

### 1. Fork and Clone

1. **Fork the Repository**

   - Visit [https://github.com/x1yl/cors-proxy](https://github.com/x1yl/cors-proxy)
   - Click the "Fork" button in the upper right corner
   - This creates your own copy of the repository under your GitHub account

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR-USERNAME/cors-proxy.git
   cd cors-proxy
   ```

3. **Add the Original Repository as Upstream**
   ```bash
   git remote add upstream https://github.com/x1yl/cors-proxy.git
   ```

### 2. Set Up Development Environment

1. **Install Dependencies**

   ```bash
   pnpm install
   ```

2. **Switch to the Staging Branch**

   ```bash
   git checkout staging
   ```

   > ⚠️ **Important**: All development work should be done on the staging branch, not main

### 3. Make and Test Your Changes

1. **Run the Development Server**

   ```bash
   pnpm dev
   ```

   This will start the Cloudflare Worker locally on `http://localhost:8787`

2. **Test Your Changes**

   - Open `test/client.html` in your browser to run the test suite
   - Alternatively, run `pnpm test:client` which should open the test client
   - Ensure all automated tests pass, especially for any features you've modified

3. **Manual Testing**
   - Use the WebSocket testing tab to verify WebSocket functionality
   - Test any specific endpoints or features you've modified

### 4. Submit Your Contribution

1. **Commit Your Changes**

   ```bash
   git add .
   git commit -m "Brief description of your changes"
   ```

2. **Push to Your Fork**

   ```bash
   git push origin staging
   ```

3. **Create a Pull Request**
   - Go to your fork on GitHub
   - Click "Pull Request"
   - Ensure the base repository is `x1yl/cors-proxy` and the base branch is `staging` (NOT `main`)
   - Fill in details about your changes
   - Submit your PR

## Pull Request Guidelines

- **Always target the staging branch** with your pull requests, not main
- Provide a clear description of the changes
- Include steps for testing
- Ensure all tests pass
- Keep PRs focused on a single feature or fix

## Testing Requirements

All contributions should be tested using the included test client:

1. Basic functionality tests should pass
2. If you added features, include tests for them
3. For WebSocket changes, explicitly test the WebSocket functionality
4. Ensure CORS headers are properly set in all responses
5. Check for any degradation in existing functionality

## Code Style

- Follow the existing code style
- Use clear and descriptive variable/function names
- Add comments for complex logic
- Keep functions small and focused

## Need Help?

If you need help or have questions, please:

- Open an issue on GitHub
- Ask questions in the PR

Thank you for contributing!
