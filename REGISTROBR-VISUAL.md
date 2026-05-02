# 📍 Registro.br — Guia Visual Passo-a-Passo

**Objetivo**: Adicionar subdomínio `app` apontando para VPS

---

## ✅ Pré-Requisitos

- [ ] Você está logado em Registro.br
- [ ] Acessou: Meus Domínios → `starkentecnologia.com`
- [ ] Está na seção "Zona DNS" ou "Editar DNS"

---

## 🎯 Fluxo Visual (com screenshots)

### PASSO 1: Localizar Zona DNS

```
Registro.br Home
    ↓
"Meus Domínios"
    ↓
starkentecnologia.com (clique)
    ↓
"Gerenciar DNS" ou "Editar Zona DNS"
    ↓
VOCÊ ESTÁ AQUI 👈
```

**O que você deve ver**:
- Uma tabela com registros DNS existentes
- Colunas: "Nome do Host" | "Tipo" | "Valor" | "TTL"
- Botão "Adicionar Novo Registro" ou "+"

---

### PASSO 2: Identifique Registros Existentes

**Você provavelmente verá**:

```
┌─────────────────────────────────────────────┐
│ Nome do Host │  Tipo  │  Valor   │ TTL     │
├─────────────────────────────────────────────┤
│ @            │  NS    │ ns1.reg  │ 3600    │
│ @            │  NS    │ ns2.reg  │ 3600    │
│ www          │  CNAME │ @        │ 3600    │
│ (ou outros)  │        │          │         │
└─────────────────────────────────────────────┘
```

**Não delete nada! Apenas ADICIONE um novo registro.**

---

### PASSO 3: Clique em "Adicionar Novo Registro"

Procure por um botão:
- "Adicionar Novo Registro"
- "Adicionar Host"
- "+" (mais)
- "Nova Entrada"

**Clique nele** → vai abrir um formulário

---

### PASSO 4: Preencha o Formulário

#### Campo 1: Nome do Host

```
Campo: "Nome do Host" ou "Host"
Preencher com: app
(NÃO coloque "app.starkentecnologia.com", apenas "app")
```

#### Campo 2: Tipo

```
Campo: "Tipo" ou "Type"
Selecionar: A
(Tipo de registro de endereço IP)
```

#### Campo 3: Valor

```
Campo: "Valor" ou "Value" ou "IP"
Preencher com: 187.77.46.199
(IP da VPS Hostinger)
```

#### Campo 4: TTL (opcional)

```
Campo: "TTL"
Preencher com: 3600
(ou deixar padrão, se houver)
```

---

### PASSO 5: Resultado Visual

Após preencher, você verá algo assim:

```
┌─────────────────────────────────────────────┐
│ Nome do Host │  Tipo  │  Valor      │ TTL  │
├─────────────────────────────────────────────┤
│ @            │  NS    │ ns1.reg...  │ 3600 │
│ @            │  NS    │ ns2.reg...  │ 3600 │
│ www          │  CNAME │ @           │ 3600 │
│ app          │  A     │ 187.77.46   │ 3600 │ ← NOVO!
└─────────────────────────────────────────────┘
```

---

### PASSO 6: Salvar

Procure por um botão:
- "Salvar"
- "Gravar"
- "Confirmar"
- "OK"

**Clique nele** → registro é salvo

**Pode pedir confirmação por email/SMS** → confirme

---

## ✅ Verificação

Após salvar (esperar 5-60 minutos):

```bash
# Seu computador - Terminal
nslookup app.starkentecnologia.com

# Esperado:
# Server: 8.8.8.8
# Address: 8.8.8.8#53
# Name: app.starkentecnologia.com
# Address: 187.77.46.199
```

---

## 🚨 Casos Especiais no Registro.br

### Caso 1: Há um campo "TTL" separado

Deixe como está (geralmente 3600)

### Caso 2: Há um campo "Prioridade" (MX)

Ignore (é só para email)

### Caso 3: Há um campo "Peso" ou "Porta" (SRV)

Ignore (não precisa)

### Caso 4: Está pedindo "Senha" ou "Autorização"

- Digite a senha de controle do domínio
- Ou confirme por email/SMS

---

## 📱 Interface Diferentes do Registro.br

O Registro.br teve atualizações, então pode estar em:

### Interface Antiga:
```
"Editar zona"
→ Tabela com registros
→ "Adicionar novo"
→ Formulário simples
```

### Interface Nova:
```
"Gerenciar DNS"
→ Visual mais moderno
→ "+" para adicionar
→ Formulário com mais opções
```

**Em ambos**: o processo é o MESMO

---

## 🎯 Resumo Rápido

```
1. Meus Domínios → starkentecnologia.com
2. Zona DNS / Editar DNS
3. Botão "Adicionar"
4. Preencher:
   Host: app
   Tipo: A
   Valor: 187.77.46.199
   TTL: 3600
5. Salvar
6. Esperar 5-60 min
7. Verificar: nslookup app.starkentecnologia.com
```

---

## 📞 Precisa de Ajuda?

**Descreva**:
- O que você vê na tela (ou screenshot)
- Qual menu está usando
- Que botões estão disponíveis

E vou guiá-lo de novo!

---

**Você consegue!** 💪

Próximo passo após DNS: SSH na VPS e executar SETUP-VPS.md

---

*Versão: 2.0.0*
