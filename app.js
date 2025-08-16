require('dotenv').config();
const express = require('express');
const cors = require('cors');

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const openapiDocument = YAML.load('./openapi.yaml');

const authRoutes = require('./src/routes/auth');
const videoRoutes = require('./src/routes/video');
const jobsRoutes  = require('./src/routes/jobs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/transcoded', express.static('src/transcoded'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/auth', authRoutes);
app.use('/video', videoRoutes);
app.use('/jobs', jobsRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
