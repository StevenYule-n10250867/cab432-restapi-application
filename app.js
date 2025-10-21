// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const { loadConfig } = require('./src/config');
const { authMiddleware, requireGroup } = require('./src/middleware/authmiddleware');

(async () => {
  const config = await loadConfig();
  Object.assign(process.env, config);

  const app = express();
  const openapiDocument = YAML.load('./openapi.yaml');

  app.use(cors());
  app.use(express.json());

  app.use('/uploads', express.static('uploads'));
  app.use('/transcoded', express.static('src/transcoded'));

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Optional debug route (mask secret)
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
  app.use('/test', jobsRoutes);

  //  admin-only demo route
  app.get('/admin/dashboard', authMiddleware, requireGroup('admin'), (req, res) => {
    res.json({
      message: `Welcome, admin ${req.user['cognito:username']}`,
      groups: req.user['cognito:groups'] || []
    });
  });

app.get('/', (req, res) => {
  res.send('Welcome to the CAB432 API. Use /health to check server status.');
});

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
