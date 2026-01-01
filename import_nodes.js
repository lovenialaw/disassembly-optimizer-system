const fs = require("fs");
const neo4j = require("neo4j-driver");

// 🔐 CHANGE THESE ONLY
const NEO4J_URI = "bolt://localhost:7687";
const NEO4J_USER = "neo4j";
const NEO4J_PASSWORD = "lovie260807"; 

// Load JSON
const data = JSON.parse(fs.readFileSync("gearbox_metadata.json", "utf-8"));

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  { encrypted: false }
);

async function run() {
  const session = driver.session();

  try {
    for (const item of data) {
      await session.run(
        `
        MERGE (c:Component {name: $name})
        Set c += $props
        `,
        {
          name: item.name,
          props: item.properties
        }
      );
    }
    console.log("✅ Nodes imported");
  } finally {
    await session.close();
    await driver.close();
  }
}

run();
