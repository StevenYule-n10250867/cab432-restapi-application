require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();

// Load OpenAPI spec
const openapiDocument = YAML.load('./openapi.yaml');

// Route modules
const authRoutes = require('./src/routes/auth');
const videoRoutes = require('./src/routes/video');
const jobsRoutes  = require('./src/routes/jobs');

// Middleware
app.use(cors());
app.use(express.json());

// Static file serving
app.use('/uploads', express.static('uploads'));
app.use('/transcoded', express.static('src/transcoded'));

// API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/auth', authRoutes);
app.use('/video', videoRoutes);
app.use('/jobs', jobsRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
