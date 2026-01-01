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
    
    // Clean up ALL existing relationships to ensure database matches metadata exactly
    console.log("🧹 Cleaning up all existing relationships...");
    
    // Delete old blocked_by relationships (lowercase, from old script runs)
    const cleanupBlockedBy = await session.run(`
      MATCH ()-[r:blocked_by]->()
      DELETE r
      RETURN count(r) as deleted
    `);
    const blockedByCount = cleanupBlockedBy.records[0]?.get('deleted') || 0;
    
    // Delete all ATTACHED_TO relationships
    const cleanupAttached = await session.run(`
      MATCH ()-[r:ATTACHED_TO]->()
      DELETE r
      RETURN count(r) as deleted
    `);
    const attachedCount = cleanupAttached.records[0]?.get('deleted') || 0;
    
    // Delete all BLOCKS relationships
    const cleanupBlocks = await session.run(`
      MATCH ()-[r:BLOCKS]->()
      DELETE r
      RETURN count(r) as deleted
    `);
    const blocksCount = cleanupBlocks.records[0]?.get('deleted') || 0;
    
    const totalDeleted = blockedByCount + attachedCount + blocksCount;
    if (totalDeleted > 0) {
      console.log(`   Removed ${totalDeleted} existing relationships:`);
      if (blockedByCount > 0) console.log(`     - blocked_by: ${blockedByCount}`);
      if (attachedCount > 0) console.log(`     - ATTACHED_TO: ${attachedCount}`);
      if (blocksCount > 0) console.log(`     - BLOCKS: ${blocksCount}`);
    }

    let attachedCount = 0;
    let blocksCount = 0;

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

      // ----------------------------------
      // blocked_by relationships
      // (Blocker) → (Component) as BLOCKS
      // ----------------------------------
      for (const rawBlocker of item.properties.blocked_by || []) {
        const blocker = rawBlocker.trim();

        // 🚨 HARD STOP: No self-loops
        if (component === blocker) {
          console.warn(`⛔ Self-loop skipped: ${item.name}`);
          continue;
        }

        await session.run(
          `
          MATCH (blocked:Component {name: $blocked})
          MATCH (blocker:Component {name: $blocker})
          MERGE (blocker)-[:BLOCKS]->(blocked)
          `,
          { blocked: component, blocker }
        );
        blocksCount++;
      }
    }

    console.log(`✅ Relationships imported correctly`);
    console.log(`   - ATTACHED_TO: ${attachedCount} relationships`);
    console.log(`   - BLOCKS: ${blocksCount} relationships`);
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
