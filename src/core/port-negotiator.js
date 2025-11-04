/**
 * Port Negotiator
 * Assigns available ports to services based on gleaned port environment
 * Can be replaced with the one from freshbooks-mcp-surreal
 * SECURITY HARDENED: All port inputs validated to prevent injection
 */

import detectPort from 'detect-port';
import { InputValidator } from '../security/input-validator.js';

export class PortNegotiator {
  constructor(options = {}) {
    this.options = {
      startPort: 3000,
      endPort: 65535,
      retries: 10,
      ...options
    };

    // Service port preferences
    this.preferences = {
      frontend: [3000, 3001, 3002, 5173, 4200],
      api: [8000, 8080, 8001, 8081, 3001],
      websocket: [8765, 8766, 8800, 8801, 3002],
      database: [8000, 8001, 27017, 5432, 3306],
      redis: [6379, 6380, 6381],
      ollama: [11434, 11435, 11436],
      vllm: [8000, 8001, 8002, 8003],
      lmstudio: [1234, 1235, 1236],
      admin: [9000, 9001, 9002],
      metrics: [9090, 9091, 9092]
    };

    this.assigned = new Map();
  }

  /**
   * Assign ports to services based on gleaned port analysis
   */
  async assignPorts(requirements = {}, portAnalysis = {}) {
    const assignments = {};
    const conflicts = [];
    const usedPorts = new Set(portAnalysis.inUse || []);

    // Process each required service
    for (const [service, config] of Object.entries(requirements)) {
      const serviceConfig = typeof config === 'number' ? { port: config } : config;
      const assigned = await this.assignPort(service, serviceConfig, usedPorts, portAnalysis);

      if (assigned.conflict) {
        conflicts.push({
          service,
          requested: serviceConfig.port,
          assigned: assigned.port,
          reason: assigned.reason
        });
      }

      assignments[service] = assigned.port;
      usedPorts.add(assigned.port);
      this.assigned.set(service, assigned.port);
    }

    return {
      ...assignments,
      conflicts: conflicts.length > 0 ? conflicts : null,
      analysis: this.analyzeAssignments(assignments, portAnalysis)
    };
  }

  /**
   * Assign a single port to a service
   * SECURITY: Validates all port numbers to prevent injection
   */
  async assignPort(service, config = {}, usedPorts, portAnalysis) {
    // Validate service name
    const validatedService = InputValidator.validateServiceName(service);

    // Try requested port first
    if (config.port) {
      // SECURITY: Validate port to prevent injection
      const validatedPort = InputValidator.validatePort(config.port, `${validatedService}.port`);

      const available = await this.isPortAvailable(validatedPort, usedPorts);
      if (available) {
        return { port: validatedPort, conflict: false };
      }

      // Port is in use, find alternative
      const owner = portAnalysis.services?.[validatedPort] || 'unknown';
      console.log(`⚠️ Port ${validatedPort} for ${validatedService} is in use by ${owner}`);
    }

    // Try preferred ports for this service type
    const preferences = this.preferences[service] || [];
    for (const preferredPort of preferences) {
      const available = await this.isPortAvailable(preferredPort, usedPorts);
      if (available) {
        if (config.port) {
          console.log(`✅ Assigned alternative port ${preferredPort} to ${service}`);
        }
        return {
          port: preferredPort,
          conflict: config.port ? true : false,
          reason: config.port ? `Original port ${config.port} in use` : null
        };
      }
    }

    // Find any available port in ranges
    const port = await this.findAvailablePort(config, usedPorts, portAnalysis);

    if (config.port) {
      console.log(`✅ Assigned fallback port ${port} to ${service}`);
    }

    return {
      port,
      conflict: config.port ? true : false,
      reason: config.port ? `Original port ${config.port} and preferences unavailable` : null
    };
  }

  /**
   * Check if a port is available
   * SECURITY: Validates port number before checking
   */
  async isPortAvailable(port, usedPorts) {
    // SECURITY: Validate port to prevent injection
    const validatedPort = InputValidator.validatePort(port, 'port');

    if (usedPorts.has(validatedPort)) {
      return false;
    }

    try {
      const detectedPort = await detectPort(validatedPort);
      return detectedPort === validatedPort;
    } catch {
      return false;
    }
  }

  /**
   * Find an available port in ranges
   */
  async findAvailablePort(config = {}, usedPorts, portAnalysis) {
    // Try recommended ranges from port analysis
    if (portAnalysis.ranges) {
      for (const range of portAnalysis.ranges) {
        for (const port of range.available || []) {
          if (!usedPorts.has(port)) {
            const available = await this.isPortAvailable(port, usedPorts);
            if (available) {
              return port;
            }
          }
        }
      }
    }

    // Try config-specified range
    if (config.range) {
      const [start, end] = config.range;
      for (let port = start; port <= end; port++) {
        if (!usedPorts.has(port)) {
          const available = await this.isPortAvailable(port, usedPorts);
          if (available) {
            return port;
          }
        }
      }
    }

    // Fall back to detect-port's algorithm
    let port = config.fallback || this.options.startPort;
    for (let i = 0; i < this.options.retries; i++) {
      port = await detectPort(port);
      if (!usedPorts.has(port)) {
        return port;
      }
      port++;
    }

    throw new Error(`Could not find available port after ${this.options.retries} attempts`);
  }

  /**
   * Analyze port assignments
   */
  analyzeAssignments(assignments, portAnalysis) {
    const analysis = {
      optimal: true,
      warnings: [],
      suggestions: []
    };

    // Check if services are on their preferred ports
    for (const [service, port] of Object.entries(assignments)) {
      const preferred = this.preferences[service]?.[0];
      if (preferred && port !== preferred) {
        analysis.optimal = false;
        analysis.warnings.push(
          `${service} is on port ${port} instead of preferred ${preferred}`
        );
      }
    }

    // Check for potential conflicts with common services
    const commonServices = {
      3000: 'React development server',
      8000: 'Django/FastAPI server',
      5432: 'PostgreSQL',
      6379: 'Redis',
      27017: 'MongoDB'
    };

    for (const [service, port] of Object.entries(assignments)) {
      if (commonServices[port] && !service.includes(commonServices[port].toLowerCase())) {
        analysis.suggestions.push(
          `Port ${port} is commonly used by ${commonServices[port]}, consider using alternative for ${service}`
        );
      }
    }

    // Check for port proximity (services on adjacent ports might have issues)
    const sortedPorts = Object.values(assignments).sort((a, b) => a - b);
    for (let i = 1; i < sortedPorts.length; i++) {
      if (sortedPorts[i] - sortedPorts[i - 1] === 1) {
        analysis.warnings.push(
          `Ports ${sortedPorts[i - 1]} and ${sortedPorts[i]} are adjacent, might cause issues`
        );
      }
    }

    return analysis;
  }

  /**
   * Get assigned port for service
   */
  getPort(service) {
    return this.assigned.get(service);
  }

  /**
   * Get all assignments
   */
  getAllAssignments() {
    const assignments = {};
    this.assigned.forEach((port, service) => {
      assignments[service] = port;
    });
    return assignments;
  }

  /**
   * Reset assignments
   */
  reset() {
    this.assigned.clear();
  }
}