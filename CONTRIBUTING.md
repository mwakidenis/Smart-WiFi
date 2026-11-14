# Contributing to Smart Wifi

Thank you for considering contributing to Smart Wifi! We welcome contributions from the community.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your feature or bugfix
4. Make your changes
5. Test your changes
6. Push to your fork and submit a pull request

## Development Setup

```bash
# Clone the repository
git clone https://github.com/mwakidenis/Swift-WIFI.git
cd Swift-WIFI

# Install dependencies
npm install

# Copy environment example
cp .env.example .env
# Edit .env with your M-Pesa Daraja credentials

# Start the backend (port 4000)
npm run backend

# Start the frontend (port 3000)
npm run frontend
```

## Code Style

- Follow existing code conventions
- Use meaningful commit messages with conventional prefixes (feat:, fix:, docs:, chore:, ci:, files:, refactor:)
- No TODO or placeholder comments in production code
- Keep functions small and focused
- Add comments only where necessary for complex logic

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run any existing tests to ensure nothing is broken
3. Submit a pull request with a clear description of changes
4. A maintainer will review and provide feedback
5. Once approved, your PR will be merged

## Reporting Issues

Use GitHub Issues to report bugs or request features. Please include:
- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your environment (Node version, OS, etc.)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

