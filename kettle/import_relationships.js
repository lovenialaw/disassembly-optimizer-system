const fs = require("fs");
const neo4j = require("neo4j-driver");

// =====================================
// CONFIGURATION
// =====================================

const NEO4J_URI = "bolt://localhost:7687";
const NEO4J_USER = "neo4j";
const NEO4J_PASSWORD = "lovie260807";

const INPUT_FILE = "kettle_metadata.json";

// =====================================
// LOAD DATA
// =====================================

const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));

// =====================================
// NEO4J CONNECTION
// =====================================

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

const session = driver.session();

// =====================================
// HELPERS
// =====================================

function normalizeBlockedBy(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;
  return [value];
}

// =====================================
// IMPORT RELATIONSHIPS
// =====================================

async function importRelationships() {
  try {
    console.log("🚀 Creating relationships (Component / Fastener / Tool)...");

    for (const item of data) {
      const componentName = item.name;
      const p = item.properties;

      // -----------------------------
      // ATTACHED_TO
      // Component → Component
      // -----------------------------
      if (p.attached_to) {
        await session.run(
          `
          MATCH (a:Component {name: $from})
          MATCH (b:Component {name: $to})
          MERGE (a)-[:ATTACHED_TO]->(b)
          `,
          { from: componentName, to: p.attached_to }
        );
      }

      // -----------------------------
      // BLOCKED_BY
      // (Blocker) → (Component)
      // -----------------------------
      const blockers = normalizeBlockedBy(p.blocked_by);

      for (const blocker of blockers) {
        await session.run(
          `
          MATCH (blocked:Component {name: $blocked})
          MATCH (blocker:Component {name: $blocker})
          MERGE (blocker)-[:BLOCKS]->(blocked)
          `,
          {
            blocked: componentName,
            blocker
          }
        );
      }

      // -----------------------------
      // FASTENER
      // Component → Fastener
      // -----------------------------
      if (p.fastener) {
        await session.run(
          `
          MERGE (f:Fastener {name: $fastener})
          WITH f
          MATCH (c:Component {name: $component})
          MERGE (c)-[:FASTENED_BY]->(f)
          `,
          { component: componentName, fastener: p.fastener }
        );

        // -----------------------------
        // TOOL
        // Fastener → Tool
        // -----------------------------
        if (p.disassembly_tool) {
          await session.run(
            `
            MATCH (f:Fastener {name: $fastener})
            MERGE (t:Tool {name: $tool})
            MERGE (f)-[:DISASSEMBLED_WITH]->(t)
            `,
            { fastener: p.fastener, tool: p.disassembly_tool }
          );
        }
      }
    }

    console.log("✅ Relationships created successfully");

  } catch (err) {
    console.error("❌ Relationship import failed:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

importRelationships();
