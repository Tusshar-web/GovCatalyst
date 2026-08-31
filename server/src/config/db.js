const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
require("dotenv").config();

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      };

const pool = new Pool(poolConfig);

// Handle idle client errors so a dropped connection doesn't crash your server mid-demo
pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err.message);
});

const testDbConnection = async () => {
    try {
        const client = await pool.connect();
        console.log("Database connected successfully!");
        client.release();
    } catch (error) {
        console.error("Database connection warning:", error.message);
    }
};

testDbConnection();

module.exports = pool;