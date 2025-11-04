/**
 * Basic Usage Example
 * Shows how to integrate glean-system-assessment into your project
 */

import { GleanSystemAssessment } from '../src/index.js';

async function bootstrapApplication() {
  console.log('🚀 Bootstrapping application with system assessment...\n');

  const gleaner = new GleanSystemAssessment({
    verbose: true,
    cache: true
  });

  // Define what your application needs
  const requirements = {
    ports: {
      // Service ports with preferences
      api: {
        port: 8000,           // Preferred port
        range: [8000, 8099],  // Fallback range
        fallback: 'auto'      // Auto-select if range fails
      },
      frontend: {
        port: 3000,
        range: [3000, 3099]
      },
      websocket: {
        port: 8765,
        range: [8700, 8899]
      },
      database: 8001,  // SurrealDB
      redis: 6379,
      metrics: 9090
    },

    // System requirements
    minMemory: 4 * 1024 * 1024 * 1024,  // 4GB
    minCores: 2,
    gpu: false,  // Optional GPU

    // Configuration overrides
    overrides: {
      logLevel: 'debug',
      enableMetrics: true
    }
  };

  try {
    // Quick check if system can run the app
    console.log('Checking system requirements...');
    const canRun = await gleaner.canRun(requirements);

    if (!canRun) {
      console.error('❌ System does not meet minimum requirements');
      process.exit(1);
    }

    // Full assessment and configuration
    console.log('Performing full system assessment...');
    const assessment = await gleaner.assess(requirements);

    // Use the results to configure your application
    await configureApplication(assessment);

    console.log('\n✅ Application configured successfully!');

    // Start services with assigned ports
    await startServices(assessment.ports);

  } catch (error) {
    console.error('❌ Bootstrap failed:', error.message);
    process.exit(1);
  }
}

async function configureApplication(assessment) {
  const { system, ports, config, environment, recommendations } = assessment;

  console.log('\n📋 Configuration Summary:');
  console.log('------------------------');

  // Configure based on system capabilities
  if (system.capabilities.aiInference === 'high') {
    console.log('✅ High-performance AI inference available');
    console.log(`   Using ${config.ai.preferVLLM ? 'vLLM' : 'Ollama'} backend`);
    console.log(`   Model size: ${config.ai.preferredModel}`);
  } else if (system.capabilities.aiInference === 'cpu-only') {
    console.log('⚠️ CPU-only inference mode');
    console.log('   Using optimized small models');
  }

  // Set up database connection
  console.log(`\n🗄️ Database Configuration:`);
  console.log(`   Max connections: ${config.database.maxConnections}`);
  console.log(`   Query cache: ${config.database.queryCacheSize / (1024 * 1024)}MB`);

  // Configure performance settings
  console.log(`\n⚡ Performance Settings:`);
  console.log(`   Worker threads: ${config.core.workers}`);
  console.log(`   Max memory: ${config.core.maxMemory}MB`);
  console.log(`   Cache enabled: ${config.performance.cacheEnabled}`);

  // Handle recommendations
  if (recommendations && recommendations.length > 0) {
    console.log('\n💡 System Recommendations:');
    recommendations.forEach(rec => {
      console.log(`   ${rec.level === 'warning' ? '⚠️' : 'ℹ️'} ${rec.message}`);
    });
  }

  // The environment variables are already set in process.env
  console.log('\n🔧 Environment Variables Set:');
  console.log(`   API_PORT=${environment.API_PORT}`);
  console.log(`   FRONTEND_PORT=${environment.FRONTEND_PORT}`);
  console.log(`   NODE_OPTIONS=${environment.NODE_OPTIONS}`);
  console.log(`   WORKER_THREADS=${environment.WORKER_THREADS}`);
  console.log(`   ... and ${Object.keys(environment).length - 4} more`);
}

async function startServices(ports) {
  console.log('\n🚀 Starting services with assigned ports:');

  for (const [service, port] of Object.entries(ports)) {
    if (typeof port === 'number') {
      console.log(`   Starting ${service} on port ${port}...`);
      // Your actual service start code here
      // e.g., await startAPIServer(port);
    }
  }
}

// Example: Using just port negotiation
async function justGetPorts() {
  const gleaner = new GleanSystemAssessment();

  const ports = await gleaner.getPorts({
    api: 8000,
    frontend: 3000,
    websocket: 8765
  });

  console.log('Assigned ports:', ports);
  return ports;
}

// Example: Checking specific capabilities
async function checkAICapability() {
  const gleaner = new GleanSystemAssessment();
  const assessment = await gleaner.assess();

  if (assessment.system.gpu.available && assessment.system.gpu.aiCapable) {
    console.log('GPU AI acceleration available!');
    console.log(`VRAM: ${assessment.system.gpu.totalVRAM / 1024}GB`);
    return 'gpu';
  } else if (assessment.system.memory.available > 16 * 1024 * 1024 * 1024) {
    console.log('CPU inference available with sufficient memory');
    return 'cpu';
  } else {
    console.log('Limited AI capabilities');
    return 'limited';
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrapApplication().catch(console.error);
}

export { bootstrapApplication, justGetPorts, checkAICapability };