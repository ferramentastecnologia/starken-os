#!/bin/bash
# =============================================================
# SYNC SUPABASE → VPS PostgreSQL
# Execute na VPS: bash sync_vps.sh
# =============================================================

SUPA_URL="https://cpwpxckmuecejtkcobre.supabase.co"
SUPA_KEY="sb_publishable_z-uy5pBapfR74IIQyag5vA_i6IKJLHB"

# ⚠️ Ajuste abaixo se necessário:
DB_NAME="${1:-postgres}"
DB_USER="${2:-postgres}"

echo "================================================"
echo "  SYNC SUPABASE → VPS PostgreSQL"
echo "  Banco: $DB_NAME | Usuário: $DB_USER"
echo "================================================"

# Verifica dependências
for cmd in curl python3 psql; do
  if ! command -v $cmd &>/dev/null; then
    echo "❌ Comando '$cmd' não encontrado. Instale e tente novamente."
    exit 1
  fi
done

# Cria arquivo temp
TMPDIR_SYNC=$(mktemp -d)
SQL_FILE="$TMPDIR_SYNC/sync.sql"

echo "BEGIN;" > "$SQL_FILE"

# Função: busca tabela paginada e gera INSERTs
fetch_table() {
  local table=$1
  local conflict_col="${2:-id}"
  local total_records=0
  local offset=0
  local batch_size=1000
  local batch=1

  echo "-- =============================" >> "$SQL_FILE"
  echo "-- TABELA: $table" >> "$SQL_FILE"
  echo "-- =============================" >> "$SQL_FILE"

  while true; do
    local resp=$(curl -s -X GET \
      "$SUPA_URL/rest/v1/$table?select=*&order=created_at.asc&limit=$batch_size&offset=$offset" \
      -H "apikey: $SUPA_KEY" \
      -H "Authorization: Bearer $SUPA_KEY")

    local count=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)

    if [ -z "$count" ] || [ "$count" -eq 0 ] 2>/dev/null; then
      break
    fi

    echo "$resp" | python3 - << 'PYEOF' "$table" "$conflict_col" >> "$SQL_FILE"
import sys, json

def escape_str(val):
    if val is None:
        return 'NULL'
    if isinstance(val, bool):
        return 'TRUE' if val else 'FALSE'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (dict, list)):
        val = json.dumps(val, ensure_ascii=False)
    val = str(val).replace("'", "''")
    return f"'{val}'"

table = sys.argv[1]
conflict_col = sys.argv[2]
data = json.load(sys.stdin)

for row in data:
    cols = list(row.keys())
    vals = [escape_str(row[c]) for c in cols]
    cols_str = ', '.join(f'"{c}"' for c in cols)
    vals_str = ', '.join(vals)
    print(f"INSERT INTO {table} ({cols_str}) VALUES ({vals_str}) ON CONFLICT ({conflict_col}) DO NOTHING;")
PYEOF

    total_records=$((total_records + count))
    echo "  Tabela $table batch $batch: $count registros (total: $total_records)"
    offset=$((offset + batch_size))
    batch=$((batch + 1))

    if [ "$count" -lt "$batch_size" ]; then
      break
    fi
  done

  echo "-- $table: $total_records registros inseridos" >> "$SQL_FILE"
  echo "" >> "$SQL_FILE"
}

# Tabela especial: meta_config usa id='default' como conflict
fetch_table_with_id() {
  local table=$1
  local conflict_col="${2:-id}"

  echo "-- =============================" >> "$SQL_FILE"
  echo "-- TABELA: $table" >> "$SQL_FILE"
  echo "-- =============================" >> "$SQL_FILE"

  local resp=$(curl -s -X GET \
    "$SUPA_URL/rest/v1/$table?select=*" \
    -H "apikey: $SUPA_KEY" \
    -H "Authorization: Bearer $SUPA_KEY")

  echo "$resp" | python3 - << 'PYEOF' "$table" "$conflict_col" >> "$SQL_FILE"
import sys, json

def escape_str(val):
    if val is None:
        return 'NULL'
    if isinstance(val, bool):
        return 'TRUE' if val else 'FALSE'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (dict, list)):
        val = json.dumps(val, ensure_ascii=False)
    val = str(val).replace("'", "''")
    return f"'{val}'"

table = sys.argv[1]
conflict_col = sys.argv[2]
data = json.load(sys.stdin)

for row in data:
    cols = list(row.keys())
    vals = [escape_str(row[c]) for c in cols]
    cols_str = ', '.join(f'"{c}"' for c in cols)
    vals_str = ', '.join(vals)
    print(f"INSERT INTO {table} ({cols_str}) VALUES ({vals_str}) ON CONFLICT ({conflict_col}) DO NOTHING;")
PYEOF

  local count=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  echo "-- $table: $count registros" >> "$SQL_FILE"
  echo "" >> "$SQL_FILE"
  echo "  Tabela $table: $count registros"
}

echo ""
echo "📥 Baixando dados do Supabase..."
echo ""

fetch_table_with_id meta_config id
fetch_table content_groups id
fetch_table content_tasks id
fetch_table content_comments id
fetch_table content_attachments id
fetch_table content_activity id
fetch_table publish_history id
fetch_table publish_queue id

echo "COMMIT;" >> "$SQL_FILE"

echo ""
echo "📊 SQL gerado: $SQL_FILE"
echo "   Tamanho: $(du -sh $SQL_FILE | cut -f1)"
echo ""

# Pergunta antes de executar
read -p "✅ Executar o sync no banco '$DB_NAME' como '$DB_USER'? (s/N): " confirm
if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
  echo "Operação cancelada. SQL salvo em: $SQL_FILE"
  exit 0
fi

echo ""
echo "🔄 Importando no PostgreSQL..."
psql -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE" 2>&1 | tail -20

echo ""
echo "✅ Sync concluído!"
echo ""

# Contagem final
echo "📊 Verificação final:"
for table in meta_config content_groups content_tasks content_comments content_attachments content_activity publish_history publish_queue; do
  count=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')
  echo "   $table: $count registros"
done

# Limpa temp
rm -rf "$TMPDIR_SYNC"
echo ""
echo "🎉 Pronto!"
