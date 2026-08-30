const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config(); // fallback
const express = require("express");
const cors = require("cors");
require("./config/db");

const app = express();
const port = process.env.PORT || 5009;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets & uploads
app.use('/docs', express.static(path.join(__dirname, '../../docs')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../../docs')));

// Health check endpoint
app.get(["/api/health", "/api/v1/health"], (req, res) => {
    res.json({ success: true, status: "HEALTHY", message: "GovCatalyst API is running" });
});

// Basic Route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '../../docs/index.html'));
});

//api-routes
const authRoutes = require('./routes/authRoutes');
app.use(['/api/auth', '/api/v1/auth'], authRoutes);
const challengeRoutes = require('./routes/challengeRoutes');
app.use(['/api/challenges', '/api/v1/challenges'], challengeRoutes);
const applicationRoutes = require('./routes/applicationRoutes');
app.use(['/api/applications', '/api/v1/applications'], applicationRoutes);
const userRoutes = require('./routes/userRoutes');
app.use(['/api/users', '/api/v1/users'], userRoutes);
const startupRoutes = require('./routes/startupRoutes');
app.use(['/api/startups', '/api/v1/startups'], startupRoutes);
const pilotRoutes = require('./routes/pilot.routes');
app.use(['/api/pilots', '/api/v1/pilots'], pilotRoutes);
const evaluationRoutes = require('./routes/evaluationRoutes');
app.use(['/api/evaluations', '/api/v1/evaluations'], evaluationRoutes);
const validationRoutes = require('./routes/validationRoutes');
app.use(['/api/validations', '/api/v1/validations'], validationRoutes);
const uploadRoutes = require('./routes/uploadRoutes');
app.use(['/api/upload', '/api/v1/upload'], uploadRoutes);

const runAutoMigration = require('./config/autoMigrate');

// Start the server if started directly
if (require.main === module) {
    app.listen(port, async () => {
        console.log(`Server is running on http://localhost:${port}`);
        try {
            await runAutoMigration();
        } catch (err) {
            console.error('Auto-migration error:', err.message);
        }
    });
}

module.exports = app;
