const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from the web dist directory
app.use(express.static(path.join('packages', 'web', 'dist')));

// API health check endpoint - must be defined BEFORE the catch-all
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// API routes prefix
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join('packages', 'web', 'dist', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
  console.log('API health at http://localhost:' + PORT + '/api/health');
  console.log('Frontend at http://localhost:' + PORT);
});

module.exports = server;