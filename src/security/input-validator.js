/**
 * Security Input Validator
 * Comprehensive input validation and sanitization to prevent injection attacks
 *
 * SECURITY CRITICAL: This module prevents:
 * - Command injection
 * - Path traversal
 * - Null byte injection
 * - Format string attacks
 * - Integer overflow
 * - Prompt injection
 */

export class InputValidator {
  /**
   * Validate port number - CRITICAL SECURITY
   * Prevents command injection via port parameters
   */
  static validatePort(port, paramName = 'port') {
    // Type check first
    if (port === null || port === undefined) {
      throw new Error(`${paramName} is required`);
    }

    // Convert to number if string
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

    // Strict validation
    if (!Number.isInteger(portNum)) {
      throw new Error(`${paramName} must be an integer`);
    }

    if (portNum < 0 || portNum > 65535) {
      throw new Error(`${paramName} must be between 0 and 65535`);
    }

    // Check for command injection attempts
    const portStr = port.toString();
    if (portStr.match(/[;&|`$()<>\\"'\n\r\t]/)) {
      throw new Error(`${paramName} contains invalid characters - possible injection attempt`);
    }

    return portNum;
  }

  /**
   * Validate PID - prevents command injection
   */
  static validatePID(pid, paramName = 'pid') {
    if (pid === null || pid === undefined) {
      throw new Error(`${paramName} is required`);
    }

    const pidNum = typeof pid === 'string' ? parseInt(pid, 10) : pid;

    if (!Number.isInteger(pidNum) || pidNum <= 0) {
      throw new Error(`${paramName} must be a positive integer`);
    }

    // Reasonable PID limit (platform dependent, but this covers most)
    if (pidNum > 4194304) {
      throw new Error(`${paramName} exceeds maximum PID value`);
    }

    // Check for injection
    const pidStr = pid.toString();
    if (pidStr.match(/[^0-9]/)) {
      throw new Error(`${paramName} contains non-numeric characters`);
    }

    return pidNum;
  }

  /**
   * Validate file path - prevents path traversal
   */
  static validatePath(inputPath, options = {}) {
    const {
      basePath = process.cwd(),
      allowAbsolute = false,
      allowedExtensions = null,
      paramName = 'path'
    } = options;

    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error(`${paramName} must be a non-empty string`);
    }

    // Prevent null bytes
    if (inputPath.includes('\0')) {
      throw new Error(`${paramName} contains null bytes - possible injection attempt`);
    }

    // Normalize the path
    const path = require('path');
    const normalizedPath = path.normalize(inputPath);

    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      throw new Error(`${paramName} contains directory traversal - security violation`);
    }

    // Resolve to absolute path
    const absolutePath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.resolve(basePath, normalizedPath);

    // Ensure path is within allowed directory
    const relative = path.relative(basePath, absolutePath);
    if (relative.startsWith('..')) {
      throw new Error(`${paramName} attempts to access outside allowed directory`);
    }

    // Check file extension if specified
    if (allowedExtensions) {
      const ext = path.extname(absolutePath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        throw new Error(`${paramName} has disallowed extension: ${ext}`);
      }
    }

    return absolutePath;
  }

  /**
   * Validate service name - prevents injection in service lookups
   */
  static validateServiceName(name, paramName = 'service') {
    if (!name || typeof name !== 'string') {
      throw new Error(`${paramName} must be a non-empty string`);
    }

    // Allow only alphanumeric, dash, underscore
    if (!name.match(/^[a-zA-Z0-9_-]+$/)) {
      throw new Error(`${paramName} contains invalid characters`);
    }

    // Reasonable length limit
    if (name.length > 256) {
      throw new Error(`${paramName} exceeds maximum length`);
    }

    return name;
  }

  /**
   * Validate memory size values
   */
  static validateMemorySize(size, paramName = 'memory') {
    const sizeNum = typeof size === 'string' ? parseInt(size, 10) : size;

    if (!Number.isInteger(sizeNum) || sizeNum < 0) {
      throw new Error(`${paramName} must be a non-negative integer`);
    }

    // Max reasonable memory (1TB)
    const MAX_MEMORY = 1099511627776;
    if (sizeNum > MAX_MEMORY) {
      throw new Error(`${paramName} exceeds maximum allowed value`);
    }

    return sizeNum;
  }

  /**
   * Sanitize command output - removes control characters
   */
  static sanitizeCommandOutput(output) {
    if (!output) return '';

    // Remove ANSI escape codes
    let sanitized = output.replace(/\x1b\[[0-9;]*m/g, '');

    // Remove other control characters except newline, tab
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Validate environment variable name
   */
  static validateEnvVarName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Environment variable name must be a non-empty string');
    }

    // Must start with letter or underscore, contain only letters, numbers, underscores
    if (!name.match(/^[A-Z_][A-Z0-9_]*$/i)) {
      throw new Error('Invalid environment variable name format');
    }

    // Prevent overwriting critical system vars
    const restricted = [
      'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG',
      'PWD', 'OLDPWD', 'LD_LIBRARY_PATH', 'LD_PRELOAD'
    ];

    if (restricted.includes(name.toUpperCase())) {
      throw new Error(`Cannot overwrite system variable: ${name}`);
    }

    return name;
  }

  /**
   * Validate environment variable value
   */
  static validateEnvVarValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const strValue = value.toString();

    // Prevent shell injection via env values
    if (strValue.match(/[\n\r\0]/)) {
      throw new Error('Environment variable value contains invalid characters');
    }

    // Limit length to prevent overflow
    if (strValue.length > 32768) {
      throw new Error('Environment variable value too long');
    }

    return strValue;
  }

  /**
   * Escape shell arguments - last resort when exec is required
   */
  static escapeShellArg(arg) {
    if (process.platform === 'win32') {
      // Windows escaping
      return '"' + arg.replace(/"/g, '""') + '"';
    } else {
      // Unix escaping
      return "'" + arg.replace(/'/g, "'\\''") + "'";
    }
  }

  /**
   * Validate JSON input - prevents JSON injection
   */
  static validateJSON(input, paramName = 'json') {
    try {
      const parsed = JSON.parse(input);
      // Prevent prototype pollution
      if (parsed.__proto__ || parsed.constructor || parsed.prototype) {
        throw new Error(`${paramName} contains prototype pollution attempt`);
      }
      return parsed;
    } catch (e) {
      throw new Error(`${paramName} is not valid JSON: ${e.message}`);
    }
  }

  /**
   * Validate requirements object
   */
  static validateRequirements(requirements) {
    if (!requirements || typeof requirements !== 'object') {
      return {};
    }

    const validated = {};

    // Validate ports
    if (requirements.ports) {
      validated.ports = {};
      for (const [name, config] of Object.entries(requirements.ports)) {
        const serviceName = this.validateServiceName(name);

        if (typeof config === 'number') {
          validated.ports[serviceName] = this.validatePort(config);
        } else if (typeof config === 'object') {
          validated.ports[serviceName] = {
            port: config.port ? this.validatePort(config.port) : undefined,
            range: config.range ? config.range.map(p => this.validatePort(p)) : undefined,
            fallback: config.fallback === 'auto' ? 'auto' : undefined
          };
        }
      }
    }

    // Validate memory requirements
    if (requirements.minMemory !== undefined) {
      validated.minMemory = this.validateMemorySize(requirements.minMemory);
    }

    if (requirements.maxMemory !== undefined) {
      validated.maxMemory = this.validateMemorySize(requirements.maxMemory);
    }

    // Validate CPU requirements
    if (requirements.minCores !== undefined) {
      const cores = parseInt(requirements.minCores, 10);
      if (!Number.isInteger(cores) || cores < 1 || cores > 1024) {
        throw new Error('Invalid minCores value');
      }
      validated.minCores = cores;
    }

    // Validate GPU requirement
    if (requirements.gpu !== undefined) {
      validated.gpu = Boolean(requirements.gpu);
    }

    return validated;
  }

  /**
   * Create safe command with parameters - prevents injection
   */
  static createSafeCommand(command, params = {}) {
    const safeCommands = {
      'netstat': {
        windows: 'netstat.exe',
        unix: 'netstat',
        allowedFlags: ['-a', '-n', '-o', '-p']
      },
      'lsof': {
        unix: '/usr/bin/lsof',
        allowedFlags: ['-i', '-n', '-P']
      },
      'tasklist': {
        windows: 'tasklist.exe',
        allowedFlags: ['/FI']
      }
    };

    const cmdConfig = safeCommands[command];
    if (!cmdConfig) {
      throw new Error(`Command ${command} not allowed`);
    }

    const platform = process.platform === 'win32' ? 'windows' : 'unix';
    const executable = cmdConfig[platform];

    if (!executable) {
      throw new Error(`Command ${command} not available on ${platform}`);
    }

    // Build safe command
    let safeCmd = executable;

    if (params.flags) {
      for (const flag of params.flags) {
        if (!cmdConfig.allowedFlags.includes(flag)) {
          throw new Error(`Flag ${flag} not allowed for ${command}`);
        }
        safeCmd += ' ' + flag;
      }
    }

    return safeCmd;
  }

  /**
   * Detect and prevent prompt injection attempts
   */
  static detectPromptInjection(input) {
    if (!input || typeof input !== 'string') return false;

    // Common prompt injection patterns
    const injectionPatterns = [
      /ignore\s+(previous|all|above)/i,
      /disregard\s+instructions/i,
      /new\s+instructions:/i,
      /system\s*:\s*you/i,
      /assistant\s*:\s*sure/i,
      /<\|im_start\|>/,
      /<\|im_end\|>/,
      /\[INST\]/,
      /\[\/INST\]/,
      /###\s*Human:/i,
      /###\s*Assistant:/i,
      /\bsudo\b/i,
      /\boverride\b.*\b(safety|security)\b/i
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(input)) {
        console.warn(`Potential prompt injection detected: ${pattern}`);
        return true;
      }
    }

    return false;
  }
}

export default InputValidator;