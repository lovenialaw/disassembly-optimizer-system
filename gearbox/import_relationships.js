const fs = require("fs");
const neo4j = require("neo4j-driver");

// ==============================
// CONFIGURATION (EDIT ONLY HERE)
// ==============================
const NEO4J_URI = "bolt://localhost:7687";
const NEO4J_USER = "neo4j";
const NEO4J_PASSWORD = "lovie260807"; // <-- your password
const INPUT_FILE = "gearbox_metadata.json";

// ==============================
// LOAD DATA
// ==============================
let data;
try {
  data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  console.log(`📁 Loaded ${data.length} items from ${INPUT_FILE}`);
} catch (err) {
  console.error(`❌ Failed to load ${INPUT_FILE}. Make sure you're running from the gearbox directory.`);
  console.error("Error:", err.message);
  process.exit(1);
}

// ==============================
// CONNECT TO NEO4J
// ==============================
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  { encrypted: false }
);

// ==============================
// MAIN IMPORT
// ==============================
async function run() {
  const session = driver.session();

  try {
    console.log("🚀 Starting relationship import...");
    let attachedCount = 0;

    for (const item of data) {

      const component = item.name.trim();

      // ----------------------------------
      // ATTACHED_TO relationships
      // Component → Component
      // ----------------------------------
      if (item.properties.attached_to) {
        const attachedTo = item.properties.attached_to.trim();

        if (component !== attachedTo) {
          await session.run(
            `
            MATCH (a:Component {name: $component})
            MATCH (b:Component {name: $attachedTo})
            MERGE (a)-[:ATTACHED_TO]->(b)
            `,
            { component, attachedTo }
          );
          attachedCount++;
        }
      }

    }

    console.log(`✅ Relationships imported correctly`);
    console.log(`   - ATTACHED_TO: ${attachedCount} relationships`);
  } catch (err) {
    console.error("❌ Import failed:", err);
    console.error("Error details:", err.message);
    if (err.stack) {
      console.error("Stack trace:", err.stack);
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

run();
