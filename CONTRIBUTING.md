# Contributing to Glean System Assessment

First off, thank you for considering contributing to Glean System Assessment! It's people like you that make this tool better for everyone.

## Code of Conduct

By participating in this project, you are expected to uphold our values of respect, inclusivity, and collaboration.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps which reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include system information** (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run security checks (`npm run security:check`)
6. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
7. Push to the branch (`git push origin feature/AmazingFeature`)
8. Open a Pull Request

## Development Setup

1. Clone your fork:
```bash
git clone https://github.com/your-username/glean-system-assessment.git
cd glean-system-assessment
```

2. Install dependencies:
```bash
npm install
```

3. Run tests:
```bash
npm test
```

4. Run the CLI:
```bash
npm run assess
```

## Coding Standards

- Use ES6+ JavaScript features
- Follow existing code style
- Add tests for new functionality
- Update documentation for API changes
- Ensure all tests pass
- Keep commits atomic and well-described

## Testing

- Write tests for all new functionality
- Ensure existing tests pass
- Add security tests when appropriate
- Test on multiple platforms when possible

## Documentation

- Update README.md if functionality changes
- Add JSDoc comments for new functions
- Update CHANGELOG.md following Keep a Changelog format
- Include examples for new features

## Security

- Always run `npm run security:check` before submitting
- Never commit sensitive information
- Report security vulnerabilities privately to the maintainers
- Follow security best practices in code

## Questions?

Feel free to open an issue with your question or reach out to the maintainers directly.

Thank you for contributing! 🚀