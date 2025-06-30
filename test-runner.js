#!/usr/bin/env node

/**
 * AskMe AI Test Runner
 * Automated test script for validating AskMe AI functionality
 * 
 * Usage:
 * node test-runner.js [scenario] [--verbose] [--delay=ms]
 * 
 * Examples:
 * node test-runner.js all                    # Run all test scenarios
 * node test-runner.js basic                  # Run basic scenarios (1-5)
 * node test-runner.js chunking               # Test chunking specifically
 * node test-runner.js memory                 # Test memory functionality
 * node test-runner.js scenario-3             # Run specific scenario
 * node test-runner.js --verbose --delay=2000 # Verbose output with 2s delay
 */

// Handle fetch import for different Node.js versions
let fetch;
try {
  // Try native fetch first (Node.js 18+)
  fetch = globalThis.fetch;
  if (!fetch) {
    // Fallback to node-fetch for older versions
    fetch = require('node-fetch');
  }
} catch (error) {
  console.error('❌ Unable to load fetch. Please install node-fetch: npm install node-fetch');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

class AskMeAITester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.testUserEmail = options.testUserEmail || 'deeshop9821@gmail.com';
    this.verbose = options.verbose || false;
    this.delayMs = options.delay || 1000; // Default 1 second delay between requests
    this.testResults = [];
    this.startTime = Date.now();
    
    // Test user profile for setup
    this.testUser = {
      email: 'deeshop9821@gmail.com',
      firstName: 'Sarah',
      age: 32,
      location: 'Austin, United States',
      challenges: ['Anxiety', 'Depression', 'Relationship Issues', 'Finding Purpose'],
      communicationStyle: null, // Not used in current system
      coachingFormat: null // Not used in current system
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'test': '🧪',
      'chunk': '📦',
      'memory': '🧠',
      'token': '🪙'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (this.verbose) {
      // Also write to log file
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logEntry = `${timestamp} [${type.toUpperCase()}] ${message}\n`;
      fs.appendFileSync(path.join(logDir, 'test-runner.log'), logEntry);
    }
  }

  async delay(ms = null) {
    const delayTime = ms || this.delayMs;
    if (delayTime > 0) {
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }
  }

  async sendMessage(message, expectedChecks = [], testName = '') {
    const startTime = Date.now();
    
    try {
      this.log(`Sending message: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`, 'test');
      
      const response = await fetch(`${this.baseUrl}/api/gptRouter`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AskMe-AI-Tester/1.0'
        },
        body: JSON.stringify({
          email: this.testUserEmail,
          message: message
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Perform validation checks
      const checkResults = expectedChecks.map(check => {
        try {
          return check(data);
        } catch (error) {
          return { passed: false, error: error.message };
        }
      });
      
      const allChecksPassed = checkResults.every(result => result.passed !== false);
      
      const results = {
        testName: testName || `Message ${this.testResults.length + 1}`,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        success: data.success !== false && data.response && !data.error, // More lenient success check
        responseTime: responseTime,
        chunked: data.chunked || false,
        chunkCount: data.chunks ? data.chunks.length : 0,
        tokensUsed: data.tokensUsed || 0,
        tokensRemaining: data.tokensRemaining || 0,
        responseLength: data.response ? data.response.length : 0,
        checks: checkResults,
        allChecksPassed: allChecksPassed,
        timestamp: new Date().toISOString(),
        rawResponse: this.verbose ? data : null
      };
      
      this.testResults.push(results);
      
      // Log results
      if (results.success) {
        this.log(`✅ Response received (${responseTime}ms, ${results.responseLength} chars)`, 'success');
        if (results.chunked) {
          this.log(`📦 Response was chunked into ${results.chunkCount} parts`, 'chunk');
        }
        if (results.tokensUsed > 0) {
          this.log(`🪙 Tokens used: ${results.tokensUsed}, remaining: ${results.tokensRemaining}`, 'token');
        }
      } else {
        this.log(`❌ Request failed: ${data.error || 'Unknown error'}`, 'error');
      }
      
      // Log validation results
      checkResults.forEach((check, index) => {
        if (check.passed === false) {
          this.log(`⚠️ Check ${index + 1} failed: ${check.error || check.message}`, 'warning');
        } else if (check.passed === true) {
          this.log(`✅ Check ${index + 1} passed: ${check.message || 'Validation successful'}`, 'success');
        }
      });
      
      if (this.verbose && data.response) {
        this.log(`Response preview: "${data.response.substring(0, 200)}${data.response.length > 200 ? '...' : ''}"`, 'info');
      }
      
      return results;
    } catch (error) {
      this.log(`❌ Request failed with exception: ${error.message}`, 'error');
      const errorResult = { 
        testName: testName || `Message ${this.testResults.length + 1}`,
        success: false, 
        error: error.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      this.testResults.push(errorResult);
      return errorResult;
    }
  }

  async checkUserExists() {
    try {
      this.log('Checking if test user exists...', 'info');
      const response = await fetch(`${this.baseUrl}/api/gptRouter?email=${this.testUserEmail}`);
      const data = await response.json();
      
      if (response.ok && data.id) {
        this.log(`✅ Test user found: ${data.firstName} (ID: ${data.id})`, 'success');
        return true;
      } else {
        this.log('⚠️ Test user not found. Please create user first.', 'warning');
        return false;
      }
    } catch (error) {
      this.log(`❌ Error checking user: ${error.message}`, 'error');
      return false;
    }
  }

  async runScenario1() {
    this.log('=== SCENARIO 1: Initial Greeting & Context Recognition ===', 'test');
    
    // Message 1: Initialization
    await this.sendMessage('__INIT_CHAT__', [
      (data) => ({
        passed: data.response && !data.error,
        message: 'Response should be successful'
      }),
      (data) => ({
        passed: data.response && data.response.toLowerCase().includes('sarah'),
        message: 'Response should include user name (Sarah)'
      }),
      (data) => ({
        passed: data.response && (
          data.response.toLowerCase().includes('challenge') || 
          data.response.toLowerCase().includes('anxiety') ||
          data.response.toLowerCase().includes('depression') ||
          data.response.toLowerCase().includes('purpose')
        ),
        message: 'Response should reference user challenges'
      })
    ], 'Initialization Test');
    
    await this.delay();
    
    // Message 2: Follow-up
    await this.sendMessage(
      "Hi! I'm feeling a bit overwhelmed today and could use some guidance.",
      [
        (data) => ({
          passed: data.response && !data.error,
          message: 'Response should be successful'
        }),
        (data) => ({
          passed: data.response && (
            data.response.toLowerCase().includes('anxiety') ||
            data.response.toLowerCase().includes('overwhelm') ||
            data.response.toLowerCase().includes('understand') ||
            data.response.toLowerCase().includes('depression')
          ),
          message: 'Response should acknowledge anxiety/overwhelm'
        })
      ],
      'Stress Management Follow-up'
    );
  }

  async runScenario2() {
    this.log('=== SCENARIO 2: Long Response Chunking ===', 'test');
    
    const complexRequest = `Can you help me create a comprehensive plan for managing my anxiety and depression? I want something detailed that covers daily coping strategies, relationship improvement techniques, ways to find more purpose in my life, and practical steps I can take when I'm feeling overwhelmed. Please be very thorough and include specific examples and timeframes.`;
    
    await this.sendMessage(complexRequest, [
      (data) => ({
        passed: data.response && !data.error,
        message: 'Response should be successful'
      }),
      (data) => ({
        passed: data.response && data.response.length > 1000,
        message: 'Response should be comprehensive (>1000 chars)'
      }),
      (data) => ({
        passed: data.chunked === true || data.response.length > 1500,
        message: 'Long response should trigger chunking or be very detailed'
      }),
      (data) => ({
        passed: data.response && (
          data.response.toLowerCase().includes('anxiety') &&
          data.response.toLowerCase().includes('depression')
        ),
        message: 'Response should cover anxiety and depression management'
      })
    ], 'Comprehensive Mental Health Plan Request');
  }

  async runScenario3() {
    this.log('=== SCENARIO 3: Context Retention Test ===', 'test');
    
    // Reference previous routine discussion
    await this.sendMessage(
      "That routine looks great! But I'm particularly struggling with the morning part you mentioned. What if I'm not a morning person?",
      [
        (data) => ({
          passed: data.response && !data.error,
          message: 'Response should be successful'
        }),
        (data) => ({
          passed: data.response && (
            data.response.toLowerCase().includes('morning') ||
            data.response.toLowerCase().includes('routine')
          ),
          message: 'Response should reference morning routine context'
        })
      ],
      'Morning Routine Context Test'
    );
    
    await this.delay();
    
    // Goal-specific follow-up
    await this.sendMessage(
      "Also, how does this help with my emotional eating issue specifically?",
      [
        (data) => ({
          passed: data.response && !data.error,
          message: 'Response should be successful'
        }),
        (data) => ({
          passed: data.response && (
            data.response.toLowerCase().includes('emotional') ||
            data.response.toLowerCase().includes('eating') ||
            data.response.toLowerCase().includes('stress')
          ),
          message: 'Response should address emotional eating'
        })
      ],
      'Emotional Eating Context Test'
    );
  }

  async runScenario4() {
    this.log('=== SCENARIO 4: Memory and Summarization ===', 'test');
    
    // Sleep topic introduction
    await this.sendMessage(
      "By the way, I've been having trouble sleeping lately. I know better sleep was one of my goals, but I keep waking up at 3 AM thinking about work deadlines.",
      [
        (data) => ({
          passed: data.response && !data.error,
          message: 'Response should be successful'
        }),
        (data) => ({
          passed: data.response && (
            data.response.toLowerCase().includes('sleep') ||
            data.response.toLowerCase().includes('work') ||
            data.response.toLowerCase().includes('stress')
          ),
          message: 'Response should address sleep and work stress'
        })
      ],
      'Sleep Issue Introduction'
    );
    
    await this.delay();
    
    // Complex interconnected query
    const complexSleepQuery = `I've tried meditation apps and chamomile tea, but nothing seems to work. My mind just races about tomorrow's presentations, client meetings, and project deadlines. Sometimes I lie awake for 2-3 hours. I'm starting to feel exhausted during the day, which makes me reach for sugary snacks more often. It feels like everything is connected - poor sleep, stress eating, low energy. Can you help me break this cycle?`;
    
    await this.sendMessage(complexSleepQuery, [
      (data) => ({
        passed: data.response && !data.error,
        message: 'Response should be successful'
      }),
      (data) => ({
        passed: data.response && data.response.length > 800,
        message: 'Response should be detailed for complex issue'
      }),
      (data) => ({
        passed: data.response && (
          data.response.toLowerCase().includes('cycle') ||
          data.response.toLowerCase().includes('connect') ||
          data.response.toLowerCase().includes('sleep')
        ),
        message: 'Response should address the interconnected cycle'
      })
    ], 'Complex Sleep Cycle Query');
  }

  async runScenario5() {
    this.log('=== SCENARIO 5: Goal Progress and Tracking ===', 'test');
    
    // Progress update
    await this.sendMessage(
      "I wanted to update you on my progress. I've been following some of your advice for about a week now. The morning routine is getting easier, and I managed to avoid stress eating three times this week when I felt overwhelmed at work. But I'm still struggling with the sleep issue.",
      [
        (data) => ({
          passed: data.response && !data.error,
          message: 'Response should be successful'
        }),
        (data) => ({
          passed: data.response && (
            data.response.toLowerCase().includes('progress') ||
            data.response.toLowerCase().includes('great') ||
            data.response.toLowerCase().includes('well done')
          ),
          message: 'Response should celebrate progress'
        }),
        (data) => ({
          passed: data.response && (
            data.response.toLowerCase().includes('sleep') ||
            data.response.toLowerCase().includes('continue')
          ),
          message: 'Response should address ongoing sleep challenge'
        })
      ],
      'Progress Update Test'
    );
  }

  async runTokenTest() {
    this.log('=== TOKEN MANAGEMENT TEST ===', 'test');
    
    // Simple token check
    await this.sendMessage("How many tokens do I have left?", [
      (data) => ({
        passed: data.response && !data.error,
        message: 'Token query should be successful'
      }),
      (data) => ({
        passed: typeof data.tokensRemaining === 'number',
        message: 'Should return token count'
      })
    ], 'Token Balance Check');
  }

  async runChunkingStressTest() {
    this.log('=== CHUNKING STRESS TEST ===', 'test');
    
    const veryLongRequest = `I need an extremely comprehensive, detailed, and thorough wellness plan that covers every single aspect of health and wellness imaginable. Please include detailed daily schedules for every day of the week, comprehensive meal plans with exact recipes and nutritional breakdowns, complete exercise routines with detailed instructions and progressions, stress management techniques with step-by-step guides, sleep optimization strategies with environmental considerations, mindfulness and meditation practices with various techniques, work-life balance strategies, time management systems, goal setting frameworks, habit formation methodologies, nutrition science explanations, exercise physiology details, mental health considerations, social wellness aspects, spiritual wellness elements, financial wellness connections, environmental wellness factors, and preventive health measures. I want everything to be extremely detailed with scientific explanations, practical implementation steps, troubleshooting guides, progress tracking methods, and adaptation strategies for different scenarios and life circumstances.`;
    
    await this.sendMessage(veryLongRequest, [
      (data) => ({
        passed: data.response && !data.error,
        message: 'Very long request should be successful'
      }),
      (data) => ({
        passed: data.chunked === true,
        message: 'Very long response should be chunked'
      }),
      (data) => ({
        passed: data.chunks && data.chunks.length > 1,
        message: 'Should have multiple chunks'
      }),
      (data) => ({
        passed: data.response && data.response.length > 2000,
        message: 'Combined response should be very long'
      })
    ], 'Extreme Chunking Test');
  }

  async runEdgeCaseTests() {
    this.log('=== EDGE CASE TESTS ===', 'test');
    
    // Very short message
    await this.sendMessage("yes", [
      (data) => ({
        passed: data.response && !data.error,
        message: 'Short message should be handled'
      })
    ], 'Short Message Test');
    
    await this.delay(500);
    
    // Ambiguous reference
    await this.sendMessage("Can you explain that thing you mentioned before about the thing?", [
      (data) => ({
        passed: data.response && !data.error,
        message: 'Ambiguous message should be handled'
      }),
      (data) => ({
        passed: data.response && (
          data.response.toLowerCase().includes('clarify') ||
          data.response.toLowerCase().includes('specific') ||
          data.response.toLowerCase().includes('which')
        ),
        message: 'Should ask for clarification'
      })
    ], 'Ambiguous Reference Test');
    
    await this.delay(500);
    
    // Special characters
    await this.sendMessage("Can you help me with my goals? 😔 I'm struggling with emotional eating 📈", [
      (data) => ({
        passed: data.response && !data.error,
        message: 'Message with emojis should be handled'
      })
    ], 'Special Characters Test');
  }

  generateReport() {
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const testsWithPassedChecks = this.testResults.filter(r => r.allChecksPassed).length;
    const totalTime = Date.now() - this.startTime;
    
    const report = {
      summary: {
        totalTests,
        successfulTests,
        testsWithPassedChecks,
        successRate: Math.round((successfulTests / totalTests) * 100),
        validationRate: Math.round((testsWithPassedChecks / totalTests) * 100),
        totalTimeMs: totalTime,
        averageResponseTime: Math.round(
          this.testResults
            .filter(r => r.responseTime)
            .reduce((sum, r) => sum + r.responseTime, 0) / 
          this.testResults.filter(r => r.responseTime).length
        )
      },
      testResults: this.testResults,
      timestamp: new Date().toISOString()
    };
    
    // Save detailed report
    const reportPath = path.join(process.cwd(), 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`📋 Total Tests: ${totalTests}`);
    console.log(`✅ Successful Requests: ${successfulTests}/${totalTests} (${report.summary.successRate}%)`);
    console.log(`🎯 Passed Validations: ${testsWithPassedChecks}/${totalTests} (${report.summary.validationRate}%)`);
    console.log(`⏱️  Total Time: ${Math.round(totalTime / 1000)}s`);
    console.log(`📈 Average Response Time: ${report.summary.averageResponseTime}ms`);
    console.log(`💾 Detailed report saved to: ${reportPath}`);
    
    // Show failed tests
    const failedTests = this.testResults.filter(r => !r.success || !r.allChecksPassed);
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedTests.forEach(test => {
        console.log(`  • ${test.testName}: ${test.error || 'Validation failed'}`);
        if (test.checks) {
          test.checks.forEach((check, idx) => {
            if (check.passed === false) {
              console.log(`    - Check ${idx + 1}: ${check.error || check.message}`);
            }
          });
        }
      });
    }
    
    console.log('='.repeat(60));
    
    return report;
  }

  async runBasicTests() {
    this.log('🚀 Starting BASIC test suite...', 'info');
    await this.runScenario1();
    await this.delay();
    await this.runScenario2();
    await this.delay();
    await this.runScenario3();
    await this.delay();
    await this.runTokenTest();
  }

  async runFullTests() {
    this.log('🚀 Starting FULL test suite...', 'info');
    await this.runScenario1();
    await this.delay();
    await this.runScenario2();
    await this.delay();
    await this.runScenario3();
    await this.delay();
    await this.runScenario4();
    await this.delay();
    await this.runScenario5();
    await this.delay();
    await this.runTokenTest();
    await this.delay();
    await this.runChunkingStressTest();
    await this.delay();
    await this.runEdgeCaseTests();
  }

  async runSpecificScenario(scenarioName) {
    switch (scenarioName.toLowerCase()) {
      case 'scenario-1':
      case '1':
        await this.runScenario1();
        break;
      case 'scenario-2':
      case '2':
        await this.runScenario2();
        break;
      case 'scenario-3':
      case '3':
        await this.runScenario3();
        break;
      case 'scenario-4':
      case '4':
        await this.runScenario4();
        break;
      case 'scenario-5':
      case '5':
        await this.runScenario5();
        break;
      case 'chunking':
        await this.runChunkingStressTest();
        break;
      case 'memory':
        await this.runScenario4();
        break;
      case 'tokens':
        await this.runTokenTest();
        break;
      case 'edge':
        await this.runEdgeCaseTests();
        break;
      default:
        this.log(`❌ Unknown scenario: ${scenarioName}`, 'error');
        return false;
    }
    return true;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const scenario = args.find(arg => !arg.startsWith('--')) || 'basic';
  const verbose = args.includes('--verbose') || args.includes('-v');
  const delayMatch = args.find(arg => arg.startsWith('--delay='));
  const delay = delayMatch ? parseInt(delayMatch.split('=')[1]) : 1000;
  
  console.log('🤖 AskMe AI Test Runner');
  console.log('========================');
  console.log(`📋 Scenario: ${scenario}`);
  console.log(`🔊 Verbose: ${verbose}`);
  console.log(`⏱️  Delay: ${delay}ms`);
  console.log('');
  
  const tester = new AskMeAITester({
    baseUrl: 'http://localhost:3000',
    testUserEmail: 'deeshop9821@gmail.com',
    verbose: verbose,
    delay: delay
  });
  
  // Check if test user exists
  const userExists = await tester.checkUserExists();
  if (!userExists) {
    console.log('❌ Please create the test user first or check if the server is running.');
    process.exit(1);
  }
  
  try {
    // Run tests based on scenario
    switch (scenario.toLowerCase()) {
      case 'all':
      case 'full':
        await tester.runFullTests();
        break;
      case 'basic':
        await tester.runBasicTests();
        break;
      default:
        const success = await tester.runSpecificScenario(scenario);
        if (!success) {
          console.log('Available scenarios: basic, full, all, scenario-1, scenario-2, scenario-3, scenario-4, scenario-5, chunking, memory, tokens, edge');
          process.exit(1);
        }
        break;
    }
    
    // Generate and display report
    const report = tester.generateReport();
    
    // Exit with error code if tests failed
    if (report.summary.successRate < 80 || report.summary.validationRate < 70) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = AskMeAITester;
