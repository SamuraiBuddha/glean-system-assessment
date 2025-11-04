/**
 * Config Generator
 * Generates optimal configuration based on gleaned system assessment
 */

export class ConfigGenerator {
  constructor(options = {}) {
    this.options = {
      conservative: false, // Use conservative settings
      optimize: 'balanced', // 'performance', 'balanced', 'memory'
      ...options
    };
  }

  /**
   * Generate optimal configuration based on system assessment
   */
  async generate(system, requirements = {}) {
    const config = {
      // Core configuration
      ...this.generateCoreConfig(system),

      // Performance configuration
      ...this.generatePerformanceConfig(system),

      // AI/ML configuration
      ...this.generateAIConfig(system),

      // Database configuration
      ...this.generateDatabaseConfig(system),

      // Network configuration
      ...this.generateNetworkConfig(system),

      // Development configuration
      ...this.generateDevConfig(system),

      // Override with requirements
      ...requirements.overrides
    };

    return this.validateAndAdjust(config, system);
  }

  /**
   * Core configuration
   */
  generateCoreConfig(system) {
    const config = {
      // Process configuration
      workers: this.calculateWorkers(system.cpu),
      maxConcurrency: this.calculateConcurrency(system.cpu, system.memory),

      // Memory limits
      maxMemory: this.calculateMaxMemory(system.memory),
      heapSize: this.calculateHeapSize(system.memory),

      // Timeouts
      defaultTimeout: this.calculateTimeout(system),
      longRunningTimeout: this.calculateLongTimeout(system),

      // Logging
      logLevel: this.options.conservative ? 'info' : 'debug',
      enableMetrics: system.memory.available > 4 * 1024 * 1024 * 1024
    };

    return { core: config };
  }

  /**
   * Performance configuration
   */
  generatePerformanceConfig(system) {
    const config = {
      // Cache configuration
      cacheEnabled: system.memory.available > 2 * 1024 * 1024 * 1024,
      cacheSize: this.calculateCacheSize(system.memory),
      cacheTTL: 3600000, // 1 hour default

      // Batch processing
      batchSize: this.calculateBatchSize(system),
      maxBatchDelay: 100,

      // Threading
      useWorkerThreads: system.cpu.cores > 2,
      workerPoolSize: Math.min(4, system.cpu.cores - 1),

      // IO optimization
      asyncIO: true,
      streamingEnabled: system.memory.available > 4 * 1024 * 1024 * 1024,
      compressionEnabled: system.cpu.cores > 2
    };

    // Adjust based on optimization preference
    if (this.options.optimize === 'performance') {
      config.cacheSize *= 2;
      config.batchSize *= 1.5;
      config.workerPoolSize = Math.min(8, system.cpu.cores);
    } else if (this.options.optimize === 'memory') {
      config.cacheSize *= 0.5;
      config.batchSize *= 0.75;
      config.streamingEnabled = true; // Always stream to save memory
    }

    return { performance: config };
  }

  /**
   * AI/ML configuration
   */
  generateAIConfig(system) {
    const config = {
      // Model selection
      preferredModel: this.selectAIModel(system),
      maxModelSize: this.calculateMaxModelSize(system),

      // Inference settings
      inferenceBackend: this.selectInferenceBackend(system),
      batchInference: system.gpu.available || system.memory.available > 16 * 1024 * 1024 * 1024,

      // GPU configuration
      useGPU: system.gpu.available && system.gpu.aiCapable,
      gpuMemoryFraction: 0.8,
      allowGPUGrowth: true,

      // CPU fallback
      cpuThreads: system.gpu.available ? 2 : Math.max(4, system.cpu.cores - 2),

      // Optimization
      quantization: this.selectQuantization(system),
      precision: system.gpu.available ? 'float16' : 'float32'
    };

    // Service preferences
    if (system.gpu.available && system.gpu.totalVRAM > 8 * 1024) {
      config.preferVLLM = true;
      config.vllmSettings = {
        tensorParallelSize: system.gpu.count > 1 ? 2 : 1,
        maxNumSeqs: 256,
        maxModelLen: 4096
      };
    } else {
      config.preferOllama = true;
      config.ollamaSettings = {
        numGPU: system.gpu.available ? 1 : 0,
        numThread: system.cpu.cores,
        numPredict: 512
      };
    }

    return { ai: config };
  }

  /**
   * Database configuration
   */
  generateDatabaseConfig(system) {
    const config = {
      // Connection pool
      minConnections: 2,
      maxConnections: this.calculateMaxConnections(system),

      // Cache settings
      queryCacheSize: this.calculateQueryCacheSize(system.memory),
      resultCacheEnabled: system.memory.available > 4 * 1024 * 1024 * 1024,

      // Performance
      indexPreload: system.memory.available > 8 * 1024 * 1024 * 1024,
      parallelQueries: system.cpu.cores > 4,

      // Write settings
      batchWrites: true,
      batchWriteSize: this.calculateBatchWriteSize(system),
      writeBufferSize: Math.min(64 * 1024 * 1024, system.memory.available / 100)
    };

    return { database: config };
  }

  /**
   * Network configuration
   */
  generateNetworkConfig(system) {
    const config = {
      // HTTP settings
      keepAlive: true,
      keepAliveTimeout: 60000,
      maxSockets: 100,

      // Request handling
      maxRequestSize: '50mb',
      requestTimeout: 30000,

      // WebSocket settings
      wsEnabled: true,
      wsMaxConnections: this.calculateMaxWebSockets(system),
      wsPingInterval: 30000,

      // Rate limiting
      rateLimitEnabled: true,
      rateLimitWindow: 60000,
      rateLimitMaxRequests: 100
    };

    return { network: config };
  }

  /**
   * Development configuration
   */
  generateDevConfig(system) {
    const config = {
      // Hot reload
      hotReload: system.cpu.cores > 2 && system.memory.available > 4 * 1024 * 1024 * 1024,

      // Source maps
      sourceMaps: system.memory.available > 8 * 1024 * 1024 * 1024,

      // Watch mode
      watchEnabled: true,
      watchPolling: process.platform === 'win32',
      watchInterval: 1000,

      // Build optimization
      parallelBuild: system.cpu.cores > 4,
      buildCacheEnabled: system.memory.available > 4 * 1024 * 1024 * 1024,

      // Testing
      testParallel: system.cpu.cores > 2,
      testWorkers: Math.min(4, system.cpu.cores - 1)
    };

    return { development: config };
  }

  // Calculation helpers

  calculateWorkers(cpu) {
    if (this.options.conservative) {
      return Math.max(1, Math.floor(cpu.cores / 2));
    }
    return Math.max(1, cpu.physicalCores - 1);
  }

  calculateConcurrency(cpu, memory) {
    const cpuBased = cpu.cores * 2;
    const memoryBased = Math.floor(memory.available / (512 * 1024 * 1024)); // 512MB per concurrent task
    return Math.min(cpuBased, memoryBased, 100); // Cap at 100
  }

  calculateMaxMemory(memory) {
    const availableMB = Math.floor(memory.available / (1024 * 1024));
    if (this.options.conservative) {
      return Math.floor(availableMB * 0.5);
    }
    return Math.floor(availableMB * 0.75);
  }

  calculateHeapSize(memory) {
    const maxMemory = this.calculateMaxMemory(memory);
    return Math.floor(maxMemory * 0.8); // 80% of max memory for heap
  }

  calculateTimeout(system) {
    if (system.cpu.cores < 4 || system.memory.available < 4 * 1024 * 1024 * 1024) {
      return 60000; // 1 minute for low-end systems
    }
    return 30000; // 30 seconds for capable systems
  }

  calculateLongTimeout(system) {
    return this.calculateTimeout(system) * 4;
  }

  calculateCacheSize(memory) {
    const availableGB = Math.floor(memory.available / (1024 * 1024 * 1024));
    if (availableGB >= 32) {
      return 4096 * 1024 * 1024; // 4GB
    } else if (availableGB >= 16) {
      return 2048 * 1024 * 1024; // 2GB
    } else if (availableGB >= 8) {
      return 1024 * 1024 * 1024; // 1GB
    } else {
      return 512 * 1024 * 1024; // 512MB
    }
  }

  calculateBatchSize(system) {
    const baseBatch = 100;
    const cpuMultiplier = Math.floor(system.cpu.cores / 4);
    const memoryMultiplier = Math.floor(system.memory.available / (8 * 1024 * 1024 * 1024));
    return baseBatch * Math.max(1, Math.min(cpuMultiplier, memoryMultiplier));
  }

  selectAIModel(system) {
    if (system.gpu.available && system.gpu.totalVRAM >= 24 * 1024) {
      return 'large'; // 13B+ parameters
    } else if (system.gpu.available && system.gpu.totalVRAM >= 8 * 1024) {
      return 'medium'; // 7B parameters
    } else if (system.memory.available >= 16 * 1024 * 1024 * 1024) {
      return 'small'; // 3B parameters
    } else {
      return 'tiny'; // 1B parameters
    }
  }

  calculateMaxModelSize(system) {
    if (system.gpu.available) {
      // GPU memory minus overhead
      return Math.floor(system.gpu.totalVRAM * 0.8);
    } else {
      // System memory minus OS and app overhead
      return Math.floor(system.memory.available * 0.4 / (1024 * 1024 * 1024));
    }
  }

  selectInferenceBackend(system) {
    if (system.gpu.cuda) {
      return 'cuda';
    } else if (system.gpu.rocm) {
      return 'rocm';
    } else if (system.cpu.hasAVX2) {
      return 'cpu-avx2';
    } else if (system.cpu.hasAVX) {
      return 'cpu-avx';
    } else {
      return 'cpu-basic';
    }
  }

  selectQuantization(system) {
    if (system.gpu.available && system.gpu.totalVRAM >= 16 * 1024) {
      return 'none'; // No quantization needed
    } else if (system.gpu.available && system.gpu.totalVRAM >= 8 * 1024) {
      return 'int8'; // 8-bit quantization
    } else {
      return 'int4'; // 4-bit quantization for CPU or low VRAM
    }
  }

  calculateMaxConnections(system) {
    const cpuBased = system.cpu.cores * 4;
    const memoryBased = Math.floor(system.memory.available / (100 * 1024 * 1024)); // 100MB per connection
    return Math.min(cpuBased, memoryBased, 100);
  }

  calculateQueryCacheSize(memory) {
    return Math.floor(this.calculateCacheSize(memory) * 0.25); // 25% of general cache
  }

  calculateBatchWriteSize(system) {
    if (system.memory.available > 16 * 1024 * 1024 * 1024) {
      return 1000;
    } else if (system.memory.available > 8 * 1024 * 1024 * 1024) {
      return 500;
    } else {
      return 100;
    }
  }

  calculateMaxWebSockets(system) {
    const cpuBased = system.cpu.cores * 100;
    const memoryBased = Math.floor(system.memory.available / (10 * 1024 * 1024)); // 10MB per WebSocket
    return Math.min(cpuBased, memoryBased, 10000);
  }

  /**
   * Validate and adjust configuration
   */
  validateAndAdjust(config, system) {
    // Ensure configuration doesn't exceed system capabilities
    if (config.core.maxMemory > system.memory.available / (1024 * 1024)) {
      config.core.maxMemory = Math.floor(system.memory.available / (1024 * 1024) * 0.75);
    }

    if (config.core.workers > system.cpu.cores) {
      config.core.workers = system.cpu.cores - 1;
    }

    // Disable GPU features if not available
    if (!system.gpu.available) {
      config.ai.useGPU = false;
      config.ai.inferenceBackend = config.ai.inferenceBackend.replace('cuda', 'cpu').replace('rocm', 'cpu');
    }

    return config;
  }
}