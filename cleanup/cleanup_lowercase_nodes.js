const neo4j = require("neo4j-driver");
const fs = require("fs");

// ==============================
// CONFIGURATION
// ==============================
const NEO4J_URI = "bolt://localhost:7687";
const NEO4J_USER = "neo4j";
const NEO4J_PASSWORD = "lovie260807";

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  { encrypted: false }
);

// Load correct names from JSON
const data = JSON.parse(fs.readFileSync("gearbox_metadata.json", "utf-8"));
const correctNames = new Set(data.map(item => item.name.trim()));

// Create a mapping from lowercase/underscore versions to correct names
const nameMapping = {};
for (const correctName of correctNames) {
  // Create variations that might exist in the database
  const lowerUnderscore = correctName.toLowerCase().replace(/\s+/g, '_');
  const lowerSpace = correctName.toLowerCase();
  
  nameMapping[lowerUnderscore] = correctName;
  nameMapping[lowerSpace] = correctName;
  // Also map the original in case it's already correct
  nameMapping[correctName] = correctName;
}

async function cleanupNodes() {
  const session = driver.session();

  try {
    // Get all nodes
    const result = await session.run(`
      MATCH (n:Component)
      RETURN n.name as name
    `);
    
    const nodesToDelete = [];
    const nodesToRename = [];
    
    for (const record of result.records) {
      const nodeName = record.get('name');
      const trimmedName = nodeName.trim();
      
      // Check if this is a lowercase/underscore version
      const lowerUnderscore = trimmedName.toLowerCase().replace(/\s+/g, '_');
      const lowerSpace = trimmedName.toLowerCase();
      
      // If it's already a correct name, skip
      if (correctNames.has(trimmedName)) {
        continue;
      }
      
      // Check if there's a correct version
      if (nameMapping[lowerUnderscore] || nameMapping[lowerSpace]) {
        const correctName = nameMapping[lowerUnderscore] || nameMapping[lowerSpace];
        
        // Check if correct version already exists
        const checkResult = await session.run(`
          MATCH (n:Component {name: $correctName})
          RETURN count(n) as count
        `, { correctName });
        
        const exists = checkResult.records[0].get('count') > 0;
        
        if (exists) {
          // Correct version exists, delete the old one
          nodesToDelete.push(trimmedName);
        } else {
          // Rename to correct version
          nodesToRename.push({ old: trimmedName, new: correctName });
        }
      } else {
        // No mapping found, might be an old node - delete it
        nodesToDelete.push(trimmedName);
      }
    }
    
    // Delete old/duplicate nodes
    for (const nodeName of nodesToDelete) {
      await session.run(`
        MATCH (n:Component {name: $name})
        DETACH DELETE n
      `, { name: nodeName });
      console.log(`🗑️  Deleted: ${nodeName}`);
    }
    
    // Rename nodes
    for (const { old, new: newName } of nodesToRename) {
      // First, update relationships pointing to old name
      await session.run(`
        MATCH (a)-[r:blocked_by]->(b:Component {name: $old})
        SET b.name = $new
      `, { old, new: newName });
      
      // Update the node itself
      await session.run(`
        MATCH (n:Component {name: $old})
        SET n.name = $new
      `, { old, new: newName });
      
      console.log(`✏️  Renamed: "${old}" → "${newName}"`);
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Deleted: ${nodesToDelete.length} old/duplicate nodes`);
    console.log(`   Renamed: ${nodesToRename.length} nodes to correct names`);
    
  } catch (err) {
    console.error("❌ Error cleaning up nodes:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

cleanupNodes();

