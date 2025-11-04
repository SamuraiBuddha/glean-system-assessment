/**
 * System Gleaner - Comprehensive system assessment
 * Gleans all relevant system information including port environment
 * SECURITY HARDENED: All inputs validated to prevent injection attacks
 */

import si from 'systeminformation';
import { execSync } from 'child_process';
import detectPort from 'detect-port';
import net from 'net';
import { InputValidator } from '../security/input-validator.js';

export class SystemGleaner {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      timeout: 5000,
      ...options
    };

    // Common ports to check during gleaning
    this.commonPorts = {
      // Web servers
      80: 'HTTP',
      443: 'HTTPS',
      3000: 'React/Node Dev',
      3001: 'React Alt',
      4200: 'Angular',
      5000: 'Flask',
      5173: 'Vite',

      // API servers
      8000: 'Django/FastAPI',
      8080: 'Tomcat/Alt HTTP',
      8081: 'Alt API',
      8765: 'WebSocket/API',

      // Databases
      3306: 'MySQL',
      5432: 'PostgreSQL',
      27017: 'MongoDB',
      6379: 'Redis',
      8000: 'SurrealDB HTTP',
      8001: 'SurrealDB WebSocket',

      // AI/ML Services
      11434: 'Ollama',
      8000: 'vLLM',
      1234: 'LM Studio',
      5001: 'MLflow',

      // Development tools
      9229: 'Node Debug',
      9230: 'Node Inspect',
      4000: 'Phoenix',
      6006: 'Storybook'
    };
  }

  /**
   * Perform complete system gleaning
   */
  async glean() {
    const startTime = Date.now();

    const [
      cpu,
      memory,
      gpu,
      os,
      network,
      docker,
      ports,
      storage
    ] = await Promise.all([
      this.gleanCPU(),
      this.gleanMemory(),
      this.gleanGPU(),
      this.gleanOS(),
      this.gleanNetwork(),
      this.gleanDocker(),
      this.analyzePortEnvironment(),
      this.gleanStorage()
    ]);

    const assessment = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      cpu,
      memory,
      gpu,
      os,
      network,
      docker,
      ports,
      storage,
      capabilities: this.assessCapabilities({ cpu, memory, gpu })
    };

    if (this.options.verbose) {
      console.log('System gleaning complete:', assessment);
    }

    return assessment;
  }

  /**
   * CPU assessment
   */
  async gleanCPU() {
    const cpu = await si.cpu();
    const currentLoad = await si.currentLoad();

    return {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      cores: cpu.cores,
      physicalCores: cpu.physicalCores,
      speed: cpu.speed,
      speedMin: cpu.speedMin,
      speedMax: cpu.speedMax,
      load: currentLoad.currentLoad,
      architecture: process.arch,
      flags: cpu.flags?.split(' ') || [],
      hasAVX: cpu.flags?.includes('avx') || false,
      hasAVX2: cpu.flags?.includes('avx2') || false
    };
  }

  /**
   * Memory assessment
   */
  async gleanMemory() {
    const mem = await si.mem();

    return {
      total: mem.total,
      free: mem.free,
      used: mem.used,
      available: mem.available,
      swapTotal: mem.swaptotal,
      swapFree: mem.swapfree,
      sufficient: mem.available > 4 * 1024 * 1024 * 1024, // 4GB minimum
      recommended: mem.available > 8 * 1024 * 1024 * 1024  // 8GB recommended
    };
  }

  /**
   * GPU assessment
   */
  async gleanGPU() {
    const graphics = await si.graphics();
    const controllers = graphics.controllers || [];

    const gpus = controllers.map(gpu => ({
      vendor: gpu.vendor,
      model: gpu.model,
      vram: gpu.vram || 0,
      driverVersion: gpu.driverVersion,
      cuda: this.checkCUDA(gpu),
      rocm: this.checkROCm(gpu)
    }));

    // Find best GPU
    const bestGPU = gpus.sort((a, b) => b.vram - a.vram)[0];

    return {
      available: gpus.length > 0,
      count: gpus.length,
      gpus,
      primary: bestGPU || null,
      cuda: gpus.some(g => g.cuda),
      rocm: gpus.some(g => g.rocm),
      totalVRAM: gpus.reduce((sum, gpu) => sum + gpu.vram, 0),
      aiCapable: this.isAICapable(bestGPU)
    };
  }

  /**
   * OS information
   */
  async gleanOS() {
    const osInfo = await si.osInfo();
    const versions = await si.versions();

    return {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      arch: osInfo.arch,
      hostname: osInfo.hostname,
      node: versions.node,
      npm: versions.npm,
      python: await this.getPythonVersion(),
      docker: versions.docker || null
    };
  }

  /**
   * Network assessment
   */
  async gleanNetwork() {
    const networkInterfaces = await si.networkInterfaces();
    const networkStats = await si.networkStats();

    const activeInterfaces = networkInterfaces
      .filter(iface => !iface.internal && iface.ip4)
      .map(iface => ({
        name: iface.iface,
        ip4: iface.ip4,
        ip6: iface.ip6,
        mac: iface.mac,
        speed: iface.speed,
        type: iface.type
      }));

    return {
      interfaces: activeInterfaces,
      primary: activeInterfaces[0] || null,
      stats: networkStats[0] || null,
      hasInternet: await this.checkInternetConnectivity()
    };
  }

  /**
   * Docker assessment
   */
  async gleanDocker() {
    try {
      const version = execSync('docker --version', { encoding: 'utf8' }).trim();
      const info = execSync('docker info --format json', { encoding: 'utf8' });
      const parsed = JSON.parse(info);

      return {
        available: true,
        version,
        running: parsed.ServerVersion ? true : false,
        containers: parsed.Containers || 0,
        images: parsed.Images || 0
      };
    } catch {
      return {
        available: false,
        running: false
      };
    }
  }

  /**
   * Analyze port environment - this is the key gleaning for port negotiation
   */
  async analyzePortEnvironment() {
    const portStatus = {};
    const inUse = [];
    const available = [];
    const services = {};

    // Check common ports
    for (const [port, service] of Object.entries(this.commonPorts)) {
      const isAvailable = await this.isPortAvailable(parseInt(port));
      portStatus[port] = isAvailable;

      if (isAvailable) {
        available.push(parseInt(port));
      } else {
        inUse.push(parseInt(port));
        services[port] = service;

        // Try to identify what's using it
        const owner = await this.identifyPortOwner(parseInt(port));
        if (owner) {
          services[port] = `${service} (${owner})`;
        }
      }
    }

    // Find available port ranges
    const ranges = await this.findAvailableRanges();

    return {
      inUse,
      available,
      services,
      status: portStatus,
      ranges,
      recommendations: this.recommendPorts(available, inUse)
    };
  }

  /**
   * Storage assessment
   */
  async gleanStorage() {
    const disks = await si.diskLayout();
    const fsSize = await si.fsSize();

    const totalSize = disks.reduce((sum, disk) => sum + disk.size, 0);
    const drives = fsSize.map(fs => ({
      fs: fs.fs,
      mount: fs.mount,
      size: fs.size,
      used: fs.used,
      available: fs.available,
      use: fs.use
    }));

    return {
      totalSize,
      drives,
      main: drives.find(d => d.mount === '/' || d.mount === 'C:\\') || drives[0],
      sufficient: drives.some(d => d.available > 10 * 1024 * 1024 * 1024) // 10GB free
    };
  }

  /**
   * Check if port is available
   */
  async isPortAvailable(port) {
    try {
      const detectedPort = await detectPort(port);
      return detectedPort === port;
    } catch {
      return false;
    }
  }

  /**
   * Try to identify what process is using a port
   * SECURITY: All inputs validated to prevent command injection
   */
  async identifyPortOwner(port) {
    try {
      // CRITICAL: Validate port to prevent command injection
      const safePort = InputValidator.validatePort(port, 'port');

      if (process.platform === 'win32') {
        // Use safe command execution - get all netstat data first
        const netstatOutput = execSync('netstat -ano', { encoding: 'utf8' });
        const lines = netstatOutput.split('\n');

        // Find the line with our port
        const portPattern = new RegExp(`:${safePort}\\s`);
        const portLine = lines.find(line => portPattern.test(line));

        if (portLine) {
          const parts = portLine.trim().split(/\s+/);
          const pid = parts[parts.length - 1];

          // Validate PID before using it
          const safePID = InputValidator.validatePID(pid, 'pid');

          // Get all tasks and filter safely
          const taskListOutput = execSync('tasklist', { encoding: 'utf8' });
          const taskLines = taskListOutput.split('\n');

          // Find task with matching PID
          for (const taskLine of taskLines) {
            if (taskLine.includes(` ${safePID} `)) {
              const taskParts = taskLine.trim().split(/\s+/);
              return taskParts[0];
            }
          }
        }
      } else {
        // Unix/Linux - use safe command execution
        try {
          // Execute lsof with validated port
          const lsofCmd = `/usr/bin/lsof -i :${safePort} -n -P`;
          const output = execSync(lsofCmd, { encoding: 'utf8' });

          // Parse output safely
          const lines = output.split('\n');
          for (const line of lines) {
            if (line.includes('LISTEN')) {
              const parts = line.trim().split(/\s+/);
              return parts[0];
            }
          }
        } catch {
          // lsof might not be available or port not in use
          return null;
        }
      }
    } catch (error) {
      // Log security violations
      if (error.message && error.message.includes('injection')) {
        console.error('SECURITY VIOLATION:', error.message);
      }
      return null;
    }
  }

  /**
   * Find available port ranges
   */
  async findAvailableRanges() {
    const ranges = [];
    const checkRanges = [
      { start: 3000, end: 3100, name: 'Frontend Development' },
      { start: 8000, end: 8100, name: 'API Services' },
      { start: 9000, end: 9100, name: 'Debug/Admin' },
      { start: 5000, end: 5100, name: 'Alternative Services' }
    ];

    for (const range of checkRanges) {
      const available = [];
      for (let port = range.start; port <= Math.min(range.start + 10, range.end); port++) {
        if (await this.isPortAvailable(port)) {
          available.push(port);
        }
      }

      if (available.length > 0) {
        ranges.push({
          ...range,
          available,
          count: available.length
        });
      }
    }

    return ranges;
  }

  /**
   * Recommend ports based on availability
   */
  recommendPorts(available, inUse) {
    const recommendations = {};

    // API server recommendations
    if (!inUse.includes(8000)) {
      recommendations.api = 8000;
    } else if (!inUse.includes(8080)) {
      recommendations.api = 8080;
    } else {
      recommendations.api = available.find(p => p >= 8000 && p < 9000) || 8001;
    }

    // Frontend recommendations
    if (!inUse.includes(3000)) {
      recommendations.frontend = 3000;
    } else if (!inUse.includes(3001)) {
      recommendations.frontend = 3001;
    } else {
      recommendations.frontend = available.find(p => p >= 3000 && p < 4000) || 3002;
    }

    // WebSocket recommendations
    if (!inUse.includes(8765)) {
      recommendations.websocket = 8765;
    } else {
      recommendations.websocket = available.find(p => p >= 8700 && p < 8800) || 8766;
    }

    return recommendations;
  }

  /**
   * Assess system capabilities
   */
  assessCapabilities({ cpu, memory, gpu }) {
    return {
      aiInference: this.assessAICapability({ cpu, memory, gpu }),
      development: this.assessDevCapability({ cpu, memory }),
      database: this.assessDatabaseCapability({ memory }),
      containerization: this.assessContainerCapability({ cpu, memory })
    };
  }

  /**
   * AI capability assessment
   */
  assessAICapability({ cpu, memory, gpu }) {
    if (gpu.aiCapable && gpu.totalVRAM >= 8 * 1024) {
      return 'high'; // Can run large models
    } else if (gpu.aiCapable && gpu.totalVRAM >= 4 * 1024) {
      return 'medium'; // Can run medium models
    } else if (memory.available >= 16 * 1024 * 1024 * 1024 && cpu.cores >= 8) {
      return 'cpu-only'; // CPU inference only
    } else {
      return 'low'; // Limited AI capabilities
    }
  }

  /**
   * Development capability
   */
  assessDevCapability({ cpu, memory }) {
    if (cpu.cores >= 8 && memory.available >= 16 * 1024 * 1024 * 1024) {
      return 'high';
    } else if (cpu.cores >= 4 && memory.available >= 8 * 1024 * 1024 * 1024) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Database capability
   */
  assessDatabaseCapability({ memory }) {
    if (memory.available >= 32 * 1024 * 1024 * 1024) {
      return 'high';
    } else if (memory.available >= 8 * 1024 * 1024 * 1024) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Container capability
   */
  assessContainerCapability({ cpu, memory }) {
    if (cpu.cores >= 4 && memory.available >= 8 * 1024 * 1024 * 1024) {
      return 'high';
    } else if (cpu.cores >= 2 && memory.available >= 4 * 1024 * 1024 * 1024) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Helper methods
  checkCUDA(gpu) {
    return gpu.vendor?.toLowerCase().includes('nvidia') || false;
  }

  checkROCm(gpu) {
    return gpu.vendor?.toLowerCase().includes('amd') || false;
  }

  isAICapable(gpu) {
    if (!gpu) return false;
    return gpu.vram >= 4 * 1024 && (gpu.cuda || gpu.rocm);
  }

  async getPythonVersion() {
    try {
      const version = execSync('python --version', { encoding: 'utf8' }).trim();
      return version.replace('Python ', '');
    } catch {
      try {
        const version = execSync('python3 --version', { encoding: 'utf8' }).trim();
        return version.replace('Python ', '');
      } catch {
        return null;
      }
    }
  }

  async checkInternetConnectivity() {
    return new Promise((resolve) => {
      const socket = net.createConnection(80, 'google.com');
      socket.setTimeout(2000);
      socket.on('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }
}