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
  if (value == null) return null;

  // [] → null (recommended)
  if (Array.isArray(value) && value.length === 0) {
    return null;
  }

  // [[]] → []
  if (Array.isArray(value) && Array.isArray(value[0])) {
    const flat = value.flat();
    return flat.length > 0 ? flat : null;
  }

  // single string → [string]
  if (typeof value === "string") {
    return [value];
  }

  return value;
}

// =====================================
// IMPORT SCRIPT
// =====================================

async function importNodes() {
  try {
    console.log("🚀 Starting Neo4j node import...");

    // 1️⃣ Clear database
    await session.run("MATCH (n) DETACH DELETE n");
    console.log("🧹 Database cleared");

    // 2️⃣ Create Component nodes
    for (const item of data) {

      // 🔧 CLONE & CLEAN PROPERTIES
      const props = { ...item.properties };

      props.blocked_by = normalizeBlockedBy(props.blocked_by);

      await session.run(
        `
        MERGE (c:Component {name: $name})
        SET c += $props
        `,
        {
          name: item.name,
          props
        }
      );
    }

    console.log(`✅ Imported ${data.length} Component nodes`);

  } catch (err) {
    console.error("❌ Import failed:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

importNodes();
