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
const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));

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
    for (const item of data) {

      const component = item.name.trim();

      // ----------------------------------
      // blocked_by relationships
      // ----------------------------------
      for (const rawBlocker of item.properties.blocked_by || []) {

        const blocker = rawBlocker.trim();

        // 🚨 HARD STOP: No.self-loops
        if (component === blocker) {
          console.warn(`⛔ Self-loop skipped: ${item.name}`);
          continue;
        }

        await session.run(
          `
          MERGE (a:Component {name: $component})
          MERGE (b:Component {name: $blocker})
          MERGE (a)-[:blocked_by]->(b)
          `,
          { component, blocker }
        );
      }

      // ----------------------------------
      //  attached_to → blocked_by
      // ----------------------------------
      if (item.properties.attached_to) {

        const attachedTo = item.properties.attached_to.trim();

        if (component !== attachedTo) {
          await session.run(
            `
            MERGE (a:Component {name: $component})
            MERGE (b:Component {name: $attachedTo})
            MERGE (a)-[:blocked_by]->(b)
            `,
            { component, attachedTo }
          );
        }
      }
    }

    console.log("✅ Relationships imported correctly");
  } catch (err) {
    console.error("❌ Import failed:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

run();
