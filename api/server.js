/**
 * Assessoria API — Express server
 *
 * Wraps the Vercel-style serverless handlers (module.exports = handler(req, res))
 * so they can run inside a Docker container on port 3000.
 *
 * Route mapping mirrors the file-system layout under api/:
 *   api/asana/config.js   -> GET|POST /api/asana/config
 *   api/asana/projects.js -> *        /api/asana/projects
 *   api/asana/provision.js-> *        /api/asana/provision
 *   api/asana/sections.js -> *        /api/asana/sections
 *   api/asana/tasks.js    -> *        /api/asana/tasks
 *   api/trello/export.js  -> *        /api/trello/export
 *   api/trello/migrate.js -> *        /api/trello/migrate
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Health check (used by Docker HEALTHCHECK and load balancers)
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'assessoria-api', uptime: process.uptime() });
});

// ---------------------------------------------------------------------------
// Auto-register Vercel-style handlers
// ---------------------------------------------------------------------------
const handlers = [
  { route: '/api/asana/config',    file: './asana/config' },
  { route: '/api/asana/projects',  file: './asana/projects' },
  { route: '/api/asana/provision', file: './asana/provision' },
  { route: '/api/asana/sections',  file: './asana/sections' },
  { route: '/api/asana/tasks',     file: './asana/tasks' },
  { route: '/api/trello/export',   file: './trello/export' },
  { route: '/api/trello/migrate',  file: './trello/migrate' },
];

for (const { route, file } of handlers) {
  const handler = require(file);
  app.all(route, (req, res) => handler(req, res));
}

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Assessoria API listening on port ${PORT}`);
});
