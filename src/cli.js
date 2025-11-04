#!/usr/bin/env node
/**
 * Glean System Assessment CLI
 * Run system assessment and configure environment
 */

import { GleanSystemAssessment } from './index.js';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log(chalk.cyan.bold('\n🔍 Glean System Assessment\n'));

  const spinner = ora('Analyzing system...').start();

  try {
    const gleaner = new GleanSystemAssessment({
      verbose: process.argv.includes('--verbose'),
      cache: !process.argv.includes('--no-cache')
    });

    // Define service requirements
    const requirements = {
      ports: {
        api: { port: 8000, range: [8000, 8099] },
        frontend: { port: 3000, range: [3000, 3099] },
        websocket: { port: 8765, range: [8700, 8899] },
        database: 8001, // SurrealDB
        ollama: 11434,
        vllm: 8000
      },
      minMemory: 4 * 1024 * 1024 * 1024, // 4GB minimum
      gpu: false // GPU optional
    };

    // Perform assessment
    spinner.text = 'Gleaning system information...';
    const assessment = await gleaner.assess(requirements);

    spinner.succeed('System assessment complete');

    // Display results
    displayResults(assessment);

    // Save report if requested
    if (process.argv.includes('--save')) {
      await saveReport(assessment);
    }

    // Write environment file
    if (!process.argv.includes('--no-env')) {
      console.log(chalk.green('\n✅ Environment configuration saved to .env'));
    }

  } catch (error) {
    spinner.fail('Assessment failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

function displayResults(assessment) {
  const { system, ports, config, recommendations } = assessment;

  // System Summary
  console.log(chalk.cyan.bold('\n📊 System Summary:'));
  console.log(`  CPU: ${system.cpu.brand} (${system.cpu.cores} cores)`);
  console.log(`  Memory: ${formatBytes(system.memory.total)} total, ${formatBytes(system.memory.available)} available`);
  console.log(`  GPU: ${system.gpu.available ? `${system.gpu.primary?.vendor} ${system.gpu.primary?.model}` : 'Not available'}`);
  console.log(`  Platform: ${system.os.platform} ${system.os.arch}`);
  console.log(`  Node: ${system.os.node}`);

  // Capabilities
  console.log(chalk.cyan.bold('\n🎯 Capabilities:'));
  console.log(`  AI Inference: ${getCapabilityLabel(system.capabilities.aiInference)}`);
  console.log(`  Development: ${getCapabilityLabel(system.capabilities.development)}`);
  console.log(`  Database: ${getCapabilityLabel(system.capabilities.database)}`);
  console.log(`  Containerization: ${getCapabilityLabel(system.capabilities.containerization)}`);

  // Port Assignments
  console.log(chalk.cyan.bold('\n🔌 Port Assignments:'));
  Object.entries(ports).forEach(([service, port]) => {
    if (service !== 'conflicts' && service !== 'analysis') {
      const status = ports.conflicts?.find(c => c.service === service) ? chalk.yellow(' (alternative)') : chalk.green(' ✓');
      console.log(`  ${service}: ${port}${status}`);
    }
  });

  // Port Conflicts
  if (ports.conflicts && ports.conflicts.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️ Port Conflicts Resolved:'));
    ports.conflicts.forEach(conflict => {
      console.log(`  ${conflict.service}: ${conflict.requested} → ${conflict.assigned} (${conflict.reason})`);
    });
  }

  // Configuration Highlights
  console.log(chalk.cyan.bold('\n⚙️ Optimal Configuration:'));
  console.log(`  Workers: ${config.core.workers}`);
  console.log(`  Max Memory: ${config.core.maxMemory}MB`);
  console.log(`  Cache Size: ${formatBytes(config.performance.cacheSize)}`);
  console.log(`  AI Model: ${config.ai.preferredModel}`);
  console.log(`  Inference: ${config.ai.preferVLLM ? 'vLLM' : 'Ollama'}`);

  // Recommendations
  if (recommendations && recommendations.length > 0) {
    console.log(chalk.cyan.bold('\n💡 Recommendations:'));
    recommendations.forEach(rec => {
      const icon = rec.level === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`  ${icon} ${rec.message}`);
      if (rec.resolution) {
        console.log(`     → ${rec.resolution}`);
      }
    });
  }

  // Port Environment Analysis
  if (system.ports) {
    console.log(chalk.cyan.bold('\n🔍 Port Environment:'));
    console.log(`  In Use: ${system.ports.inUse.length} ports`);
    console.log(`  Available: ${system.ports.available.length} common ports`);

    if (system.ports.inUse.length > 0 && system.ports.services) {
      console.log(chalk.dim('  Services detected:'));
      Object.entries(system.ports.services).slice(0, 5).forEach(([port, service]) => {
        console.log(chalk.dim(`    ${port}: ${service}`));
      });
      if (Object.keys(system.ports.services).length > 5) {
        console.log(chalk.dim(`    ... and ${Object.keys(system.ports.services).length - 5} more`));
      }
    }
  }
}

function getCapabilityLabel(level) {
  const labels = {
    high: chalk.green('High'),
    medium: chalk.yellow('Medium'),
    low: chalk.red('Low'),
    'cpu-only': chalk.yellow('CPU Only')
  };
  return labels[level] || level;
}

function formatBytes(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

async function saveReport(assessment) {
  const reportPath = path.join(process.cwd(), 'glean-assessment-report.json');
  await fs.promises.writeFile(
    reportPath,
    JSON.stringify(assessment, null, 2),
    'utf8'
  );
  console.log(chalk.green(`\n📄 Full report saved to ${reportPath}`));
}

// Run CLI
main().catch(console.error);