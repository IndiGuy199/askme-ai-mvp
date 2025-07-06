/**
 * AskMe AI Mental Health Chat - Comprehensive Functional Test Suite
 * Tests intent detection, conversation state management, and therapeutic response patterns
 */

const axios = require('axios');

class MentalHealthTestSuite {
  constructor(baseUrl = 'http://localhost:3000', testUserEmail = 'rd9821@gmail.com') {
    this.baseUrl = baseUrl;
    this.testUserEmail = testUserEmail;
    this.conversationHistory = [];
    this.testResults = [];
    this.delay = 2000; // 2 second delay between messages
  }

  async delay_helper(ms = this.delay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendMessage(message, validations = [], testName = '') {
    console.log(`\n📝 SENDING: "${message}"`);
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/gptRouter`, {
        email: this.testUserEmail,
        message: message,
        messages: this.conversationHistory,
        isFirstMessage: this.conversationHistory.length === 0
      });

      const aiResponse = response.data.response;
      console.log(`🤖 RECEIVED: "${aiResponse}"`);

      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: aiResponse }
      );

      // Run validations
      const results = validations.map(validation => {
        try {
          const result = validation(response.data);
          if (!result.passed) {
            console.log(`❌ VALIDATION FAILED: ${result.message}`);
          } else {
            console.log(`✅ VALIDATION PASSED: ${result.message}`);
          }
          return result;
        } catch (error) {
          console.error(`🚨 VALIDATION ERROR: ${error.message}`);
          return { passed: false, message: `Validation error: ${error.message}` };
        }
      });

      const testResult = {
        testName,
        message,
        response: aiResponse,
        validations: results,
        success: results.length === 0 || results.every(r => r.passed),
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      return testResult;

    } catch (error) {
      console.error(`🚨 REQUEST FAILED: ${error.message}`);
      const failedResult = {
        testName,
        message,
        response: null,
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      };
      this.testResults.push(failedResult);
      return failedResult;
    }
  }

  // Helper validation functions
  hasAdviceKeywords(response) {
    return /\b(try|suggest|recommend|here are|steps?|approach|strategy|can help)\b/i.test(response);
  }

  hasQuestions(response) {
    return /\?/.test(response);
  }

  hasValidation(response) {
    return /\b(sorry|understand|hear|sounds?\s+(hard|difficult)|that must be|really hard|not alone)\b/i.test(response);
  }

  hasChoiceOffering(response) {
    return /would you like|do you want|prefer|or are you looking|or do you want/i.test(response);
  }

  hasBoundaryRespect(response) {
    return /of course|absolutely|we can focus|most comfortable/i.test(response);
  }

  hasEscalation(response) {
    return /doctor|professional|emergency|serious|ER|crisis/i.test(response);
  }

  hasApology(response) {
    return /sorry|apologize|my approach|repeating myself/i.test(response);
  }

  hasImmediateHelp(response) {
    return /right now|immediately|can try|you can|here are some things/i.test(response);
  }

  // TEST CASE 1: Direct Advice Request
  async runTest1_DirectAdviceRequest() {
    console.log('\n=== TEST 1: Direct Advice Request ===');
    
    return await this.sendMessage(
      "I'm feeling anxious and depressed. What should I do?",
      [
        (data) => ({
          passed: this.hasAdviceKeywords(data.response),
          message: 'Should provide concrete advice immediately for direct request'
        }),
        (data) => ({
          passed: !data.response.includes('tell me more') && !data.response.includes('can you share'),
          message: 'Should NOT ask exploratory questions on direct advice request'
        }),
        (data) => ({
          passed: /\b(anxiety|depression)\b/i.test(data.response),
          message: 'Should address specific conditions mentioned'
        }),
        (data) => ({
          passed: this.hasValidation(data.response),
          message: 'Should validate feelings before giving advice'
        })
      ],
      'Direct Advice Request'
    );
  }

  // TEST CASE 2: Explore First Strategy
  async runTest2_ExploreFirstStrategy() {
    console.log('\n=== TEST 2: Explore First Strategy ===');
    
    // Clear conversation for fresh start
    this.conversationHistory = [];
    
    // Step 1: Emotional sharing without direct ask
    await this.sendMessage(
      "I've been feeling down lately.",
      [
        (data) => ({
          passed: this.hasQuestions(data.response) && /tell me more|what's|how|when|what.*making/i.test(data.response),
          message: 'Should ask exploratory question for emotional sharing'
        }),
        (data) => ({
          passed: !this.hasAdviceKeywords(data.response),
          message: 'Should NOT give immediate advice without request'
        }),
        (data) => ({
          passed: this.hasValidation(data.response),
          message: 'Should validate the emotional sharing'
        })
      ],
      'Exploration Response Test'
    );

    await this.delay_helper();

    // Step 2: User provides context
    return await this.sendMessage(
      "Mostly trouble sleeping and work stress.",
      [
        (data) => ({
          passed: this.hasChoiceOffering(data.response),
          message: 'Should offer choice between exploration and advice'
        }),
        (data) => ({
          passed: /advice|suggestions|ideas|help|managing/i.test(data.response),
          message: 'Should mention advice as an option'
        })
      ],
      'Choice Offering Test'
    );
  }

  // TEST CASE 3: Respect User Preferences
  async runTest3_RespectExplorePreference() {
    console.log('\n=== TEST 3: Respect "Explore More" Preference ===');
    
    return await this.sendMessage(
      "I'm just not ready for advice, I just need to vent.",
      [
        (data) => ({
          passed: this.hasBoundaryRespect(data.response),
          message: 'Should respect user preference to explore rather than get advice'
        }),
        (data) => ({
          passed: !this.hasAdviceKeywords(data.response),
          message: 'Should NOT force advice when user wants to explore'
        }),
        (data) => ({
          passed: /tell me more|share|talk about|weighing on you|here to listen/i.test(data.response),
          message: 'Should encourage continued sharing'
        })
      ],
      'Respect User Preference Test'
    );
  }

  // TEST CASE 4: Advice on Repeat Request
  async runTest4_AdviceOnRepeatRequest() {
    console.log('\n=== TEST 4: Advice on Repeat Request ===');
    
    return await this.sendMessage(
      "Okay, now can you give me some ideas to help with my anxiety?",
      [
        (data) => ({
          passed: /of course|absolutely|here are/i.test(data.response),
          message: 'Should acknowledge request positively'
        }),
        (data) => ({
          passed: this.hasAdviceKeywords(data.response),
          message: 'Should provide immediate advice on repeat request'
        }),
        (data) => ({
          passed: !data.response.includes('tell me more') && !data.response.includes('can you share'),
          message: 'Should NOT ask more exploratory questions on repeat advice request'
        })
      ],
      'Repeat Advice Request Test'
    );
  }

  // TEST CASE 5: No Question Looping
  async runTest5_NoQuestionLooping() {
    console.log('\n=== TEST 5: No Question Looping ===');
    
    // Clear conversation for fresh start
    this.conversationHistory = [];
    
    // First interaction about anxiety triggers
    await this.sendMessage(
      "My anxiety gets worse at night.",
      [
        (data) => ({
          passed: /triggers|causes|happens|worse|night|evening/i.test(data.response),
          message: 'Should ask about anxiety context'
        })
      ],
      'Initial Anxiety Context'
    );

    await this.delay_helper();

    // User provides trigger information
    await this.sendMessage(
      "It's mostly work stress.",
      [
        (data) => ({
          passed: data.response && !data.error,
          message: 'Response should be successful'
        })
      ],
      'Trigger Information Provided'
    );

    await this.delay_helper();

    // Continue conversation - should NOT re-ask about triggers
    return await this.sendMessage(
      "The stress just builds up during the day.",
      [
        (data) => ({
          passed: !data.response.includes('What triggers your anxiety') && 
                  !data.response.includes('what causes your anxiety') &&
                  !data.response.includes('what makes your anxiety worse'),
          message: 'Should NOT repeat questions about triggers already answered'
        }),
        (data) => ({
          passed: data.response.length > 50,
          message: 'Should provide substantive response building on known information'
        })
      ],
      'No Question Repetition Test'
    );
  }

  // TEST CASE 6: High Frustration Handling
  async runTest6_HighFrustrationHandling() {
    console.log('\n=== TEST 6: High Frustration Handling ===');
    
    return await this.sendMessage(
      "Stop asking the same thing! Just tell me what to do.",
      [
        (data) => ({
          passed: this.hasApology(data.response),
          message: 'Should acknowledge and apologize for frustration'
        }),
        (data) => ({
          passed: this.hasAdviceKeywords(data.response) && this.hasImmediateHelp(data.response),
          message: 'Should provide immediate concrete advice after frustration'
        }),
        (data) => ({
          passed: !this.hasQuestions(data.response),
          message: 'Should NOT ask more questions when user is frustrated'
        }),
        (data) => ({
          passed: /things you can try|right now|immediately/i.test(data.response),
          message: 'Should provide actionable steps'
        })
      ],
      'High Frustration Response Test'
    );
  }

  // TEST CASE 7: Emotion Validation
  async runTest7_EmotionValidation() {
    console.log('\n=== TEST 7: Emotion Validation ===');
    
    return await this.sendMessage(
      "I feel hopeless sometimes.",
      [
        (data) => ({
          passed: this.hasValidation(data.response),
          message: 'Should validate difficult emotions first'
        }),
        (data) => ({
          passed: this.hasChoiceOffering(data.response),
          message: 'Should offer choice between exploration and coping strategies'
        }),
        (data) => ({
          passed: !/immediately try|you should|here are steps/i.test(data.response),
          message: 'Should NOT immediately jump to advice for hopelessness'
        }),
        (data) => ({
          passed: /talk about it|ways to cope|looking for/i.test(data.response),
          message: 'Should mention both talking and coping options'
        })
      ],
      'Emotion Validation Test'
    );
  }

  // TEST CASE 8: Medical Urgency
  async runTest8_MedicalUrgency() {
    console.log('\n=== TEST 8: Medical Urgency ===');
    
    return await this.sendMessage(
      "I've had chest pain and can't sleep.",
      [
        (data) => ({
          passed: this.hasEscalation(data.response),
          message: 'Should recommend medical attention for chest pain'
        }),
        (data) => ({
          passed: /while you're waiting|in the meantime|support.*anxiety|here to support/i.test(data.response),
          message: 'Should offer emotional support while seeking medical help'
        }),
        (data) => ({
          passed: /serious|immediately|contact.*doctor|ER/i.test(data.response),
          message: 'Should emphasize urgency and specific medical action'
        })
      ],
      'Medical Urgency Handling Test'
    );
  }

  // TEST CASE 9: Fallback Support
  async runTest9_FallbackSupport() {
    console.log('\n=== TEST 9: Fallback Support ===');
    
    return await this.sendMessage(
      "Nothing is helping. Any other ideas? What else can I do?",
      [
        (data) => ({
          passed: /different approach|sometimes|try something else|exercise together|if previous suggestions/i.test(data.response),
          message: 'Should suggest different approach when previous advice not working'
        }),
        (data) => ({
          passed: /grounding|breathing|simple|together|technique/i.test(data.response),
          message: 'Should offer concrete fallback techniques'
        }),
        (data) => ({
          passed: !/same|previous|already discussed/i.test(data.response) || /different|new|alternative/i.test(data.response),
          message: 'Should NOT repeat previously ineffective advice'
        })
      ],
      'Fallback Support Test'
    );
  }

  // TEST CASE 10: Follow-Up Advice (No Repetition)
  async runTest10_FollowUpAdvice() {
    console.log('\n=== TEST 10: Follow-Up Advice (No Repetition) ===');
    
    // Clear conversation for fresh start
    this.conversationHistory = [];
    
    // First advice request
    await this.sendMessage(
      "What can I do for anxiety at night?",
      [
        (data) => ({
          passed: this.hasAdviceKeywords(data.response),
          message: 'Should provide initial advice'
        })
      ],
      'Initial Night Anxiety Advice'
    );

    await this.delay_helper();

    // Follow-up request for additional ideas
    return await this.sendMessage(
      "What else can I do for my anxiety at night?",
      [
        (data) => ({
          passed: /addition|also|another|different|alternatively|in addition to what we discussed/i.test(data.response),
          message: 'Should provide additional/different techniques'
        }),
        (data) => ({
          passed: this.hasAdviceKeywords(data.response),
          message: 'Should provide new concrete suggestions'
        }),
        (data) => ({
          passed: data.response.length > 100,
          message: 'Should provide substantial follow-up advice'
        })
      ],
      'Follow-Up Advice Test'
    );
  }

  // TEST CASE 11: User Rejects Advice
  async runTest11_UserRejectsAdvice() {
    console.log('\n=== TEST 11: User Rejects Advice ===');
    
    return await this.sendMessage(
      "That advice doesn't work for me.",
      [
        (data) => ({
          passed: /thanks for letting me know|appreciate you telling me/i.test(data.response),
          message: 'Should acknowledge rejection positively'
        }),
        (data) => ({
          passed: /talk more about what hasn't worked|explore different options|what would work better/i.test(data.response),
          message: 'Should offer alternatives without pushing advice'
        }),
        (data) => ({
          passed: !data.response.includes('try this') && !data.response.includes('you should'),
          message: 'Should NOT immediately push more advice'
        })
      ],
      'Advice Rejection Handling Test'
    );
  }

  // TEST CASE 12: Meta Conversation Request
  async runTest12_MetaConversationRequest() {
    console.log('\n=== TEST 12: Meta Conversation Request ===');
    
    return await this.sendMessage(
      "Can you just give me bullet points instead of long explanations?",
      [
        (data) => ({
          passed: /absolutely|of course|sure|yes/i.test(data.response),
          message: 'Should immediately agree to format change'
        }),
        (data) => ({
          passed: /bullet points|quick.*points|here are some/i.test(data.response),
          message: 'Should adapt to requested format immediately'
        }),
        (data) => ({
          passed: data.response.includes('•') || data.response.includes('-') || data.response.includes('1.'),
          message: 'Should actually use bullet point format'
        })
      ],
      'Meta Conversation Adaptation Test'
    );
  }

  // TEST CASE 13: Boundary Respect
  async runTest13_BoundaryRespect() {
    console.log('\n=== TEST 13: Boundary Respect ===');
    
    return await this.sendMessage(
      "I don't want to talk about my family.",
      [
        (data) => ({
          passed: this.hasBoundaryRespect(data.response),
          message: 'Should immediately respect the boundary'
        }),
        (data) => ({
          passed: /another area|different topic|most comfortable|what would you like to work on/i.test(data.response),
          message: 'Should offer alternative topics'
        }),
        (data) => ({
          passed: !data.response.includes('family') && !data.response.includes('why not'),
          message: 'Should NOT push the boundary or ask why'
        })
      ],
      'Boundary Respect Test'
    );
  }

  // Generate comprehensive test report
  generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ASKME AI MENTAL HEALTH CHAT - TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const passedTests = this.testResults.filter(r => r.success).length;
    const totalTests = this.testResults.length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    console.log(`🎯 Success Rate: ${successRate}%`);
    
    // Categorize results
    const categories = {
      'Advice Delivery': ['Direct Advice Request', 'Repeat Advice Request', 'Follow-Up Advice'],
      'Exploration & Validation': ['Exploration Response Test', 'Choice Offering Test', 'Emotion Validation'],
      'Frustration & Boundaries': ['High Frustration Response', 'Boundary Respect', 'Advice Rejection Handling'],
      'Advanced Features': ['Medical Urgency Handling', 'Fallback Support', 'Meta Conversation Adaptation'],
      'Conversation Flow': ['No Question Repetition', 'Respect User Preference']
    };
    
    console.log('\n🔍 BEHAVIORAL ANALYSIS BY CATEGORY:');
    console.log('-'.repeat(40));
    
    Object.entries(categories).forEach(([category, testNames]) => {
      const categoryTests = this.testResults.filter(r => 
        testNames.some(name => r.testName?.includes(name))
      );
      const categoryPassed = categoryTests.filter(r => r.success).length;
      const categoryTotal = categoryTests.length;
      const categoryRate = categoryTotal > 0 ? Math.round((categoryPassed / categoryTotal) * 100) : 0;
      
      const status = categoryRate >= 80 ? '✅ EXCELLENT' : 
                     categoryRate >= 60 ? '⚠️ GOOD' : '❌ NEEDS WORK';
      
      console.log(`${category}: ${categoryPassed}/${categoryTotal} (${categoryRate}%) ${status}`);
    });
    
    // Detailed failure analysis
    const failedTests = this.testResults.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS ANALYSIS:');
      console.log('-'.repeat(40));
      
      failedTests.forEach(test => {
        console.log(`\nTest: ${test.testName}`);
        console.log(`Message: "${test.message}"`);
        if (test.error) {
          console.log(`Error: ${test.error}`);
        } else {
          console.log(`Response: "${test.response?.substring(0, 100)}..."`);
          test.validations?.forEach(v => {
            if (!v.passed) {
              console.log(`  ❌ ${v.message}`);
            }
          });
        }
      });
    }
    
    // Key metrics summary
    console.log('\n📈 KEY METRICS:');
    console.log('-'.repeat(20));
    console.log('Intent Detection:', successRate >= 80 ? '✅ WORKING' : '⚠️ NEEDS IMPROVEMENT');
    console.log('Frustration Handling:', this.testResults.find(r => r.testName?.includes('Frustration'))?.success ? '✅ WORKING' : '⚠️ NEEDS IMPROVEMENT');
    console.log('Question Repetition:', this.testResults.find(r => r.testName?.includes('Repetition'))?.success ? '✅ PREVENTED' : '⚠️ STILL OCCURRING');
    console.log('Medical Escalation:', this.testResults.find(r => r.testName?.includes('Medical'))?.success ? '✅ WORKING' : '⚠️ NEEDS IMPROVEMENT');
    console.log('Boundary Respect:', this.testResults.find(r => r.testName?.includes('Boundary'))?.success ? '✅ WORKING' : '⚠️ NEEDS IMPROVEMENT');
    
    return {
      totalTests,
      passedTests,
      successRate,
      failedTests: failedTests.length,
      categories: Object.fromEntries(
        Object.entries(categories).map(([cat, tests]) => {
          const catTests = this.testResults.filter(r => tests.some(name => r.testName?.includes(name)));
          return [cat, {
            passed: catTests.filter(r => r.success).length,
            total: catTests.length,
            rate: catTests.length > 0 ? Math.round((catTests.filter(r => r.success).length / catTests.length) * 100) : 0
          }];
        })
      )
    };
  }

  // Run all tests sequentially
  async runFullTestSuite() {
    console.log('🧠 STARTING ASKME AI MENTAL HEALTH CHAT TEST SUITE');
    console.log('='.repeat(60));
    
    try {
      // Initialize with a fresh conversation
      await this.sendMessage('__INIT_CHAT__', [], 'Initialization');
      await this.delay_helper();

      // Run all test cases
      await this.runTest1_DirectAdviceRequest();
      await this.delay_helper();
      
      await this.runTest2_ExploreFirstStrategy();
      await this.delay_helper();
      
      await this.runTest3_RespectExplorePreference();
      await this.delay_helper();
      
      await this.runTest4_AdviceOnRepeatRequest();
      await this.delay_helper();
      
      await this.runTest5_NoQuestionLooping();
      await this.delay_helper();
      
      await this.runTest6_HighFrustrationHandling();
      await this.delay_helper();
      
      await this.runTest7_EmotionValidation();
      await this.delay_helper();
      
      await this.runTest8_MedicalUrgency();
      await this.delay_helper();
      
      await this.runTest9_FallbackSupport();
      await this.delay_helper();
      
      await this.runTest10_FollowUpAdvice();
      await this.delay_helper();
      
      await this.runTest11_UserRejectsAdvice();
      await this.delay_helper();
      
      await this.runTest12_MetaConversationRequest();
      await this.delay_helper();
      
      await this.runTest13_BoundaryRespect();

      // Generate final report
      return this.generateTestReport();

    } catch (error) {
      console.error('Test suite error:', error);
      return { error: error.message, completedTests: this.testResults.length };
    }
  }
}

// Export for use in other files
module.exports = { MentalHealthTestSuite };

// Allow running directly from command line
if (require.main === module) {
  const testSuite = new MentalHealthTestSuite(
    process.env.TEST_BASE_URL || 'http://localhost:3000',
    process.env.TEST_USER_EMAIL || 'rd9821@gmail.com'
  );
  
  testSuite.runFullTestSuite()
    .then(results => {
      console.log('\n🎯 Test suite completed successfully!');
      process.exit(results.successRate >= 80 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}
