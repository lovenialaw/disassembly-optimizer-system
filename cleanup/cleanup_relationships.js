const neo4j = require("neo4j-driver");

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

async function cleanupRelationships() {
    const session = driver.session();

    try {
        // Delete all BLOCKED_BY (uppercase) relationships
        const result = await session.run(`
      MATCH ()-[r:BLOCKED_BY]->()
      DELETE r
      RETURN count(r) as deleted
    `);

        const deletedCount = result.records[0].get('deleted');
        console.log(`✅ Deleted ${deletedCount} BLOCKED_BY (uppercase) relationships.`);
        console.log(`✅ All relationships now use 'blocked_by' (lowercase) only.`);
    } catch (err) {
        console.error("❌ Error cleaning up relationships:", err);
    } finally {
        await session.close();
        await driver.close();
    }
}

cleanupRelationships();

