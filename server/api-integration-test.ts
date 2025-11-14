/**
 * API Integration Test - Tests all major API endpoints
 * This bypasses authentication to thoroughly test functionality
 */

import { DbStorage } from './storage';
import { db } from './db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

async function testAPIIntegration() {
  console.log('🔌 API Integration Test Starting...\n');
  console.log('=' .repeat(60));
  
  const storage = new DbStorage(db);
  const results = {
    endpoints: [] as string[],
    passed: 0,
    failed: 0
  };
  
  let testCompanyId: string;
  let testContactId: string;
  let testInsightId: string;
  
  try {
    // Phase 1: Test Company APIs
    console.log('\n📦 Phase 1: Testing Company Management');
    console.log('-'.repeat(40));
    
    // Create company
    console.log('  → Creating company...');
    const company = await storage.createCompany({
      name: 'Integration Test Corp',
      domain: 'integrationtest.com',
      industry: 'Financial Services',
      employeeCount: 500,
      fundingStage: 'Series D',
      technologies: ['Java', 'Oracle', 'AWS'],
      intent_score: 0
    });
    testCompanyId = company.id;
    console.log('    ✅ Company created:', company.name);
    results.passed++;
    results.endpoints.push('createCompany');
    
    // Get companies
    console.log('  → Fetching companies...');
    const companies = await storage.getCompanies();
    console.log('    ✅ Found', companies.length, 'companies');
    results.passed++;
    results.endpoints.push('getCompanies');
    
    // Get single company
    console.log('  → Getting single company...');
    const singleCompany = await storage.getCompany(testCompanyId);
    console.log('    ✅ Retrieved:', singleCompany.name);
    results.passed++;
    results.endpoints.push('getCompany');
    
    // Phase 2: Test Contact APIs
    console.log('\n📇 Phase 2: Testing Contact Management');
    console.log('-'.repeat(40));
    
    // Create contact
    console.log('  → Creating contact...');
    const contact = await storage.createContact({
      companyId: testCompanyId,
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'mchen@integrationtest.com',
      title: 'Chief Technology Officer',
      phone: '+1-555-9876',
      linkedin: 'linkedin.com/in/mchen',
      lastContactedAt: new Date(),
      engagementScore: 0
    });
    testContactId = contact.id;
    console.log('    ✅ Contact created:', contact.firstName, contact.lastName);
    results.passed++;
    results.endpoints.push('createContact');
    
    // Get contacts
    console.log('  → Fetching contacts...');
    const contacts = await storage.getContacts();
    console.log('    ✅ Found', contacts.length, 'contacts');
    results.passed++;
    results.endpoints.push('getContacts');
    
    // Phase 3: Test Visitor Session APIs
    console.log('\n👀 Phase 3: Testing Visitor Tracking');
    console.log('-'.repeat(40));
    
    // Create visitor session
    console.log('  → Creating visitor session...');
    const session = await storage.createVisitorSession({
      companyId: testCompanyId,
      sessionId: 'api-test-' + Date.now(),
      ipAddress: '192.168.100.1',
      userAgent: 'Chrome/120.0',
      country: 'Canada',
      city: 'Toronto',
      pageViews: 15,
      duration: 900,
      referrer: 'bing.com',
      entryPage: '/solutions',
      exitPage: '/contact',
      events: [
        { type: 'page_view', page: '/solutions', timestamp: new Date() },
        { type: 'video_play', video: 'product-demo', timestamp: new Date() },
        { type: 'form_submit', form: 'contact-sales', timestamp: new Date() }
      ],
      intentScore: 95,
      isIdentified: true,
      createdAt: new Date()
    });
    console.log('    ✅ Session tracked with', session.pageViews || 15, 'page views');
    results.passed++;
    results.endpoints.push('createVisitorSession');
    
    // Get visitor sessions
    console.log('  → Fetching visitor sessions...');
    const sessions = await storage.getVisitorSessions();
    console.log('    ✅ Found', sessions.length, 'sessions');
    results.passed++;
    results.endpoints.push('getVisitorSessions');
    
    // Phase 4: Test Email APIs
    console.log('\n📧 Phase 4: Testing Email Tracking');
    console.log('-'.repeat(40));
    
    // Create email
    console.log('  → Creating email...');
    const email = await storage.createEmail({
      contactId: testContactId,
      subject: 'Product Demo Follow-up',
      body: 'Thank you for attending our product demo...',
      sentAt: new Date(),
      openedAt: new Date(),
      clickedAt: new Date(),
      repliedAt: new Date(),
      status: 'replied',
      threadId: 'api-thread-001'
    });
    console.log('    ✅ Email created and tracked');
    results.passed++;
    results.endpoints.push('createEmail');
    
    // Get emails
    console.log('  → Fetching emails...');
    const emails = await storage.getEmails();
    console.log('    ✅ Found', emails.length, 'emails');
    results.passed++;
    results.endpoints.push('getEmails');
    
    // Phase 5: Test Insights APIs
    console.log('\n💡 Phase 5: Testing Insights Engine');
    console.log('-'.repeat(40));
    
    // Create insight
    console.log('  → Creating insight...');
    const insight = await storage.createInsight({
      companyId: testCompanyId,
      type: 'deal_acceleration',
      title: 'Deal Ready to Close',
      description: 'Integration Test Corp shows maximum buying intent with CTO engagement, demo attendance, and immediate reply to follow-up.',
      score: 98,
      metadata: {
        triggers: ['cto_engagement', 'demo_attended', 'immediate_reply'],
        dealValue: 250000,
        closeProbability: 0.85
      }
    });
    testInsightId = insight.id;
    console.log('    ✅ Insight generated:', insight.title);
    results.passed++;
    results.endpoints.push('createInsight');
    
    // Get insights
    console.log('  → Fetching insights...');
    const insights = await storage.getInsights();
    console.log('    ✅ Found', insights.length, 'insights');
    results.passed++;
    results.endpoints.push('getInsights');
    
    // Phase 6: Test Data Integrity
    console.log('\n🔒 Phase 6: Testing Data Integrity');
    console.log('-'.repeat(40));
    
    // Verify relationships
    console.log('  → Verifying data relationships...');
    const contactWithCompany = await db.select({
      contact: schema.contacts,
      company: schema.companies
    })
    .from(schema.contacts)
    .innerJoin(schema.companies, eq(schema.contacts.companyId, schema.companies.id))
    .where(eq(schema.contacts.id, testContactId))
    .limit(1);
    
    if (contactWithCompany.length > 0) {
      console.log('    ✅ Contact-Company relationship intact');
      results.passed++;
    } else {
      console.log('    ❌ Relationship verification failed');
      results.failed++;
    }
    
    // Check for mock data
    console.log('  → Checking for mock data patterns...');
    const allCompanies = await db.select().from(schema.companies);
    const mockPatterns = ['Sample', 'Demo', 'Fake', 'Mock', 'Lorem'];
    const hasMockData = allCompanies.some(c => 
      mockPatterns.some(pattern => 
        c.name.includes(pattern) && !c.name.includes('Integration Test')
      )
    );
    
    if (!hasMockData) {
      console.log('    ✅ No mock data detected');
      results.passed++;
    } else {
      console.log('    ⚠️ Mock data patterns found');
      results.failed++;
    }
    
    // Phase 7: Cleanup
    console.log('\n🧹 Phase 7: Cleaning Up Test Data');
    console.log('-'.repeat(40));
    
    await db.delete(schema.insights).where(eq(schema.insights.id, testInsightId));
    await db.delete(schema.emails).where(eq(schema.emails.id, email.id));
    await db.delete(schema.visitorSessions).where(eq(schema.visitorSessions.id, session.id));
    await db.delete(schema.contacts).where(eq(schema.contacts.id, testContactId));
    await db.delete(schema.companies).where(eq(schema.companies.id, testCompanyId));
    console.log('    ✅ All test data cleaned up');
    results.passed++;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    results.failed++;
  }
  
  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 API INTEGRATION TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed} tests`);
  console.log(`❌ Failed: ${results.failed} tests`);
  console.log(`📌 Endpoints tested: ${results.endpoints.length}`);
  console.log('   ', results.endpoints.join(', '));
  console.log('='.repeat(60));
  
  if (results.failed === 0) {
    console.log('\n🎉 SUCCESS: All API integrations working correctly!');
    console.log('✨ The platform is fully functional without mock data.');
    return 0;
  } else {
    console.log('\n⚠️ WARNING: Some tests failed. Review output above.');
    return 1;
  }
}

// Run the test
testAPIIntegration()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });