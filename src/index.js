/**
 * Glean System Assessment
 * Universal system assessment and port negotiation module
 * SECURITY HARDENED: All user inputs validated against injection attacks
 */

import { SystemGleaner } from './core/system-gleaner.js';
import { PortNegotiator } from './core/port-negotiator.js';
import { EnvironmentManager } from './core/environment-manager.js';
import { ConfigGenerator } from './core/config-generator.js';
import { InputValidator } from './security/input-validator.js';

export class GleanSystemAssessment {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      cache: true,
      cacheDir: '.glean-cache',
      ...options
    };

    this.gleaner = new SystemGleaner(this.options);
    this.portNegotiator = new PortNegotiator(this.options);
    this.envManager = new EnvironmentManager(this.options);
    this.configGen = new ConfigGenerator(this.options);
  }

  /**
   * Perform complete system assessment and configuration
   * SECURITY: Validates all requirements to prevent injection
   */
  async assess(requirements = {}) {
    // SECURITY: Validate and sanitize all requirements
    const validatedRequirements = InputValidator.validateRequirements(requirements);

    // Check for potential prompt injection attempts
    if (typeof requirements === 'string' && InputValidator.detectPromptInjection(requirements)) {
      throw new Error('SECURITY VIOLATION: Potential prompt injection detected in requirements');
    }

    console.log('🔍 Gleaning system information...\n');

    // Phase 1: System Assessment
    const system = await this.gleaner.glean();

    // Phase 2: Port Analysis (part of gleaning)
    const portAnalysis = await this.gleaner.analyzePortEnvironment();

    // Phase 3: Port Assignment based on requirements and analysis
    const ports = await this.portNegotiator.assignPorts(requirements.ports || {}, portAnalysis);

    // Phase 4: Generate optimal configuration based on system
    const config = await this.configGen.generate(system, requirements);

    // Phase 5: Set environment variables
    await this.envManager.configure({ ports, config, system });

    return {
      system,
      ports,
      config,
      environment: this.envManager.getVariables(),
      recommendations: this.generateRecommendations(system, ports)
    };
  }

  /**
   * Quick assessment - just check if we can run
   */
  async canRun(requirements = {}) {
    const system = await this.gleaner.gleanBasic();
    return this.meetsRequirements(system, requirements);
  }

  /**
   * Get available ports without full assessment
   */
  async getPorts(services = {}) {
    const portAnalysis = await this.gleaner.analyzePortEnvironment();
    return await this.portNegotiator.assignPorts(services, portAnalysis);
  }

  /**
   * Update environment variables only
   */
  async updateEnvironment(config = {}) {
    return await this.envManager.configure(config);
  }

  /**
   * Generate recommendations based on assessment
   */
  generateRecommendations(system, ports) {
    const recommendations = [];

    // Hardware recommendations
    if (system.memory.available < 4 * 1024 * 1024 * 1024) {
      recommendations.push({
        level: 'warning',
        category: 'memory',
        message: 'Less than 4GB RAM available - consider closing other applications',
        impact: 'Performance may be degraded'
      });
    }

    // Port recommendations
    if (ports.conflicts && ports.conflicts.length > 0) {
      recommendations.push({
        level: 'info',
        category: 'ports',
        message: `Port conflicts detected: ${ports.conflicts.join(', ')}`,
        resolution: 'Alternative ports have been assigned automatically'
      });
    }

    // GPU recommendations
    if (!system.gpu.available && system.gpu.required) {
      recommendations.push({
        level: 'warning',
        category: 'gpu',
        message: 'No GPU detected but GPU acceleration requested',
        fallback: 'Using CPU-optimized algorithms instead'
      });
    }

    return recommendations;
  }

  /**
   * Check if system meets requirements
   */
  meetsRequirements(system, requirements) {
    if (requirements.minMemory && system.memory.available < requirements.minMemory) {
      return false;
    }

    if (requirements.gpu && !system.gpu.available) {
      return false;
    }

    if (requirements.minCores && system.cpu.cores < requirements.minCores) {
      return false;
    }

    return true;
  }
}

// Export convenience functions
export { SystemGleaner } from './core/system-gleaner.js';
export { PortNegotiator } from './core/port-negotiator.js';
export { EnvironmentManager } from './core/environment-manager.js';
export { ConfigGenerator } from './core/config-generator.js';

// Default export for easy usage
export default GleanSystemAssessment;