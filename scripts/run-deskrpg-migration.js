#!/usr/bin/env node

/**
 * Execute DeskRPG Integration SQL Migration via Supabase
 *
 * This script executes the Phase 5 SQL migration by making individual
 * REST API calls to Supabase, since direct SQL execution is not available
 * via the REST API (requires console).
 *
 * Since we can't execute raw SQL via REST API, this script provides
 * validation and instructs the user on manual execution.
 */

const SUPABASE_URL = 'https://cpwpxckmuecejtkcobre.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwd3B4Y2ttdWVjZWp0a2NvYnJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MDM4NzkzMCwiZXhwIjoyMDA2NTY3OTMwfQ.EpCVS3mNxZjBm_6w_0-H6xVNQ4pYDEqzs5zZcRuV9bo';

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function checkTableColumns() {
  console.log('🔍 ETAPA 1: Verificando schema atual...\n');

  try {
    // Verificar se as colunas já existem
    const tables = [
      { name: 'virtual_offices', columns: ['deskrpg_channel_id'] },
      { name: 'virtual_npcs', columns: ['deskrpg_npc_id'] },
      { name: 'virtual_npc_tasks', columns: ['deskrpg_task_id'] },
      { name: 'virtual_activity_log', columns: ['metadata'] },
    ];

    console.log('📊 Tabelas a verificar:');
    for (const table of tables) {
      console.log(`   • ${table.name} → ${table.columns.join(', ')}`);
    }

    // Tenta fazer uma query simples para verificar se o banco responde
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/virtual_offices?select=deskrpg_channel_id&limit=1`,
      { headers: HEADERS }
    );

    if (response.ok) {
      console.log('\n✅ Conexão com Supabase estabelecida');
      return true;
    } else {
      console.log('\n❌ Erro ao conectar ao Supabase');
      console.log(`   Status: ${response.status}`);
      return false;
    }
  } catch (err) {
    console.log('\n❌ Erro ao verificar schema:');
    console.log(`   ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 5: DeskRPG Integration - SQL Migration Script  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  NOTA: Supabase não permite SQL direto via REST API');
  console.log('   A execução deve ser feita via Supabase Console\n');

  // Check connection
  const connected = await checkTableColumns();

  if (!connected) {
    console.log('\n❌ Não foi possível conectar ao Supabase');
    console.log('   Verifique as credenciais em .env.local');
    process.exit(1);
  }

  console.log('\n════════════════════════════════════════════════════════\n');
  console.log('📋 INSTRUÇÕES PARA EXECUTAR A MIGRAÇÃO:\n');

  console.log('1️⃣  Abra: https://app.supabase.com/');
  console.log('2️⃣  Selecione projeto: starken-os');
  console.log('3️⃣  Clique em SQL Editor (sidebar esquerda)');
  console.log('4️⃣  Clique em "New Query"');
  console.log('5️⃣  Cole o SQL abaixo:');
  console.log('\n════════════════════════════════════════════════════════\n');

  // Read and display SQL
  const fs = require('fs');
  const path = require('path');
  const sqlPath = path.join(__dirname, '../SQL/0002_deskrpg_integration.sql');

  if (fs.existsSync(sqlPath)) {
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    // Extract apenas os comandos SQL (sem comentários)
    const sqlLines = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim())
      .join('\n');

    console.log(sqlLines);
  } else {
    console.log('⚠️  Arquivo SQL não encontrado: ' + sqlPath);
  }

  console.log('\n════════════════════════════════════════════════════════\n');

  console.log('6️⃣  Clique no botão RUN (canto superior direito)');
  console.log('7️⃣  Aguarde "Query executed successfully"');
  console.log('\n✅ Migration concluída!\n');

  console.log('════════════════════════════════════════════════════════\n');
  console.log('🔍 DEPOIS DA MIGRAÇÃO: Verifique as colunas\n');

  console.log('Execute no SQL Editor do Supabase:\n');
  console.log('-- Verificar virtual_offices');
  console.log('SELECT column_name FROM information_schema.columns');
  console.log('WHERE table_name = \'virtual_offices\'');
  console.log('AND column_name LIKE \'deskrpg%\'\n');

  console.log('-- Resultado esperado: 3 colunas');
  console.log('-- deskrpg_channel_id');
  console.log('-- deskrpg_synced_at');
  console.log('-- deskrpg_sync_status\n');

  console.log('════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
