require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const { loadConfig } = require('./src/config'); // 👈 add this

(async () => {
  // Load config from Parameter Store, fallback to .env
  const config = await loadConfig();
  Object.assign(process.env, config);

  const app = express();

  // Load OpenAPI spec
  const openapiDocument = YAML.load('./openapi.yaml');

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

  // Optional debug route (safe – masks secret)
  app.get('/config', (req, res) => {
    res.json({
      AWS_REGION: process.env.AWS_REGION,
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
      COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
      COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET ? '***hidden***' : null,
      JWT_SECRET: process.env.JWT_SECRET ? '***hidden***' : null
    });
  });

  // API routes
  const authRoutes = require('./src/routes/auth');
  const videoRoutes = require('./src/routes/video');
  const jobsRoutes  = require('./src/routes/jobs');
  app.use('/auth', authRoutes);
  app.use('/video', videoRoutes);
  app.use('/jobs', jobsRoutes);

  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
