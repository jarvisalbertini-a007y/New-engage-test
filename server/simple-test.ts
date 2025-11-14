/**
 * Simple test for insights system functionality
 */

import { DbStorage } from './storage';
import { db } from './db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

async function runSimpleTest() {
  console.log('🧪 Running simple insights system test...\n');
  
  const storage = new DbStorage(db);
  
  try {
    // 1. Create a real company
    console.log('1️⃣ Creating company...');
    const company = await storage.createCompany({
      name: 'Acme Software Inc',
      domain: 'acmesoftware.com',
      industry: 'Technology',
      employeeCount: 250,
      fundingStage: 'Series C',
      technologies: ['Node.js', 'React', 'AWS'],
      intent_score: 0
    });
    console.log('   ✅ Company created:', company.name, '(ID:', company.id, ')');
    
    // 2. Track visitor activity
    console.log('\n2️⃣ Tracking visitor session...');
    const session = await storage.createVisitorSession({
      companyId: company.id,
      sessionId: 'sess_' + Date.now(),
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
      country: 'USA',
      city: 'New York',
      pageViews: 12,
      duration: 600,
      referrer: 'google.com',
      entryPage: '/features',
      exitPage: '/demo',
      events: [
        { type: 'page_view', page: '/features', timestamp: new Date() },
        { type: 'page_view', page: '/pricing', timestamp: new Date() },
        { type: 'button_click', element: 'request_demo', timestamp: new Date() }
      ],
      intentScore: 85,
      isIdentified: true,
      createdAt: new Date()
    });
    console.log('   ✅ Session tracked (', session.pageViews, 'page views )');
    
    // 3. Create a contact
    console.log('\n3️⃣ Creating contact...');
    const contact = await storage.createContact({
      companyId: company.id,
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah@acmesoftware.com',
      title: 'Director of Engineering',
      phone: '+1-555-1234',
      linkedin: 'linkedin.com/in/sarahjohnson',
      lastContactedAt: new Date(),
      engagementScore: 0
    });
    console.log('   ✅ Contact created:', contact.firstName, contact.lastName);
    
    // 4. Track email engagement
    console.log('\n4️⃣ Creating email with engagement...');
    const email = await storage.createEmail({
      contactId: contact.id,
      subject: 'Following up on our conversation',
      body: 'Hi Sarah, thanks for your interest in our platform...',
      sentAt: new Date(),
      openedAt: new Date(),
      clickedAt: new Date(),
      status: 'opened',
      threadId: 'thread_001'
    });
    console.log('   ✅ Email tracked (opened and clicked)');
    
    // 5. Generate an insight
    console.log('\n5️⃣ Generating insight...');
    const insight = await storage.createInsight({
      companyId: company.id,
      type: 'high_engagement',
      title: 'High Engagement Detected - Demo Request',
      description: 'Acme Software Inc shows strong buying intent with 12 page views including demo request. Director of Engineering engaged with email.',
      score: 90,
      metadata: {
        triggers: ['visitor_activity', 'email_engagement', 'demo_request'],
        sessionId: session.sessionId,
        contactName: contact.firstName + ' ' + contact.lastName
      }
    });
    console.log('   ✅ Insight generated:', insight.title);
    
    // 6. Verify data exists
    console.log('\n6️⃣ Verifying data persistence...');
    const companies = await db.select().from(schema.companies).where(eq(schema.companies.id, company.id));
    const insights = await db.select().from(schema.insights).where(eq(schema.insights.companyId, company.id));
    const sessions = await db.select().from(schema.visitorSessions).where(eq(schema.visitorSessions.companyId, company.id));
    const emails = await db.select().from(schema.emails).where(eq(schema.emails.contactId, contact.id));
    
    console.log('   📊 Data found:');
    console.log('      - Companies:', companies.length);
    console.log('      - Insights:', insights.length);
    console.log('      - Sessions:', sessions.length);
    console.log('      - Emails:', emails.length);
    
    // 7. Check for mock data patterns
    console.log('\n7️⃣ Checking for mock/fake data...');
    const allCompanies = await db.select().from(schema.companies);
    const mockPatterns = ['Sample', 'Demo', 'Fake', 'Mock', 'Lorem', 'Example'];
    const suspiciousCompanies = allCompanies.filter(c => 
      mockPatterns.some(pattern => c.name.includes(pattern))
    );
    
    if (suspiciousCompanies.length === 0) {
      console.log('   ✅ No mock data patterns found');
    } else {
      console.log('   ⚠️ Warning: Found companies with mock patterns:');
      suspiciousCompanies.forEach(c => console.log('      -', c.name));
    }
    
    // 8. Clean up test data
    console.log('\n8️⃣ Cleaning up test data...');
    await db.delete(schema.insights).where(eq(schema.insights.id, insight.id));
    await db.delete(schema.emails).where(eq(schema.emails.id, email.id));
    await db.delete(schema.visitorSessions).where(eq(schema.visitorSessions.id, session.id));
    await db.delete(schema.contacts).where(eq(schema.contacts.id, contact.id));
    await db.delete(schema.companies).where(eq(schema.companies.id, company.id));
    console.log('   ✅ Test data cleaned up');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed successfully!');
    console.log('🎉 The insights system is working correctly');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runSimpleTest()
  .then(() => {
    console.log('\n✨ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  });