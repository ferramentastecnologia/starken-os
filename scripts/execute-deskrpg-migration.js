#!/usr/bin/env node

/**
 * Execute DeskRPG Integration SQL Migration
 *
 * Usage: node scripts/execute-deskrpg-migration.js
 *
 * This script reads SQL/0002_deskrpg_integration.sql and executes it
 * against the Supabase database using the Supabase REST API.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY required');
  console.error('   Set these in .env.local or as environment variables');
  process.exit(1);
}

async function executeMigration() {
  try {
    console.log('🔧 Phase 5: DeskRPG Integration SQL Migration');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Read SQL file
    const sqlPath = path.join(__dirname, '../SQL/0002_deskrpg_integration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log(`📄 SQL file: ${sqlPath}`);
    console.log(`📊 Database: ${SUPABASE_URL}`);
    console.log('');

    // Note: Supabase doesn't have a direct SQL execution endpoint via REST API
    // The recommended approach is to use the Supabase Console or SQL Editor
    // This script provides guidance for manual execution

    console.log('⚠️  NOTE: Supabase SQL execution requires using the Console');
    console.log('');
    console.log('📋 INSTRUCTIONS:');
    console.log('1. Go to: https://app.supabase.com/');
    console.log('2. Select your project (starken-os)');
    console.log('3. Click SQL Editor on the left sidebar');
    console.log('4. Click "New Query" button');
    console.log('5. Copy the SQL content below and paste it');
    console.log('6. Click RUN button');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 SQL CONTENT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(sqlContent);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ After running the SQL in Supabase Console:');
    console.log('   - Check the "Migrations" table to confirm');
    console.log('   - Run integration tests');
    console.log('   - Deploy to production');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

executeMigration();
