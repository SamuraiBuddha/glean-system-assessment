/**
 * Environment Manager
 * Manages environment variables based on gleaned system assessment
 * Works with existing port negotiator from freshbooks-mcp-surreal
 * SECURITY HARDENED: Path validation prevents traversal attacks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { InputValidator } from '../security/input-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EnvironmentManager {
  constructor(options = {}) {
    this.options = {
      envFile: '.env',
      autoCreate: true,
      prefix: 'GLEAN_',
      ...options
    };

    this.variables = new Map();
    this.loadExisting();
  }

  /**
   * Configure environment based on gleaned data and assigned ports
   */
  async configure({ ports = {}, config = {}, system = {} }) {
    // Port configuration from negotiator
    this.configurePorts(ports);

    // System-based configuration
    this.configureSystem(system);

    // Application configuration
    this.configureApp(config);

    // Write to .env file
    if (this.options.autoCreate) {
      await this.writeEnvFile();
    }

    // Set process environment
    this.applyToProcess();

    return this.getVariables();
  }

  /**
   * Configure port environment variables
   * Works with port assignments from negotiator
   */
  configurePorts(ports) {
    // Standard port mappings
    const portMappings = {
      api: 'API_PORT',
      frontend: 'FRONTEND_PORT',
      websocket: 'WS_PORT',
      database: 'DB_PORT',
      redis: 'REDIS_PORT',
      ollama: 'OLLAMA_PORT',
      vllm: 'VLLM_PORT',
      lmstudio: 'LMSTUDIO_PORT'
    };

    // Set assigned ports
    Object.entries(ports).forEach(([service, port]) => {
      const envKey = portMappings[service] || `${service.toUpperCase()}_PORT`;
      this.set(envKey, port);

      // Also set URL variables for convenience
      if (service === 'api') {
        this.set('API_URL', `http://localhost:${port}`);
      } else if (service === 'frontend') {
        this.set('FRONTEND_URL', `http://localhost:${port}`);
      } else if (service === 'websocket') {
        this.set('WS_URL', `ws://localhost:${port}`);
      } else if (service === 'database') {
        this.set('DATABASE_URL', `http://localhost:${port}`);
      }
    });

    // Set service-specific endpoints
    if (ports.ollama) {
      this.set('OLLAMA_ENDPOINT', `http://127.0.0.1:${ports.ollama}/v1/chat/completions`);
      this.set('OLLAMA_HEALTH_ENDPOINT', `http://127.0.0.1:${ports.ollama}/v1/models`);
    }

    if (ports.vllm) {
      this.set('VLLM_ENDPOINT', `http://127.0.0.1:${ports.vllm}/v1/chat/completions`);
      this.set('VLLM_HEALTH_ENDPOINT', `http://127.0.0.1:${ports.vllm}/health`);
    }

    if (ports.lmstudio) {
      this.set('LMSTUDIO_ENDPOINT', `http://localhost:${ports.lmstudio}/v1/chat/completions`);
    }
  }

  /**
   * Configure system-based environment variables
   */
  configureSystem(system) {
    if (!system || Object.keys(system).length === 0) return;

    // CPU configuration
    if (system.cpu) {
      this.set('CPU_CORES', system.cpu.cores);
      this.set('CPU_PHYSICAL_CORES', system.cpu.physicalCores);

      // Worker thread configuration
      const optimalWorkers = Math.max(1, system.cpu.physicalCores - 1);
      this.set('WORKER_THREADS', optimalWorkers);
      this.set('MAX_WORKERS', system.cpu.cores);
    }

    // Memory configuration
    if (system.memory) {
      const availableGB = Math.floor(system.memory.available / (1024 * 1024 * 1024));
      this.set('AVAILABLE_MEMORY_GB', availableGB);

      // Node.js memory limits
      const nodeMaxMemory = Math.floor(availableGB * 0.75 * 1024); // 75% of available RAM in MB
      this.set('NODE_OPTIONS', `--max-old-space-size=${nodeMaxMemory}`);

      // Cache sizes based on available memory
      if (availableGB >= 32) {
        this.set('CACHE_SIZE', 'large');
        this.set('CACHE_MEMORY_MB', 4096);
      } else if (availableGB >= 16) {
        this.set('CACHE_SIZE', 'medium');
        this.set('CACHE_MEMORY_MB', 2048);
      } else if (availableGB >= 8) {
        this.set('CACHE_SIZE', 'small');
        this.set('CACHE_MEMORY_MB', 1024);
      } else {
        this.set('CACHE_SIZE', 'minimal');
        this.set('CACHE_MEMORY_MB', 512);
      }
    }

    // GPU configuration
    if (system.gpu) {
      this.set('GPU_AVAILABLE', system.gpu.available);
      this.set('GPU_COUNT', system.gpu.count);

      if (system.gpu.primary) {
        this.set('GPU_VRAM_GB', Math.floor(system.gpu.primary.vram / 1024));
        this.set('GPU_VENDOR', system.gpu.primary.vendor);
        this.set('GPU_MODEL', system.gpu.primary.model);
      }

      // AI capability flags
      this.set('CUDA_AVAILABLE', system.gpu.cuda || false);
      this.set('ROCM_AVAILABLE', system.gpu.rocm || false);
      this.set('AI_CAPABLE', system.gpu.aiCapable || false);
    }

    // Capabilities-based configuration
    if (system.capabilities) {
      const caps = system.capabilities;

      // AI model selection based on capability
      if (caps.aiInference === 'high') {
        this.set('AI_MODEL_SIZE', 'large');
        this.set('PREFER_GPU', true);
        this.set('MAX_MODEL_SIZE_GB', 13); // 13B parameters
      } else if (caps.aiInference === 'medium') {
        this.set('AI_MODEL_SIZE', 'medium');
        this.set('PREFER_GPU', true);
        this.set('MAX_MODEL_SIZE_GB', 7); // 7B parameters
      } else if (caps.aiInference === 'cpu-only') {
        this.set('AI_MODEL_SIZE', 'small');
        this.set('PREFER_GPU', false);
        this.set('MAX_MODEL_SIZE_GB', 3); // 3B parameters
      } else {
        this.set('AI_MODEL_SIZE', 'tiny');
        this.set('PREFER_GPU', false);
        this.set('MAX_MODEL_SIZE_GB', 1); // 1B parameters
      }

      // Development environment optimization
      if (caps.development === 'high') {
        this.set('DEV_MODE_OPTIMIZATION', 'performance');
        this.set('HOT_RELOAD', true);
        this.set('SOURCE_MAPS', true);
      } else if (caps.development === 'medium') {
        this.set('DEV_MODE_OPTIMIZATION', 'balanced');
        this.set('HOT_RELOAD', true);
        this.set('SOURCE_MAPS', false);
      } else {
        this.set('DEV_MODE_OPTIMIZATION', 'minimal');
        this.set('HOT_RELOAD', false);
        this.set('SOURCE_MAPS', false);
      }
    }

    // Docker configuration
    if (system.docker) {
      this.set('DOCKER_AVAILABLE', system.docker.available);
      this.set('DOCKER_RUNNING', system.docker.running);
    }

    // OS-specific configuration
    if (system.os) {
      this.set('PLATFORM', system.os.platform);
      this.set('NODE_VERSION', system.os.node);
      this.set('PYTHON_VERSION', system.os.python);
    }
  }

  /**
   * Configure application-specific variables
   */
  configureApp(config) {
    Object.entries(config).forEach(([key, value]) => {
      const envKey = this.normalizeKey(key);
      this.set(envKey, value);
    });
  }

  /**
   * Set an environment variable
   * SECURITY: Validates key and value to prevent injection
   */
  set(key, value) {
    try {
      // Validate key to prevent env var injection
      const validatedKey = InputValidator.validateEnvVarName(key);
      const prefixedKey = this.options.prefix + validatedKey;

      // Validate value to prevent shell injection
      const validatedValue = InputValidator.validateEnvVarValue(value);

      // Store with both prefixed and unprefixed keys
      this.variables.set(prefixedKey, validatedValue);
      this.variables.set(validatedKey, validatedValue); // Also set without prefix for compatibility
    } catch (error) {
      // Skip invalid environment variables with security warning
      console.warn(`SECURITY: Skipping invalid environment variable ${key}: ${error.message}`);
    }
  }

  /**
   * Get an environment variable
   */
  get(key) {
    return this.variables.get(key) || this.variables.get(this.options.prefix + key);
  }

  /**
   * Load existing .env file
   */
  loadExisting() {
    try {
      const envPath = path.resolve(process.cwd(), this.options.envFile);
      if (fs.existsSync(envPath)) {
        const result = dotenv.config({ path: envPath });
        if (result.parsed) {
          Object.entries(result.parsed).forEach(([key, value]) => {
            this.variables.set(key, value);
          });
        }
      }
    } catch (error) {
      console.warn(`Could not load existing .env file: ${error.message}`);
    }
  }

  /**
   * Write environment variables to .env file
   */
  async writeEnvFile() {
    const envPath = path.resolve(process.cwd(), this.options.envFile);
    const lines = [];

    // Header
    lines.push('# Auto-generated by glean-system-assessment');
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Group variables by category
    const categories = {
      ports: [],
      system: [],
      capabilities: [],
      app: []
    };

    this.variables.forEach((value, key) => {
      if (key.includes('PORT') || key.includes('URL') || key.includes('ENDPOINT')) {
        categories.ports.push(`${key}=${value}`);
      } else if (key.includes('CPU') || key.includes('MEMORY') || key.includes('GPU')) {
        categories.system.push(`${key}=${value}`);
      } else if (key.includes('CAPABLE') || key.includes('AVAILABLE') || key.includes('MODE')) {
        categories.capabilities.push(`${key}=${value}`);
      } else {
        categories.app.push(`${key}=${value}`);
      }
    });

    // Write categories
    if (categories.ports.length > 0) {
      lines.push('# Port Configuration');
      lines.push(...categories.ports);
      lines.push('');
    }

    if (categories.system.length > 0) {
      lines.push('# System Configuration');
      lines.push(...categories.system);
      lines.push('');
    }

    if (categories.capabilities.length > 0) {
      lines.push('# Capabilities');
      lines.push(...categories.capabilities);
      lines.push('');
    }

    if (categories.app.length > 0) {
      lines.push('# Application Configuration');
      lines.push(...categories.app);
      lines.push('');
    }

    // SECURITY: Validate path before writing to prevent traversal attacks
    const safePath = InputValidator.validatePath(envPath, {
      basePath: process.cwd(),
      allowedExtensions: ['.env'],
      paramName: 'envFile'
    });

    // Write file with validated path
    await fs.promises.writeFile(safePath, lines.join('\n'), 'utf8');
    console.log(`✅ Environment configuration written to ${this.options.envFile}`);
  }

  /**
   * Apply variables to current process
   */
  applyToProcess() {
    this.variables.forEach((value, key) => {
      process.env[key] = value;
    });
  }

  /**
   * Get all variables as object
   */
  getVariables() {
    const obj = {};
    this.variables.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Normalize key name
   */
  normalizeKey(key) {
    return key
      .replace(/([A-Z])/g, '_$1')
      .replace(/[^A-Z0-9_]/gi, '_')
      .toUpperCase();
  }

  /**
   * Export for Docker Compose
   */
  exportDockerEnv() {
    const lines = [];
    this.variables.forEach((value, key) => {
      // Skip Node-specific options for Docker
      if (!key.includes('NODE_OPTIONS')) {
        lines.push(`${key}=${value}`);
      }
    });
    return lines.join('\n');
  }

  /**
   * Export for Kubernetes ConfigMap
   */
  exportK8sConfigMap(name = 'app-config') {
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name },
      data: {}
    };

    this.variables.forEach((value, key) => {
      configMap.data[key] = value;
    });

    return configMap;
  }
}