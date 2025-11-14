import { initializePlaybookTemplates } from "./services/seedPlaybooks.js";

// Run the seeding function directly
initializePlaybookTemplates()
  .then(() => {
    console.log("Playbook templates seeded successfully!");
    process.exit(0);
  })
  .catch(error => {
    console.error("Error seeding templates:", error);
    process.exit(1);
  });