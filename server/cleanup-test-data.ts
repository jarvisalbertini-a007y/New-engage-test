import { db } from "./db";
import { companies, contacts, emails, sequences, aiAgents, personas, campaigns, tasks, insights, visitorSessions } from "@shared/schema";

async function cleanupTestData() {
  console.log("🧹 Starting database cleanup...");
  
  try {
    // Import all tables we need to clean
    const { phoneCalls, callScripts, voicemails } = await import("@shared/schema");
    
    // Delete in order of dependencies (child tables first, then parent tables)
    
    // First delete phone-related data (voicemails before phone calls due to FK constraint)
    console.log("Removing test voicemails...");
    await db.delete(voicemails);
    
    console.log("Removing test phone calls...");
    await db.delete(phoneCalls);
    
    console.log("Removing test call scripts...");
    await db.delete(callScripts);
    
    // Then delete email and task data
    console.log("Removing test emails...");
    await db.delete(emails);
    
    console.log("Removing test tasks...");
    await db.delete(tasks);
    
    // Delete insights before companies/contacts
    console.log("Removing test insights...");
    await db.delete(insights);
    
    // Delete visitor sessions before companies (they reference companies)
    console.log("Removing test visitor sessions...");
    await db.delete(visitorSessions);
    
    // Delete contacts before companies (contacts reference companies)
    console.log("Removing test contacts...");
    await db.delete(contacts);
    
    // Delete companies
    console.log("Removing test companies...");
    await db.delete(companies);
    
    // Delete sequences, agents, personas, campaigns (no dependencies)
    console.log("Removing test sequences...");
    await db.delete(sequences);
    
    console.log("Removing test AI agents...");
    await db.delete(aiAgents);
    
    console.log("Removing test personas...");
    await db.delete(personas);
    
    console.log("Removing test campaigns...");
    await db.delete(campaigns);
    
    console.log("✅ Database cleanup complete! All test data has been removed.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }
}

// Run cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupTestData();
}