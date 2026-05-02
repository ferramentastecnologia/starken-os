/**
 * Starken OS — Express Server para VPS
 * Multiplexador de 12 funções serverless Vercel → Node.js/Express
 *
 * Uso: node server.js (ou npm start)
 * Acesso: http://localhost:3000
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// ==================== MIDDLEWARE ====================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Log de requisições
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// CORS (já que frontend é em outro domínio/porta durante dev)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==================== API ROUTES ====================
// IMPORTANTE: Definir rotas de API ANTES do middleware de static files

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ========== CONTENT MANAGEMENT (1/12) ==========
app.post('/api/content', async (req, res) => {
  try {
    const handler = require('./api/content.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/content' });
    }
  } catch (err) {
    console.error('[/api/content]', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== META APIS (8/12) ==========

// Meta: Config
app.post('/api/meta/config', async (req, res) => {
  try {
    const handler = require('./api/meta/config.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/config' });
    }
  } catch (err) {
    console.error('[/api/meta/config]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/meta/config', async (req, res) => {
  try {
    const handler = require('./api/meta/config.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/config' });
    }
  } catch (err) {
    console.error('[/api/meta/config]', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta: Publish
app.post('/api/meta/publish', async (req, res) => {
  try {
    const handler = require('./api/meta/publish.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/publish' });
    }
  } catch (err) {
    console.error('[/api/meta/publish]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/meta/publish', async (req, res) => {
  try {
    const handler = require('./api/meta/publish.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/publish' });
    }
  } catch (err) {
    console.error('[/api/meta/publish]', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta: Media (upload)
app.post('/api/meta/media', async (req, res) => {
  try {
    const handler = require('./api/meta/media.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/media' });
    }
  } catch (err) {
    console.error('[/api/meta/media]', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta: Discover
app.post('/api/meta/discover', async (req, res) => {
  try {
    const handler = require('./api/meta/discover.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/discover' });
    }
  } catch (err) {
    console.error('[/api/meta/discover]', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta: Balance
app.get('/api/meta/balance', async (req, res) => {
  try {
    const handler = require('./api/meta/balance.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/balance' });
    }
  } catch (err) {
    console.error('[/api/meta/balance]', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta: Insights
app.get('/api/meta/insights', async (req, res) => {
  try {
    const handler = require('./api/meta/insights.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/insights' });
    }
  } catch (err) {
    console.error('[/api/meta/insights]', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta: Campaigns
app.get('/api/meta/campaigns', async (req, res) => {
  try {
    const handler = require('./api/meta/campaigns.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/campaigns' });
    }
  } catch (err) {
    console.error('[/api/meta/campaigns]', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta: Traffic
app.post('/api/meta/traffic', async (req, res) => {
  try {
    const handler = require('./api/meta/traffic.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/meta/traffic' });
    }
  } catch (err) {
    console.error('[/api/meta/traffic]', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== ASANA APIS (2/12) ==========

// Asana: Config
app.post('/api/asana/config', async (req, res) => {
  try {
    const handler = require('./api/asana/config.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/asana/config' });
    }
  } catch (err) {
    console.error('[/api/asana/config]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/asana/config', async (req, res) => {
  try {
    const handler = require('./api/asana/config.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/asana/config' });
    }
  } catch (err) {
    console.error('[/api/asana/config]', err);
    res.status(500).json({ error: err.message });
  }
});

// Asana: Tasks
app.post('/api/asana/tasks', async (req, res) => {
  try {
    const handler = require('./api/asana/tasks.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/asana/tasks' });
    }
  } catch (err) {
    console.error('[/api/asana/tasks]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/asana/tasks', async (req, res) => {
  try {
    const handler = require('./api/asana/tasks.js').default;
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'Handler inválido em /api/asana/tasks' });
    }
  } catch (err) {
    console.error('[/api/asana/tasks]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== STATIC FILES ====================

// Servir frontend estático (HTML/CSS/JS)
app.use(express.static(path.join(__dirname)));

// SPA fallback: qualquer rota não-API retorna index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'checklist-relatorios.html'));
});

// ==================== 404 ====================

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    path: req.path,
    method: req.method,
  });
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  🚀 Starken OS — Express Server Started   ║
╠════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(35)}║
║  Env:  ${NODE_ENV.padEnd(35)}║
║  Time: ${new Date().toISOString().padEnd(30)}║
╚════════════════════════════════════════════╝
  `);
  console.log(`   → Frontend: http://localhost:${PORT}`);
  console.log(`   → API: http://localhost:${PORT}/api/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SIGTERM] Desligando servidor gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n[SIGINT] Desligando servidor gracefully...');
  process.exit(0);
});
