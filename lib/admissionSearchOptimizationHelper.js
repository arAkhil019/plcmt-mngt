// lib/admissionSearchOptimizationHelper.js
// Helper functions to test and validate the admission number search optimization

import { admissionNumberParser } from "./admissionNumberParser.js";

export const admissionSearchOptimizationHelper = {
  
  /**
   * Test the parsing and mapping for a single admission number
   * @param {string} admissionNumber - The admission number to test
   * @returns {Object} Test results with parsing details
   */
  testAdmissionNumberParsing(admissionNumber) {
    const validation = admissionNumberParser.validateAdmissionNumber(admissionNumber);
    const targetCollection = admissionNumberParser.getTargetCollection(admissionNumber);
    
    return {
      admissionNumber: admissionNumber,
      isValid: validation.isValid,
      validation: validation,
      targetCollection: targetCollection,
      optimizationPossible: !!targetCollection,
      parseDetails: validation.parsed || null,
      departmentInfo: validation.departmentInfo || null
    };
  },

  /**
   * Test parsing for multiple admission numbers
   * @param {Array<string>} admissionNumbers - Array of admission numbers to test
   * @returns {Object} Batch test results with optimization stats
   */
  testBatchAdmissionNumberParsing(admissionNumbers) {
    const results = {
      totalNumbers: admissionNumbers.length,
      validNumbers: 0,
      invalidNumbers: 0,
      optimizableNumbers: 0,
      collectionDistribution: {},
      invalidNumbers: [],
      validResults: []
    };

    for (const admissionNumber of admissionNumbers) {
      const testResult = this.testAdmissionNumberParsing(admissionNumber);
      
      if (testResult.isValid) {
        results.validNumbers++;
        results.validResults.push(testResult);
        
        if (testResult.optimizationPossible) {
          results.optimizableNumbers++;
          const collection = testResult.targetCollection;
          results.collectionDistribution[collection] = (results.collectionDistribution[collection] || 0) + 1;
        }
      } else {
        results.invalidNumbers++;
        results.invalidNumbers.push({
          admissionNumber: admissionNumber,
          error: testResult.validation.error
        });
      }
    }

    results.optimizationRate = results.totalNumbers > 0 
      ? (results.optimizableNumbers / results.totalNumbers * 100).toFixed(1) + '%'
      : '0%';

    return results;
  },

  /**
   * Analyze the potential performance improvement
   * @param {Array<string>} admissionNumbers - Array of admission numbers
   * @returns {Object} Performance analysis
   */
  analyzePerformanceImprovement(admissionNumbers) {
    const testResults = this.testBatchAdmissionNumberParsing(admissionNumbers);
    const totalCollections = admissionNumberParser.getAllCollections().length;
    
    // Calculate estimated query reduction
    const optimizableCount = testResults.optimizableNumbers;
    const nonOptimizableCount = testResults.totalNumbers - optimizableCount;
    
    // For optimizable numbers: 1 query per number (instead of up to totalCollections queries)
    // For non-optimizable: still need to search all collections
    const oldQueryCount = testResults.totalNumbers * totalCollections;
    const newQueryCount = optimizableCount + (nonOptimizableCount * totalCollections);
    
    const queryReduction = oldQueryCount > 0 
      ? ((oldQueryCount - newQueryCount) / oldQueryCount * 100).toFixed(1) + '%'
      : '0%';

    return {
      summary: testResults,
      performance: {
        totalCollections: totalCollections,
        estimatedOldQueries: oldQueryCount,
        estimatedNewQueries: newQueryCount,
        queryReduction: queryReduction,
        avgQueriesPerNumber: {
          old: totalCollections,
          new: (newQueryCount / testResults.totalNumbers).toFixed(1)
        }
      },
      recommendations: this.generateRecommendations(testResults)
    };
  },

  /**
   * Generate recommendations based on test results
   * @param {Object} testResults - Results from batch testing
   * @returns {Array<string>} Array of recommendation strings
   */
  generateRecommendations(testResults) {
    const recommendations = [];
    
    if (testResults.optimizationRate >= 90) {
      recommendations.push("✅ Excellent optimization potential! Most admission numbers can be directly mapped to collections.");
    } else if (testResults.optimizationRate >= 70) {
      recommendations.push("✅ Good optimization potential. Most searches will be faster.");
    } else if (testResults.optimizationRate >= 50) {
      recommendations.push("⚠️ Moderate optimization potential. Consider reviewing section code mappings.");
    } else {
      recommendations.push("❌ Low optimization potential. Many numbers don't match expected patterns.");
    }

    if (testResults.invalidNumbers > 0) {
      recommendations.push(`⚠️ Found ${testResults.invalidNumbers} invalid admission numbers that need review.`);
    }

    const collectionCount = Object.keys(testResults.collectionDistribution).length;
    if (collectionCount > 0) {
      recommendations.push(`📊 Numbers are distributed across ${collectionCount} collections.`);
      
      // Find most common collection
      const mostCommon = Object.entries(testResults.collectionDistribution)
        .sort(([,a], [,b]) => b - a)[0];
      recommendations.push(`📈 Most common target: ${mostCommon[0]} (${mostCommon[1]} numbers)`);
    }

    return recommendations;
  },

  /**
   * Generate sample admission numbers for testing
   * @returns {Array<string>} Array of sample admission numbers
   */
  generateSampleAdmissionNumbers() {
    return [
      "22015112001", // CSE 1
      "22015212002", // CSE 2  
      "22014112003", // ECE 1
      "22014212004", // ECE 2
      "22017112005", // IT 1
      "22016112006", // EEE 1
      "22012112007", // CSM (AI&ML)
      "22014112008", // AIDS 1 (141)
      "22014212009", // AIDS 2 (142)
      "22010812010", // Chemical Engineering
      "22010912011", // Biotechnology
      "22011512012", // AIML
      "22013112013", // IoT
      "22012112014", // Civil 1
      "22012212015", // Civil 2
      "22012112016", // Mech 1
      "22012212017", // Mech 2
      "invalid123",   // Invalid format
      "22099912018"   // Unknown section code
    ];
  }
};

// Export for use in testing and development
export default admissionSearchOptimizationHelper;
