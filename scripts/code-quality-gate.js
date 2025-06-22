#!/usr/bin/env node
// CODE QUALITY VALIDATION GATE
// Ensures all code meets minimum quality standards before commit/merge

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Quality thresholds
const THRESHOLDS = {
  testCoverage: 80,
  complexity: {
    cognitive: 15,
    cyclomatic: 10
  },
  security: {
    vulnerabilities: 0,
    sensitiveData: 0
  }
};

// Main validation pipeline
async function main() {
  console.log('🔍 Running Code Quality Validation');
  
  try {
    // Run test coverage check
    const coverage = await checkTestCoverage();
    if (coverage < THRESHOLDS.testCoverage) {
      throw new Error(`Test coverage ${coverage}% below ${THRESHOLDS.testCoverage}% threshold`);
    }

    // Run complexity analysis
    const complexityResults = await analyzeComplexity();
    if (complexityResults.cognitive > THRESHOLDS.complexity.cognitive || 
        complexityResults.cyclomatic > THRESHOLDS.complexity.cyclomatic) {
      throw new Error(`High complexity detected (cognitive: ${complexityResults.cognitive}, cyclomatic: ${complexityResults.cyclomatic})`);
    }

    // Run security scan
    const securityResults = await runSecurityScan();
    if (securityResults.vulnerabilities > THRESHOLDS.security.vulnerabilities ||
        securityResults.sensitiveData > THRESHOLDS.security.sensitiveData) {
      throw new Error(`Security issues detected (vulnerabilities: ${securityResults.vulnerabilities}, sensitive data: ${securityResults.sensitiveData})`);
    }

    console.log('✅ All quality checks passed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Quality gate failed:', error.message);
    process.exit(1);
  }
}

// Quality check implementations
async function checkTestCoverage() {
  console.log('Running test coverage analysis...');
  try {
    const output = execSync('npm run test:coverage', { encoding: 'utf-8' });
    const match = output.match(/All files.*?(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  } catch {
    return 0;
  }
}

async function analyzeComplexity() {
  console.log('Running code complexity analysis...');
  try {
    const output = execSync('npx complexity-report', { encoding: 'utf-8' });
    return {
      cognitive: parseComplexityMetric(output, 'Cognitive'),
      cyclomatic: parseComplexityMetric(output, 'Cyclomatic')
    };
  } catch {
    return { cognitive: Infinity, cyclomatic: Infinity };
  }
}

async function runSecurityScan() {
  console.log('Running security scan...');
  try {
    const output = execSync('npx snyk test', { encoding: 'utf-8' });
    return {
      vulnerabilities: countVulnerabilities(output),
      sensitiveData: countSensitiveData(output)
    };
  } catch {
    return { vulnerabilities: Infinity, sensitiveData: Infinity };
  }
}

// Helper functions
function parseComplexityMetric(output, metric) {
  const regex = new RegExp(`${metric} complexity.*?(\\d+)`);
  const match = output.match(regex);
  return match ? parseInt(match[1]) : 0;
}

function countVulnerabilities(output) {
  return (output.match(/✗ Vulnerability found/g) || []).length;
}

function countSensitiveData(output) {
  return (output.match(/sensitive data detected/g) || []).length;
}

// Run main function
main().catch(console.error);