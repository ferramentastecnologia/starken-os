/**
 * seed-channels.js
 * Cria o Escritório Principal + 35 salas de clientes no banco.
 *
 * Uso: DATABASE_URL=... node scripts/seed-channels.js
 */

"use strict";

const { Pool } = require("pg");
const { randomUUID } = require("crypto");
const bcrypt = require("bcryptjs");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL não definida"); process.exit(1); }

// ── Clientes Starken Performance ──────────────────────────────────────────────
const GP_STARKEN = [
  'Mortadella Blumenau','Hamburgueria Feio','Rosa Mexicano Blumenau',
  'Rosa Mexicano Brusque','Suprema Pizza','Arena Gourmet','Super X - Garuva',
  'Super X - Guaratuba','Super X - Itapoa','Madrugao - Centro','Madrugao - Garcia',
  'Madrugao - Fortaleza','Restaurante Oca','Aseyori Restaurante','Oklahoma Burger',
  'Pizzaria Super X','Sr Salsicha','The Garrison','Estilo Tulipa',
  'Academia Sao Pedro','New Service','Melhor Visao','JPR Moveis Rusticos',
  'Dilokas Pizzaria Delivery',
];

// ── Clientes Alpha Assessoria ─────────────────────────────────────────────────
const GP_ALPHA = [
  'Mestre do Frango','Patricia Salgados','Pizzaria do Nei','Super Duper',
  'Sorveteria Maciel','WorldBurguer','Salfest','Saporito Pizzaria',
  "D' Britos",'Fratellis Pizzaria',
];

function slug(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    // ── 1. Criar usuário admin (se não existir) ──────────────────────────────
    const adminCheck = await pool.query(`SELECT id FROM users WHERE login_id = 'admin' LIMIT 1`);
    let adminId;

    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash("Starken2024!", 10);
      const res = await pool.query(
        `INSERT INTO users (id, login_id, nickname, password_hash, system_role, created_at, updated_at)
         VALUES ($1, 'admin', 'Admin Starken', $2, 'admin', now(), now()) RETURNING id`,
        [randomUUID(), hash]
      );
      adminId = res.rows[0].id;
      console.log("✓ Usuário admin criado (login: admin / senha: Starken2024!)");
    } else {
      adminId = adminCheck.rows[0].id;
      console.log("✓ Usuário admin já existe");
    }

    // ── 2. Criar grupo padrão ────────────────────────────────────────────────
    const groupCheck = await pool.query(`SELECT id FROM groups WHERE slug = 'starken' LIMIT 1`);
    let groupId;

    if (groupCheck.rows.length === 0) {
      const res = await pool.query(
        `INSERT INTO groups (id, name, slug, description, is_default, created_by, created_at, updated_at)
         VALUES ($1, 'Starken OS', 'starken', 'Grupo principal Starken OS', true, $2, now(), now()) RETURNING id`,
        [randomUUID(), adminId]
      );
      groupId = res.rows[0].id;
      // Adicionar admin ao grupo
      await pool.query(
        `INSERT INTO group_members (id, group_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, 'admin', now()) ON CONFLICT DO NOTHING`,
        [randomUUID(), groupId, adminId]
      );
      console.log("✓ Grupo 'starken' criado");
    } else {
      groupId = groupCheck.rows[0].id;
      console.log("✓ Grupo já existe");
    }

    // ── 3. Criar Escritório Principal ────────────────────────────────────────
    const mainCheck = await pool.query(`SELECT id FROM channels WHERE name = 'Escritório Principal' LIMIT 1`);
    if (mainCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO channels (id, name, description, owner_id, group_id, is_public, max_players, created_at, updated_at)
         VALUES ($1, 'Escritório Principal', 'Sede Starken OS — todos os agentes', $2, $3, true, 50, now(), now())`,
        [randomUUID(), adminId, groupId]
      );
      console.log("✓ Canal: Escritório Principal");
    } else {
      console.log("- Canal já existe: Escritório Principal");
    }

    // ── 4. Criar salas Starken Performance ───────────────────────────────────
    console.log("\n── Starken Performance ──");
    for (const client of GP_STARKEN) {
      const channelName = `SP — ${client}`;
      const check = await pool.query(`SELECT id FROM channels WHERE name = $1 LIMIT 1`, [channelName]);
      if (check.rows.length === 0) {
        await pool.query(
          `INSERT INTO channels (id, name, description, owner_id, group_id, is_public, max_players, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, false, 10, now(), now())`,
          [randomUUID(), channelName, `Sala do cliente ${client}`, adminId, groupId]
        );
        console.log(`  ✓ ${channelName}`);
      } else {
        console.log(`  - já existe: ${channelName}`);
      }
    }

    // ── 5. Criar salas Alpha Assessoria ─────────────────────────────────────
    console.log("\n── Alpha Assessoria ──");
    for (const client of GP_ALPHA) {
      const channelName = `AA — ${client}`;
      const check = await pool.query(`SELECT id FROM channels WHERE name = $1 LIMIT 1`, [channelName]);
      if (check.rows.length === 0) {
        await pool.query(
          `INSERT INTO channels (id, name, description, owner_id, group_id, is_public, max_players, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, false, 10, now(), now())`,
          [randomUUID(), channelName, `Sala do cliente ${client}`, adminId, groupId]
        );
        console.log(`  ✓ ${channelName}`);
      } else {
        console.log(`  - já existe: ${channelName}`);
      }
    }

    console.log("\n✅ Seed concluído! Total: 1 escritório principal + 34 salas de clientes");
    console.log("\nLogin padrão:");
    console.log("  Usuário: admin");
    console.log("  Senha:   Starken2024!");

  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error("Erro:", err); process.exit(1); });
