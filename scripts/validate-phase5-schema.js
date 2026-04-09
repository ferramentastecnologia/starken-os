#!/usr/bin/env node

/**
 * Validate Phase 5 DeskRPG Schema
 *
 * Checks if all required columns and indexes have been created.
 * Run after executing SQL migration in Supabase Console.
 *
 * Usage: node scripts/validate-phase5-schema.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║     PHASE 5: Schema Validation Checklist              ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Expected schema changes
const expectedChanges = {
  virtual_offices: {
    columns: ['deskrpg_channel_id', 'deskrpg_synced_at', 'deskrpg_sync_status'],
    indexes: ['idx_virtual_offices_deskrpg_channel_id'],
  },
  virtual_npcs: {
    columns: [
      'deskrpg_npc_id',
      'deskrpg_synced_at',
      'deskrpg_sync_status',
      'last_task_completed_at',
    ],
    indexes: ['idx_virtual_npcs_deskrpg_npc_id'],
  },
  virtual_npc_tasks: {
    columns: [
      'deskrpg_task_id',
      'deskrpg_synced_at',
      'deskrpg_sync_status',
      'deskrpg_status',
      'result_summary',
    ],
    indexes: [
      'idx_virtual_npc_tasks_deskrpg_task_id',
      'idx_virtual_npc_tasks_deskrpg_sync_status',
      'idx_virtual_npc_tasks_npc_status',
    ],
  },
  virtual_activity_log: {
    columns: ['metadata'],
    indexes: [],
  },
};

console.log('📋 CHECKLIST DE VALIDAÇÃO\n');
console.log('Use estas queries no Supabase Console para validar cada item.\n');

let queryNum = 1;

// Generate validation queries
for (const [table, schema] of Object.entries(expectedChanges)) {
  console.log(`${queryNum}️⃣  Colunas em ${table}:`);
  console.log('   ' + '─'.repeat(50));

  const columnQuery = schema.columns
    .map(col => `'${col}'`)
    .join(', ');

  console.log(`\n   SELECT column_name, data_type`);
  console.log(`   FROM information_schema.columns`);
  console.log(`   WHERE table_name = '${table}'`);
  console.log(`   AND column_name IN (${columnQuery});`);

  console.log(`\n   ✅ Esperado: ${schema.columns.length} coluna(s)`);
  schema.columns.forEach(col => {
    console.log(`      • ${col}`);
  });
  console.log();

  if (schema.indexes.length > 0) {
    queryNum++;
    console.log(`${queryNum}️⃣  Índices em ${table}:`);
    console.log('   ' + '─'.repeat(50));

    const indexNames = schema.indexes.map(idx => `'${idx}'`).join(', ');

    console.log(`\n   SELECT indexname, tablename, indexdef`);
    console.log(`   FROM pg_indexes`);
    console.log(`   WHERE tablename = '${table}'`);
    console.log(`   AND indexname IN (${indexNames});`);

    console.log(`\n   ✅ Esperado: ${schema.indexes.length} índice(s)`);
    schema.indexes.forEach(idx => {
      console.log(`      • ${idx}`);
    });
    console.log();
  }

  queryNum++;
}

// Final summary
console.log('═'.repeat(56) + '\n');
console.log('📊 RESUMO DO SCHEMA');
console.log('═'.repeat(56) + '\n');

let totalColumns = 0;
let totalIndexes = 0;

for (const [table, schema] of Object.entries(expectedChanges)) {
  totalColumns += schema.columns.length;
  totalIndexes += schema.indexes.length;
}

console.log(`📌 Colunas adicionadas: ${totalColumns}`);
console.log(`📌 Índices criados: ${totalIndexes}`);
console.log(`📌 Tabelas alteradas: ${Object.keys(expectedChanges).length}\n`);

console.log('═'.repeat(56) + '\n');
console.log('✅ CHECKLIST FINAL\n');

console.log('Depois de executar todas as queries acima, marque:');
console.log('');
console.log('  ☐ Todas as colunas esperadas existem');
console.log('  ☐ Todos os índices esperados foram criados');
console.log('  ☐ Nenhum erro "relation does not exist"');
console.log('');
console.log('Se todos estão marcados: ✨ Schema está pronto! ✨\n');

console.log('═'.repeat(56) + '\n');
console.log('🔍 TESTE RÁPIDO DE CONECTIVIDADE\n');

console.log('Execute esta query para testar acesso às novas colunas:\n');
console.log('  SELECT');
console.log('    deskrpg_channel_id,');
console.log('    deskrpg_npc_id,');
console.log('    deskrpg_task_id,');
console.log('    metadata');
console.log('  FROM virtual_offices');
console.log('  LIMIT 1;');
console.log('');
console.log('✅ Resultado esperado: Sem erros (mesmo que vazio)\n');

console.log('═'.repeat(56) + '\n');
console.log('📝 PRÓXIMA ETAPA: Iniciar DeskRPG\n');

console.log('Quando a validação passar, você pode:');
console.log('');
console.log('  1. Iniciar DeskRPG localmente:');
console.log('     cd deskrpg');
console.log('     npm install');
console.log('     npm run setup:lite');
console.log('     npm run dev');
console.log('');
console.log('  2. Ou informar que está pronto para os testes\n');

console.log('═'.repeat(56) + '\n');
