// test/testAdmissionSearchOptimization.js
// Test script to demonstrate the admission number search optimization

import { admissionSearchOptimizationHelper } from '../lib/admissionSearchOptimizationHelper.js';

// Function to run optimization tests
export function runOptimizationTests() {
  console.log('🚀 Testing Admission Number Search Optimization\n');

  // Test 1: Individual admission number parsing
  console.log('📝 Test 1: Individual Admission Number Parsing');
  console.log('=' .repeat(50));
  
  const sampleNumbers = [
    "22015112001", // CSE 1
    "22014112003", // ECE 1  
    "22014112008", // AIDS 1 (141)
    "22010812010", // Chemical Engineering
    "invalid123"   // Invalid
  ];

  sampleNumbers.forEach(number => {
    const result = admissionSearchOptimizationHelper.testAdmissionNumberParsing(number);
    console.log(`${number}: ${result.isValid ? '✅' : '❌'} → ${result.targetCollection || 'No mapping'}`);
    if (result.departmentInfo) {
      console.log(`  Department: ${result.departmentInfo.fullName}`);
    }
    if (!result.isValid) {
      console.log(`  Error: ${result.validation.error}`);
    }
    console.log();
  });

  // Test 2: Batch analysis
  console.log('📊 Test 2: Batch Performance Analysis');
  console.log('=' .repeat(50));
  
  const batchNumbers = admissionSearchOptimizationHelper.generateSampleAdmissionNumbers();
  const analysis = admissionSearchOptimizationHelper.analyzePerformanceImprovement(batchNumbers);
  
  console.log(`Total numbers tested: ${analysis.summary.totalNumbers}`);
  console.log(`Valid numbers: ${analysis.summary.validNumbers}`);
  console.log(`Optimizable numbers: ${analysis.summary.optimizableNumbers}`);
  console.log(`Optimization rate: ${analysis.summary.optimizationRate}`);
  console.log();
  
  console.log('Performance Improvement:');
  console.log(`  Old query count: ${analysis.performance.estimatedOldQueries}`);
  console.log(`  New query count: ${analysis.performance.estimatedNewQueries}`);
  console.log(`  Query reduction: ${analysis.performance.queryReduction}`);
  console.log(`  Avg queries per number: ${analysis.performance.avgQueriesPerNumber.old} → ${analysis.performance.avgQueriesPerNumber.new}`);
  console.log();

  console.log('Collection Distribution:');
  Object.entries(analysis.summary.collectionDistribution).forEach(([collection, count]) => {
    console.log(`  ${collection}: ${count} numbers`);
  });
  console.log();

  console.log('Recommendations:');
  analysis.recommendations.forEach(rec => {
    console.log(`  ${rec}`);
  });

  return analysis;
}

// Example usage in console:
// import { runOptimizationTests } from './test/testAdmissionSearchOptimization.js';
// runOptimizationTests();
