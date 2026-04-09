# 🚀 FASE 1: Executar Schema SQL no Supabase

**Status**: Aguardando execução manual
**Data**: 2026-04-09
**Objetivo**: Criar 9 novas tabelas para Virtual Office

---

## 📋 O QUE VOCÊ PRECISA FAZER

### Passo 1: Abrir Supabase Console
```
https://app.supabase.com/projects
```

### Passo 2: Selecionar Projeto
```
Projeto: cpwpxckmuecejtkcobre
```

### Passo 3: Ir ao SQL Editor
```
Menu Esquerdo → SQL Editor
```

### Passo 4: Criar Nova Query
```
Clique em "+ New Query"
```

### Passo 5: Copiar SQL Completo
Copie TODO o arquivo:
```
/home/user/starken-os/SQL/0001_virtual_office_schema.sql
```

**Comando para copiar (no seu terminal):**
```bash
cat /home/user/starken-os/SQL/0001_virtual_office_schema.sql | pbcopy
# Depois paste no Supabase
```

### Passo 6: Executar
```
No Supabase Console:
1. Cole o SQL
2. Clique no botão "RUN" (ou Cmd+Enter)
3. Aguarde ~5-10 segundos
```

---

## ✅ VERIFICAÇÃO APÓS EXECUÇÃO

Você verá mensagens de sucesso no console do Supabase:

```
✓ CREATE TABLE virtual_buildings
✓ INSERT 1 row into virtual_buildings  
✓ CREATE TABLE virtual_offices
✓ CREATE INDEX idx_virtual_offices_client_id
✓ CREATE INDEX idx_virtual_offices_building_id
✓ CREATE TABLE virtual_rooms
✓ CREATE INDEX idx_virtual_rooms_office_id
✓ CREATE INDEX idx_virtual_rooms_type
✓ CREATE TABLE virtual_npcs
✓ CREATE INDEX idx_virtual_npcs_room_id
✓ CREATE INDEX idx_virtual_npcs_office_id
✓ CREATE INDEX idx_virtual_npcs_client_id
✓ CREATE INDEX idx_virtual_npcs_status
✓ CREATE TABLE virtual_npc_central
✓ CREATE INDEX idx_virtual_npc_central_building_id
✓ CREATE TABLE virtual_npc_tasks
✓ CREATE INDEX idx_virtual_npc_tasks_npc_id
✓ CREATE INDEX idx_virtual_npc_tasks_office_id
✓ CREATE INDEX idx_virtual_npc_tasks_room_id
✓ CREATE INDEX idx_virtual_npc_tasks_status
✓ CREATE TABLE virtual_squad_reports
✓ CREATE INDEX idx_virtual_squad_reports_office_id
✓ CREATE INDEX idx_virtual_squad_reports_leader_name
✓ CREATE INDEX idx_virtual_squad_reports_report_date
✓ CREATE TABLE virtual_ceo_dashboard
✓ CREATE INDEX idx_virtual_ceo_dashboard_npc_central_id
✓ CREATE INDEX idx_virtual_ceo_dashboard_report_period
✓ CREATE TABLE virtual_activity_log
✓ CREATE INDEX idx_virtual_activity_log_office_id
✓ CREATE INDEX idx_virtual_activity_log_npc_id
✓ CREATE INDEX idx_virtual_activity_log_created_at
```

---

## 🔍 CONFIRMAR QUE FUNCIONOU

Execute esta query no Supabase SQL Editor para verificar:

```sql
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'virtual_%' 
ORDER BY tablename;
```

**Resultado esperado (9 linhas):**
```
virtual_activity_log
virtual_buildings
virtual_ceo_dashboard
virtual_npc_central
virtual_npc_tasks
virtual_npcs
virtual_offices
virtual_rooms
virtual_squad_reports
```

---

## ✅ TESTES RÁPIDOS

### Verificar Prédio Starken foi inserido:
```sql
SELECT * FROM virtual_buildings;
```

**Resultado esperado:**
```
id: [UUID]
name: Starken
description: Prédio central - Headquarters
address: NULL
total_floors: 1
created_at: [timestamp]
updated_at: [timestamp]
```

### Contar tabelas criadas:
```sql
SELECT COUNT(*) as total_tables FROM pg_tables 
WHERE tablename LIKE 'virtual_%';
```

**Resultado esperado:**
```
total_tables: 9
```

### Contar índices criados:
```sql
SELECT COUNT(*) as total_indexes FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE 'virtual_%';
```

**Resultado esperado:**
```
total_indexes: 15
```

---

## 🛡️ SEGURANÇA CONFIRMADA

✅ Nenhuma tabela existente foi modificada
✅ Nenhum dado existente foi deletado
✅ Apenas novas tabelas criadas (isoladas)
✅ Rollback fácil: `DROP TABLE virtual_* CASCADE;`

---

## 📞 PRÓXIMAS AÇÕES

**Após confirmar as 9 tabelas foram criadas:**

1. ✅ Você confirma comigo: "Pronto, as 9 tabelas foram criadas"
2. ✅ Vou prosseguir com **FASE 2**: Modificar `api/content.js`
3. ✅ Implementar 5 novas ações (Opção A - Multiplexing)

---

## 🚀 ESTÁ PRONTO PARA COMEÇAR?

**Aviso-me quando tiver executado o SQL!**

Depois faremos:
- FASE 2: Modificar api/content.js (30 min)
- FASE 3: Criar módulos JavaScript (1 hora)
- FASE 4: Integrar no HTML (30 min)
- FASE 5: Integrar com DeskRPG
- FASE 6: Testes completos
- FASE 7: Deploy

---

*Documento de Execução - Phase 1*
*Documento criado: 2026-04-09*
