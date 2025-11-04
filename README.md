# Glean System Assessment

Universal system assessment and port negotiation module for automatic project configuration. Analyzes hardware, software, and network environment to generate optimal configurations and manage port assignments.

## 🎯 Purpose

Stop dealing with:
- "Port 8000 is already in use" errors
- Manual hardware detection for AI model selection
- Hardcoded configurations that don't scale
- Mystery performance issues on different systems

Start with automated:
- System capability assessment
- Intelligent port negotiation
- Optimal configuration generation
- Environment variable management

## 🚀 Installation

```bash
npm install glean-system-assessment
```

## 📊 What It Gleans

### Hardware Assessment
- **CPU**: Cores, architecture, AVX support, current load
- **Memory**: Total, available, recommendations
- **GPU**: CUDA/ROCm support, VRAM, AI capabilities
- **Storage**: Available space, drive information

### Port Environment
- Detects services running on common ports
- Identifies port conflicts before they happen
- Finds available port ranges
- Provides intelligent fallback options

### System Capabilities
- AI inference capability (high/medium/cpu-only/low)
- Development environment rating
- Database hosting capability
- Container support level

### Software Environment
- Node.js, Python versions
- Docker availability
- Network interfaces
- Internet connectivity

## 🔧 Basic Usage

```javascript
import { GleanSystemAssessment } from 'glean-system-assessment';

const gleaner = new GleanSystemAssessment();

// Define your requirements
const requirements = {
  ports: {
    api: 8000,
    frontend: 3000,
    websocket: 8765
  },
  minMemory: 4 * 1024 * 1024 * 1024, // 4GB
  gpu: false // Optional
};

// Perform assessment
const assessment = await gleaner.assess(requirements);

// Use the results
console.log('API Port:', assessment.ports.api);
console.log('AI Capability:', assessment.system.capabilities.aiInference);
console.log('Optimal Workers:', assessment.config.core.workers);
```

## 📋 CLI Usage

```bash
# Run system assessment
npx glean-assess

# With options
npx glean-assess --verbose --save --no-cache

# Options:
#   --verbose    Show detailed output
#   --save       Save full report to JSON file
#   --no-cache   Skip cache, force fresh assessment
#   --no-env     Don't write .env file
```

## 🔌 Port Negotiation

The port negotiator intelligently assigns ports based on:
1. Requested preferences
2. Common service conventions
3. System port analysis
4. Available ranges

```javascript
// Just get ports without full assessment
const ports = await gleaner.getPorts({
  api: { port: 8000, range: [8000, 8099] },
  frontend: { port: 3000, fallback: 'auto' },
  database: 8001
});

// Returns:
// {
//   api: 8000,      // Got preferred
//   frontend: 3001, // 3000 was taken, used next available
//   database: 8001, // Got preferred
//   conflicts: [{ service: 'frontend', requested: 3000, assigned: 3001 }]
// }
```

## 🧩 Environment Variables

Automatically generates and sets environment variables:

```bash
# Port Configuration
API_PORT=8000
FRONTEND_PORT=3000
API_URL=http://localhost:8000

# System Configuration
CPU_CORES=16
WORKER_THREADS=15
NODE_OPTIONS=--max-old-space-size=12288

# Capabilities
GPU_AVAILABLE=true
CUDA_AVAILABLE=true
AI_CAPABLE=true
AI_MODEL_SIZE=large

# Performance
CACHE_SIZE=large
CACHE_MEMORY_MB=4096
```

## 🎨 Configuration Generation

Generates optimal configurations based on system capabilities:

```javascript
const config = assessment.config;

// Automatically configured based on system:
config.core.workers         // CPU cores - 1
config.core.maxMemory       // 75% of available RAM
config.performance.cacheSize // Based on available memory
config.ai.preferredModel    // Based on GPU/RAM
config.database.maxConnections // Based on CPU and RAM
```

## 🏗️ Bootstrap Pattern

Use this at the start of every project:

```javascript
async function bootstrap() {
  const gleaner = new GleanSystemAssessment();

  // Check if system meets requirements
  const canRun = await gleaner.canRun({
    minMemory: 4 * 1024 * 1024 * 1024,
    minCores: 2
  });

  if (!canRun) {
    console.error('System requirements not met');
    process.exit(1);
  }

  // Get configuration
  const assessment = await gleaner.assess();

  // Apply to your app
  configureApp(assessment.config);
  startServices(assessment.ports);
}
```

## 🔍 API Reference

### Main Class

```javascript
class GleanSystemAssessment {
  // Full assessment
  async assess(requirements?: Requirements): Assessment

  // Quick check
  async canRun(requirements?: Requirements): boolean

  // Just ports
  async getPorts(services?: ServiceMap): PortAssignments

  // Update environment
  async updateEnvironment(config?: Config): void
}
```

### Assessment Result

```javascript
{
  system: {
    cpu: { cores, speed, architecture, ... },
    memory: { total, available, sufficient, ... },
    gpu: { available, vram, cuda, aiCapable, ... },
    os: { platform, node, python, ... },
    ports: { inUse, available, services, ... },
    capabilities: { aiInference, development, ... }
  },
  ports: {
    api: 8000,
    frontend: 3001,
    conflicts: [...],
    analysis: { ... }
  },
  config: {
    core: { workers, maxMemory, ... },
    performance: { cacheSize, batchSize, ... },
    ai: { preferredModel, useGPU, ... },
    database: { maxConnections, ... }
  },
  environment: {
    // All generated env vars
  },
  recommendations: [
    { level: 'warning', message: '...', resolution: '...' }
  ]
}
```

## 🎯 Real-World Examples

### AI Application

```javascript
const assessment = await gleaner.assess();

if (assessment.system.capabilities.aiInference === 'high') {
  // Use large models with GPU
  await loadModel('llama-13b', { gpu: true });
} else if (assessment.system.capabilities.aiInference === 'cpu-only') {
  // Use smaller CPU-optimized models
  await loadModel('llama-3b-quantized', { threads: assessment.config.ai.cpuThreads });
} else {
  // Use cloud API fallback
  useCloudAPI();
}
```

### Database Configuration

```javascript
const dbConfig = {
  pool: {
    min: 2,
    max: assessment.config.database.maxConnections,
    idleTimeoutMillis: 30000
  },
  cache: {
    enabled: assessment.config.database.resultCacheEnabled,
    size: assessment.config.database.queryCacheSize
  }
};
```

### Development Server

```javascript
const devServer = {
  port: assessment.ports.frontend,
  hot: assessment.config.development.hotReload,
  sourceMaps: assessment.config.development.sourceMaps,
  workers: assessment.config.development.testWorkers
};
```

## 🔄 Integration with Existing Projects

### With freshbooks-mcp-surreal Port Negotiator

```javascript
// Replace the port negotiator with your existing one
import { PortNegotiator } from 'freshbooks-mcp-surreal';

const gleaner = new GleanSystemAssessment();
gleaner.portNegotiator = new PortNegotiator(customOptions);
```

### Docker Compose Generation

```javascript
const assessment = await gleaner.assess();

// Export for Docker
const dockerEnv = assessment.envManager.exportDockerEnv();
fs.writeFileSync('.env.docker', dockerEnv);

// Generate docker-compose.yml with assigned ports
const compose = {
  services: {
    api: {
      ports: [`${assessment.ports.api}:${assessment.ports.api}`]
    }
  }
};
```

### Kubernetes ConfigMap

```javascript
const configMap = assessment.envManager.exportK8sConfigMap('app-config');
// Deploy to K8s
```

## 📈 Performance Impact

- Assessment runs in ~500ms on modern systems
- Caches results for 5 minutes by default
- Port checking happens in parallel
- Zero runtime overhead after initial assessment

## 🛠️ Troubleshooting

### Port conflicts
```javascript
// Check what's using ports
const assessment = await gleaner.assess();
console.log('Services detected:', assessment.system.ports.services);
```

### Performance issues
```javascript
// Use conservative settings
const gleaner = new GleanSystemAssessment({
  conservative: true,
  optimize: 'memory' // or 'performance'
});
```

### Docker environments
```javascript
// Detect and handle container limits
if (process.env.KUBERNETES_SERVICE_HOST) {
  // Running in K8s, use container limits
  requirements.maxMemory = process.env.MEMORY_LIMIT;
}
```

## 🎉 Why This Should Be Standard

1. **No More "Works on My Machine"**: Adapts to any system
2. **Zero Port Conflicts**: Intelligent negotiation prevents collisions
3. **Optimal Performance**: Configurations tuned to hardware
4. **Better User Experience**: Apps work out of the box
5. **Future Proof**: Easy to add new capability assessments

## 📝 License

MIT

## 🤝 Contributing

Pull requests welcome! This should be in every project's bootstrap.

---

*Stop hardcoding. Start gleaning.*