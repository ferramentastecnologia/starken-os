# PRD — Sistema de Publicação & Agendamento v2.0

## Starken OS — Módulo de Publicação Multi-Cliente

**Autor:** Claude Code + Juan
**Data:** 2026-03-19
**Status:** Draft para aprovação
**Prioridade:** Alta

---

## 1. Problema Atual

O módulo de agendamento atual tem limitações críticas que impedem o uso em produção para 35+ clientes:

### O que temos hoje (print analisado)

```
┌─────────────────────────────────────────────────────┐
│ Agendamento de Publicações                          │
│                                                     │
│ Destino: [IG Starken | IG Alpha | FB Starken | FB]  │ ← Só 4 opções (tenant)
│ Tipo:    [Feed | Stories | Reels | Carrossel]       │ ← Sem adaptação de UI
│ Legenda: [textarea 0/2200]                          │ ← Sem hashtags, sem menções
│ Mídia:   [dropzone - upload NÃO FUNCIONA]           │ ← Placeholder (TODO)
│ Quando:  [Agora | Agendar]                          │ ← Sem calendário visual
│ [Publicar]                                          │ ← Sem preview
│                                                     │
│ Posts Agendados: "disponível após primeira pub..."   │ ← Vazio, sem funcionalidade
└─────────────────────────────────────────────────────┘
```

### Problemas identificados

| # | Problema | Impacto |
|---|---------|---------|
| 1 | **Destino é por tenant, não por cliente** | Não consigo postar para "Mortadella" ou "Rosa Mexicano" individualmente |
| 2 | **Upload de mídia não funciona** | Código diz `TODO: Implementar upload para Supabase Storage` |
| 3 | **Sem seletor de cliente** | Publica usando o pageId do primeiro cliente do tenant |
| 4 | **Sem publicação cruzada (IG+FB)** | Preciso publicar 2x manualmente para cobrir IG e FB |
| 5 | **Sem publicação em lote** | Para 35 clientes, seriam 70+ ações manuais por semana |
| 6 | **Sem preview do post** | Não vejo como o post vai ficar antes de publicar |
| 7 | **Sem validação de mídia** | Não valida dimensões, formato, tamanho (requisitos Meta) |
| 8 | **Sem calendário de agendamento** | Não tenho visão semanal/mensal do que está agendado |
| 9 | **Sem fila/queue de posts** | Sem rascunhos, sem workflow de aprovação |
| 10 | **Usa token global** | Deveria usar `pageAccessToken` por cliente para publicar |
| 11 | **Sem suporte a Stories** | Stories IG tem requisitos específicos (full screen 9:16) |
| 12 | **Lista de agendados vazia** | `metaPublishLoadScheduled()` é placeholder |

---

## 2. Visão da Solução

### Conceito: "Publicador Inteligente Multi-Cliente"

Uma interface que permite ao Juan e equipe:
1. Selecionar **um ou vários clientes** como destino
2. Criar o post com **preview em tempo real** (mockup IG/FB)
3. Fazer **upload de mídia** com validação automática
4. Publicar ou agendar com **um clique** para IG + FB simultaneamente
5. Ver tudo agendado em um **calendário visual** por cliente
6. Gerenciar **filas e rascunhos** por cliente

### Fluxo Principal

```
Selecionar Cliente(s) → Tipo de Post → Upload Mídia → Legenda + Hashtags
       ↓                                                      ↓
Validação automática ←────────────────────────────────────── Preview
       ↓
[Publicar Agora] ou [Agendar] ou [Salvar Rascunho]
       ↓
Para cada cliente selecionado:
  IG: criar container → poll status → publish
  FB: upload foto(s) → criar post com attached_media
       ↓
Feedback em tempo real por cliente (sucesso/erro)
       ↓
Registrar no Supabase (tabela scheduled_posts)
```

---

## 3. Requisitos Funcionais

### 3.1 — Seletor de Cliente Inteligente

**Prioridade: P0 (Crítico)**

- Dropdown com busca que lista todos os clientes configurados no `meta_config`
- Filtrável por empresa (Starken / Alpha)
- Mostra status de conexão: IG conectado, FB conectado, ambos
- Permite **multi-seleção** para publicação em lote
- Badge visual com ícone da plataforma disponível por cliente

```
┌─ Destino ──────────────────────────────────────────┐
│ 🔍 Buscar cliente...                               │
│                                                     │
│ ★ STARKEN (25 clientes)                            │
│   ☑ Mortadella Blumenau        📷 IG  📘 FB       │
│   ☑ Rosa Mexicano Blumenau     📷 IG  📘 FB       │
│   ☐ Hamburgueria Feio          📷 IG  📘 FB       │
│   ☐ Arena Gourmet              📷 IG  ⚠️ sem FB   │
│                                                     │
│ 🌿 ALPHA (10 clientes)                             │
│   ☐ Super Duper                📷 IG  📘 FB       │
│   ...                                               │
│                                                     │
│ [Selecionar Todos Starken] [Selecionar Todos Alpha] │
└─────────────────────────────────────────────────────┘
```

**Dados por cliente (do `meta_config`):**
- `pageId` → publicação FB
- `igUserId` → publicação IG
- `pageAccessToken` → token de cada página (hoje usa o global)
- `pageName`, `igUsername` → exibição

### 3.2 — Upload de Mídia Funcional

**Prioridade: P0 (Crítico)**

**Fluxo de upload:**
1. Usuário arrasta/seleciona arquivos locais
2. Frontend valida formato, dimensões e tamanho
3. Upload para **Supabase Storage** (bucket `media`)
4. Obtém URL pública do arquivo
5. URL é usada na chamada `/api/meta/media` (Meta curla a URL)

**Validações obrigatórias (requisitos Meta):**

| Tipo | Formato | Tamanho Max | Aspect Ratio | Resolução |
|------|---------|-------------|--------------|-----------|
| **Feed Image** | JPEG, PNG | 8 MB | 4:5 a 1.91:1 | Min 320px, Max 1440px largura |
| **Stories** | JPEG, PNG, MP4 | 8 MB img / 100 MB video | 9:16 (obrigatório) | 1080x1920 recomendado |
| **Reels** | MP4 (H.264) | 100 MB | 9:16 (para tab Reels) | 1080x1920 recomendado |
| **Carrossel** | JPEG, PNG, MP4 | 8 MB img / 100 MB video | 4:5 a 16:9 | Max 10 itens, vídeo max 60s |

**Validações no frontend antes de upload:**
- Verificar extensão do arquivo (JPEG/PNG/MP4/MOV)
- Verificar tamanho máximo
- Ler dimensões da imagem (via `Image()` object) e validar aspect ratio
- Para vídeo: verificar duração (via `<video>` element)
- Rejeitar HEVC/HDR automaticamente
- Exibir mensagem clara de erro com especificação esperada

**Preview de mídia:**
- Thumbnail da imagem/vídeo após seleção
- Indicador de validação (check verde / X vermelho com motivo)
- Drag para reordenar no carrossel
- Botão de remover individual

### 3.3 — Compositor de Legenda

**Prioridade: P1 (Importante)**

- Textarea com contador de caracteres (limite 2.200 IG)
- **Banco de hashtags por segmento** (Gastronomia, Eventos, etc.)
  - Sugestão automática baseada no segmento do cliente selecionado
  - Hashtags salvas/favoritas por cliente
- **Menções** — detecção de `@username` com autocomplete
- **Emojis** — picker integrado
- **Templates de legenda** — salvar e reutilizar templates
- **Separador de hashtags** — campo separado para hashtags (melhores práticas IG)

```
┌─ Legenda ─────────────────────────────────────────────────┐
│ 🍕 Hoje é dia de pizza artesanal!                         │
│ Venha experimentar nossas novidades...                    │
│                                                  187/2200 │
├───────────────────────────────────────────────────────────┤
│ Hashtags: #pizza #gastronomia #blumenau #delivery    8/30 │
│ [+ Sugerir do segmento] [Salvar como favoritas]          │
└───────────────────────────────────────────────────────────┘
```

### 3.4 — Preview do Post

**Prioridade: P1 (Importante)**

Mockup visual de como o post aparecerá no IG/FB antes de publicar:

```
┌──────────── Preview IG ──────────────┐
│ ┌────────────────────────────────┐   │
│ │ 📷 mortadella.blumenau         │   │
│ ├────────────────────────────────┤   │
│ │                                │   │
│ │        [IMAGEM DO POST]        │   │
│ │                                │   │
│ ├────────────────────────────────┤   │
│ │ ♡  💬  ➤           🔖         │   │
│ │ 🍕 Hoje é dia de pizza...     │   │
│ │ #pizza #gastronomia           │   │
│ └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

- Alterna entre preview IG e FB
- Mostra avatar + username do cliente
- Renderiza imagem real (thumbnail do upload)
- Mostra legenda truncada como no app real
- Carousel: navegação entre imagens

### 3.5 — Publicação e Agendamento

**Prioridade: P0 (Crítico)**

**Três ações disponíveis:**
1. **Publicar Agora** — envia imediatamente
2. **Agendar** — data/hora futura (mín. 10 min, máx. 75 dias pela API Meta)
3. **Salvar Rascunho** — salva no Supabase sem enviar à Meta

**Publicação cruzada IG+FB:**
- Checkbox: "Publicar também no Facebook"
- Quando marcado, executa ambos os fluxos para cada cliente selecionado
- Progress bar individual por cliente + plataforma

**Fluxo técnico por publicação (IG):**
```
1. POST /api/meta/media   → cria container (image_url da Supabase Storage)
2. Poll container status  → FINISHED / ERROR (até 60s)
3. POST /api/meta/publish → media_publish com container_id
```

**Fluxo técnico por publicação (FB):**
```
1. POST /api/meta/media   → upload foto não publicada
2. POST /api/meta/publish → post no feed com attached_media
```

**Publicação em lote:**
- Para N clientes selecionados, executa N publicações sequenciais
- Cada cliente usa seu próprio `pageAccessToken` (não o global)
- Feedback em tempo real: `[✅ Mortadella IG] [✅ Mortadella FB] [⏳ Rosa Mexicano IG] [...]`
- Se um falhar, continua com os próximos
- Relatório final: X sucesso, Y falha (com detalhes do erro)

**Rate limiting:**
- Respeitar limite de 100 posts/24h por conta IG
- Consultar `GET /<IG_ID>/content_publishing_limit` antes de publicar
- Alertar se próximo do limite

### 3.6 — Calendário de Publicações

**Prioridade: P1 (Importante)**

Visão calendário (semanal + mensal) de todos os posts agendados:

```
┌─ Março 2026 ──────────────────────────────────────────────────┐
│ Seg      Ter      Qua      Qui      Sex      Sáb     Dom    │
│                                                               │
│ 16       17       18       19       20       21      22      │
│ ┌──────┐ ┌──────┐                   ┌──────┐                │
│ │Morta │ │Rosa  │                   │Arena │                │
│ │Feed  │ │Reels │                   │Story │                │
│ │10:00 │ │14:00 │                   │09:00 │                │
│ └──────┘ └──────┘                   └──────┘                │
│                                                               │
│ 23       24       25       26       27       28      29      │
│ ┌──────┐ ┌──────┐ ┌──────┐                                  │
│ │Morta │ │Feio  │ │SuperX│                                  │
│ │Feed  │ │Feed  │ │Feed  │                                  │
│ │10:00 │ │11:00 │ │10:00 │                                  │
│ └──────┘ └──────┘ └──────┘                                  │
└───────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Filtrar por cliente, empresa, tipo de post
- Cores por empresa (azul Starken, verde Alpha)
- Click no card → abre detalhes (pode editar/cancelar)
- Drag & drop para reagendar (atualiza no Supabase + Meta API)
- Indicador de posts já publicados vs agendados vs rascunhos

### 3.7 — Fila e Rascunhos

**Prioridade: P2 (Desejável)**

- Lista de rascunhos salvos no Supabase (sem enviar à Meta)
- Workflow: `Rascunho → Revisão → Aprovado → Agendado → Publicado`
- Filtros por status, cliente, data
- Duplicar post (para recriar para outro cliente com mesma legenda)

---

## 4. Requisitos Técnicos

### 4.1 — Nova tabela Supabase: `scheduled_posts`

```sql
CREATE TABLE scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_key TEXT NOT NULL,          -- chave do cliente no meta_config
  client_name TEXT,
  tenant TEXT NOT NULL,              -- 'starken' | 'alpha'

  -- Conteúdo
  caption TEXT,
  hashtags TEXT,                     -- separado da legenda
  post_type TEXT NOT NULL DEFAULT 'feed', -- feed | stories | reels | carousel
  media_urls JSONB DEFAULT '[]',     -- array de URLs do Supabase Storage
  media_type TEXT DEFAULT 'IMAGE',   -- IMAGE | VIDEO | REELS | CAROUSEL_ALBUM

  -- Destinos
  publish_ig BOOLEAN DEFAULT true,
  publish_fb BOOLEAN DEFAULT true,

  -- Agendamento
  status TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | publishing | published | failed
  scheduled_at TIMESTAMPTZ,          -- quando publicar (null = imediato)
  published_at TIMESTAMPTZ,          -- quando foi publicado

  -- Resultados
  ig_post_id TEXT,                   -- ID do post no IG após publicação
  fb_post_id TEXT,                   -- ID do post no FB após publicação
  ig_container_id TEXT,              -- container ID intermediário
  error_message TEXT,                -- mensagem de erro se falhou

  -- Metadata
  created_by TEXT DEFAULT 'Juan',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX idx_scheduled_posts_client ON scheduled_posts(client_key);
CREATE INDEX idx_scheduled_posts_scheduled ON scheduled_posts(scheduled_at);
```

### 4.2 — Supabase Storage: bucket `media`

```sql
-- Criar bucket para armazenamento de mídia
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true);

-- Policy: qualquer um pode ler (URLs públicas para Meta curlar)
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

-- Policy: autenticados podem inserir
CREATE POLICY "Auth insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media');
```

### 4.3 — Nova API: `/api/meta/upload`

Endpoint intermediário para receber arquivo do frontend, salvar no Supabase Storage e retornar URL pública:

```
POST /api/meta/upload
Content-Type: multipart/form-data

file: <binary>
client_key: "mortadella-blumenau"

Response:
{
  "url": "https://cpwpxckmuecejtkcobre.supabase.co/storage/v1/object/public/media/mortadella-blumenau/2026-03/feed-1711036800.jpg",
  "filename": "feed-1711036800.jpg",
  "size": 245000,
  "width": 1080,
  "height": 1350,
  "mime_type": "image/jpeg"
}
```

### 4.4 — Nova API: `/api/meta/scheduled`

Gerenciar posts agendados no Supabase:

```
GET  /api/meta/scheduled?tenant=starken&status=scheduled&from=2026-03-01&to=2026-03-31
POST /api/meta/scheduled   (criar novo agendamento)
PUT  /api/meta/scheduled   (atualizar agendamento)
DELETE /api/meta/scheduled?id=xxx (cancelar)
```

### 4.5 — Correção: Token por Cliente

**Problema atual:** `graph.js` usa `process.env.META_ACCESS_TOKEN` (token global do Juan).

**Solução:** Para publicação, usar o `pageAccessToken` específico de cada cliente (já salvo no `meta_config`). Modificar `publish.js` e `media.js` para aceitar token por request:

```javascript
// Antes (graph.js):
function getToken() {
  return process.env.META_ACCESS_TOKEN; // Token global
}

// Depois: aceitar token override
async function graphPost(path, body = {}, tokenOverride = null) {
  const token = tokenOverride || getToken();
  // ...
}
```

### 4.6 — Validações Meta (Frontend)

Módulo JavaScript de validação que roda no browser antes do upload:

```javascript
const META_SPECS = {
  feed: {
    image: { maxSize: 8*1024*1024, aspectMin: 4/5, aspectMax: 1.91, formats: ['image/jpeg','image/png'] },
    video: { maxSize: 100*1024*1024, maxDuration: 60, formats: ['video/mp4'] },
  },
  stories: {
    image: { maxSize: 8*1024*1024, aspect: 9/16, tolerance: 0.01, formats: ['image/jpeg','image/png'] },
    video: { maxSize: 100*1024*1024, maxDuration: 60, aspect: 9/16, formats: ['video/mp4'] },
  },
  reels: {
    video: { maxSize: 100*1024*1024, minDuration: 5, maxDuration: 900, aspect: 9/16, formats: ['video/mp4'] },
  },
  carousel: {
    image: { maxSize: 8*1024*1024, aspectMin: 4/5, aspectMax: 16/9, formats: ['image/jpeg','image/png'] },
    video: { maxSize: 100*1024*1024, maxDuration: 60, aspectMin: 4/5, aspectMax: 16/9, formats: ['video/mp4'] },
    maxItems: 10,
  },
};
```

---

## 5. Fases de Implementação

### Fase 1: Fundação (Prioridade P0)
**Estimativa: Backend + Frontend core**

- [ ] Criar tabela `scheduled_posts` no Supabase
- [ ] Criar bucket `media` no Supabase Storage
- [ ] Criar API `/api/meta/upload` (recebe arquivo, salva Storage, retorna URL)
- [ ] Modificar `graph.js` para aceitar token override por cliente
- [ ] Criar seletor de cliente (dropdown com busca, multi-select)
- [ ] Implementar upload de mídia funcional (drag & drop + validação)
- [ ] Conectar fluxo completo: upload → media container → publish

### Fase 2: Experiência (Prioridade P1)
**Estimativa: UX e produtividade**

- [ ] Preview do post (mockup IG/FB)
- [ ] Compositor de legenda avançado (hashtags, emojis, templates)
- [ ] Publicação cruzada IG + FB com um clique
- [ ] Publicação em lote (multi-cliente)
- [ ] Feedback em tempo real por cliente (progress bar)
- [ ] Criar API `/api/meta/scheduled` (CRUD de agendamentos)
- [ ] Lista de posts agendados funcional (substituir placeholder)

### Fase 3: Calendário (Prioridade P1)
**Estimativa: Visualização e gestão**

- [ ] Calendário visual semanal/mensal
- [ ] Cards de post no calendário (cor por empresa, tipo)
- [ ] Filtros (cliente, empresa, tipo, status)
- [ ] Click para detalhes / editar / cancelar
- [ ] Drag & drop para reagendar

### Fase 4: Produtividade (Prioridade P2)
**Estimativa: Features avançadas**

- [ ] Rascunhos e fila de publicação
- [ ] Workflow (Rascunho → Revisão → Aprovado → Agendado)
- [ ] Duplicar post para outro cliente
- [ ] Templates de legenda salvos
- [ ] Banco de hashtags por segmento
- [ ] Verificação de rate limit antes de publicar

---

## 6. Métricas de Sucesso

| Métrica | Antes | Meta |
|---------|-------|------|
| Tempo para agendar 1 post para 1 cliente | N/A (manual no Meta) | < 2 minutos |
| Tempo para agendar mesmo post para 10 clientes | N/A | < 5 minutos |
| Taxa de erro por validação Meta | Alta (sem validação) | < 5% |
| Posts agendados visíveis em calendário | 0 | 100% |
| Upload de mídia funcional | Não | Sim |

---

## 7. Dependências e Riscos

| Risco | Mitigação |
|-------|----------|
| Token de página expirar | Implementar refresh automático ou alerta no dashboard |
| Rate limit Meta (100 posts/24h) | Verificar limite antes de lote, distribuir ao longo do dia |
| Supabase Storage gratuito (1 GB) | Limpar mídias antigas após publicação, ou upgrade do plano |
| Timeout no Vercel (10s hobby plan) | Poll de container pode ultrapassar — usar retorno assíncrono |
| Imagem não acessível ao Meta (curling) | URLs do Supabase Storage devem ser públicas |

---

## 8. Referências Técnicas

- [Meta Content Publishing API](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [IG Media Endpoint](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/)
- [Meta Graph API v25.0](https://developers.facebook.com/docs/graph-api/)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

---

*PRD gerado em 2026-03-19 — Starken OS v4.0*
