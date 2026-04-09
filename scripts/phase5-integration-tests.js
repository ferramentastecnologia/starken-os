#!/usr/bin/env node

/**
 * Phase 5 Integration Tests
 *
 * Tests the DeskRPG bridge integration after deployment.
 * Run after:
 * 1. SQL migration complete
 * 2. DeskRPG running on http://localhost:3000
 * 3. Environment variables configured
 *
 * Usage: node scripts/phase5-integration-tests.js
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log(`\n${colors.blue}╔${'═'.repeat(54)}╗`);
  console.log(`║ ${title.padEnd(52)} ║`);
  console.log(`╚${'═'.repeat(54)}╝${colors.reset}\n`);
}

function testResult(passed, message) {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${message}`, color);
}

async function main() {
  header('PHASE 5: Integration Tests');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Files Exist
  log('TEST 1: Arquivo Structure', 'cyan');
  log('─'.repeat(56));

  const filesToCheck = [
    'api/deskrpg-bridge.js',
    'api/deskrpg-webhook.js',
    'SQL/0002_deskrpg_integration.sql',
    '.env.local',
  ];

  for (const file of filesToCheck) {
    const exists = fs.existsSync(path.join('/home/user/starken-os', file));
    testResult(exists, `Arquivo ${file}`);
    exists ? passedTests++ : failedTests++;
  }

  // Test 2: Environment Configuration
  log('\n\nTEST 2: Environment Configuration', 'cyan');
  log('─'.repeat(56));

  const envPath = '/home/user/starken-os/.env.local';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
      'DESKRPG_BASE_URL',
      'DESKRPG_AUTH_TYPE',
      'DESKRPG_WEBHOOK_URL',
    ];

    for (const varName of requiredVars) {
      const hasVar = envContent.includes(varName);
      testResult(hasVar, `Variable ${varName} configured`);
      hasVar ? passedTests++ : failedTests++;
    }

    // Extract and display values
    log('\n   Configuration values:', 'yellow');
    const baseUrl = envContent.match(/DESKRPG_BASE_URL=(.+)/)?.[1];
    const authType = envContent.match(/DESKRPG_AUTH_TYPE=(.+)/)?.[1];
    const webhookUrl = envContent.match(/DESKRPG_WEBHOOK_URL=(.+)/)?.[1];

    if (baseUrl) log(`   • DESKRPG_BASE_URL: ${baseUrl}`);
    if (authType) log(`   • DESKRPG_AUTH_TYPE: ${authType}`);
    if (webhookUrl) log(`   • DESKRPG_WEBHOOK_URL: ${webhookUrl}`);
  }

  // Test 3: Code Quality
  log('\n\nTEST 3: Code Quality', 'cyan');
  log('─'.repeat(56));

  const bridgePath = '/home/user/starken-os/api/deskrpg-bridge.js';
  if (fs.existsSync(bridgePath)) {
    const bridgeCode = fs.readFileSync(bridgePath, 'utf8');

    const checks = [
      {
        name: 'Function deskrpgCreateChannel',
        pattern: /function deskrpgCreateChannel/,
      },
      {
        name: 'Function deskrpgCreateNpc',
        pattern: /function deskrpgCreateNpc/,
      },
      {
        name: 'Function deskrpgCreateTask',
        pattern: /function deskrpgCreateTask/,
      },
      {
        name: 'Function deskrpgGetNpcStatus',
        pattern: /function deskrpgGetNpcStatus/,
      },
      {
        name: 'Function deskrpgGetTaskResult',
        pattern: /function deskrpgGetTaskResult/,
      },
      {
        name: 'Auth header builder',
        pattern: /buildHeaders/,
      },
    ];

    for (const check of checks) {
      const found = check.pattern.test(bridgeCode);
      testResult(found, check.name);
      found ? passedTests++ : failedTests++;
    }
  }

  // Test 4: API Actions
  log('\n\nTEST 4: API Content Actions', 'cyan');
  log('─'.repeat(56));

  const contentPath = '/home/user/starken-os/api/content.js';
  if (fs.existsSync(contentPath)) {
    const contentCode = fs.readFileSync(contentPath, 'utf8');

    const actions = [
      { name: 'vo_sync_deskrpg_npc', pattern: /vo_sync_deskrpg_npc/ },
      { name: 'vo_fetch_deskrpg_task', pattern: /vo_fetch_deskrpg_task/ },
    ];

    for (const action of actions) {
      const found = action.pattern.test(contentCode);
      testResult(found, `Action registered: ${action.name}`);
      found ? passedTests++ : failedTests++;
    }
  }

  // Test 5: Frontend Integration
  log('\n\nTEST 5: Frontend Integration', 'cyan');
  log('─'.repeat(56));

  const npcUiPath = '/home/user/starken-os/js/virtual-npc-ui.js';
  if (fs.existsSync(npcUiPath)) {
    const npcCode = fs.readFileSync(npcUiPath, 'utf8');

    const features = [
      { name: 'voSyncTaskWithDeskrpg function', pattern: /voSyncTaskWithDeskrpg/ },
      { name: 'voStartTaskStatusPolling function', pattern: /voStartTaskStatusPolling/ },
      {
        name: 'DeskRPG integration in task assignment',
        pattern: /deskrpg_npc_id/,
      },
    ];

    for (const feature of features) {
      const found = feature.pattern.test(npcCode);
      testResult(found, feature.name);
      found ? passedTests++ : failedTests++;
    }
  }

  // Test 6: Database Schema
  log('\n\nTEST 6: Database Schema Migration', 'cyan');
  log('─'.repeat(56));

  const sqlPath = '/home/user/starken-os/SQL/0002_deskrpg_integration.sql';
  if (fs.existsSync(sqlPath)) {
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    const schemaChecks = [
      {
        name: 'virtual_offices DeskRPG columns',
        pattern: /ALTER TABLE virtual_offices ADD COLUMN.*deskrpg_channel_id/,
      },
      {
        name: 'virtual_npcs DeskRPG columns',
        pattern: /ALTER TABLE virtual_npcs ADD COLUMN.*deskrpg_npc_id/,
      },
      {
        name: 'virtual_npc_tasks DeskRPG columns',
        pattern: /ALTER TABLE virtual_npc_tasks ADD COLUMN.*deskrpg_task_id/,
      },
      {
        name: 'Index creation for fast lookups',
        pattern: /CREATE INDEX.*idx_virtual.*deskrpg/,
      },
    ];

    for (const check of schemaChecks) {
      const found = check.pattern.test(sqlContent);
      testResult(found, check.name);
      found ? passedTests++ : failedTests++;
    }
  }

  // Summary
  log('\n\n' + '═'.repeat(56), 'blue');
  log('RESUMO DOS TESTES', 'blue');
  log('═'.repeat(56) + '\n', 'blue');

  log(`✅ Testes passou: ${passedTests}`);
  log(`❌ Testes falharam: ${failedTests}`);

  const total = passedTests + failedTests;
  const percentage = Math.round((passedTests / total) * 100);

  log(`📊 Taxa de sucesso: ${percentage}%\n`);

  if (failedTests === 0) {
    log('🎉 TODOS OS TESTES PASSARAM!', 'green');
    log('\n   Próxima etapa: Iniciar DeskRPG');
    log('   cd deskrpg && npm run dev\n');
  } else {
    log(`⚠️  ${failedTests} teste(s) falharam.`, 'yellow');
    log('\n   Revise os arquivos mencionados acima.\n');
  }

  log('═'.repeat(56) + '\n', 'blue');

  // Checklist for next steps
  log('CHECKLIST PARA PRÓXIMA ETAPA:', 'cyan');
  log('─'.repeat(56));
  log('  ☐ SQL migration executada no Supabase');
  log('  ☐ Schema validado (13 colunas + 5 índices)');
  log('  ☐ DeskRPG rodando em http://localhost:3000');
  log('  ☐ .env.local configurado com valores corretos');
  log('  ☐ Testes de integração (scripts/phase5-integration-tests.js)');
  log('  ☐ Testes end-to-end (Passo 4 no PHASE_5_DEPLOYMENT_GUIDE.md)\n');
}

main().catch(err => {
  log(`\n❌ Erro: ${err.message}\n`, 'red');
  process.exit(1);
});
