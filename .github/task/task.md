# Especificação Técnica e Levantamento de Requisitos — Plataforma de Mapa Interativo GTA 6 (Leonida)

Este documento define o escopo completo, a arquitetura, as regras de negócio, o esquema de banco de dados (**PostgreSQL**) e o **Protocolo Obrigatório de Execução e Qualidade (Testes, Validação e Documentação)** para desenvolvimento por agente autônomo.

---

## 1. Visão Geral e Diretrizes para o Agente

* **Objetivo:** Construir uma aplicação web de mapa interativo 2.5D/3D de alta performance para os pontos de interesse (POIs) de GTA 6 (Leonida), com suporte nativo a navegação por **Joystick**, monetização via **Plano Fundador (VIP em nuvem)** integrado ao **Asaas**, sistema de indicação (**Indique e Ganhe**) e apuração transparente de sorteio promocional (PS5 Pro) vinculada à **Loteria Federal**.
* **Público-Alvo:** Brasil (idioma `pt-BR`, moeda `BRL`, domínio principal `.com.br`).
* **Restrição de Infraestrutura:** Compatível com **hospedagem compartilhada** (Apache/Nginx + PHP 8.2+ + PostgreSQL). Não utilizar Node.js em tempo de execução no servidor.

### Protocolo Obrigatório de Conclusão de Tarefas (Definition of Done — DoD)

> **REGRA INEGOCIÁVEL PARA O AGENTE:** Nenhuma tarefa ou módulo pode ser considerado concluído sem cumprir integralmente os 3 pilares abaixo. O agente **não deve avançar** para a próxima etapa até que a atual passe por todas as verificações.

1. **Totalmente Testado:**
* **Backend (PHP):** Testes unitários e de integração com **PHPUnit** cobrindo fluxos de sucesso, falhas, validação de payload, idempotência de webhooks e regras anti-fraude.
* **Frontend (Angular):** Testes unitários (**Jest** ou **Karma/Jasmine**) para serviços (Gamepad, Auth, MapService, API) e testes E2E (**Playwright**) para fluxos críticos (login, filtros do mapa, checkout PIX simulado).


2. **Totalmente Validado:**
* Verificação de todos os Critérios de Aceite da tarefa.
* Análise estática de código (**PHPStan** no backend; **ESLint + TypeScript strict mode** no frontend) com zero erros críticos.
* Validação de segurança (prevenção contra SQL Injection via Prepared Statements, validação de token de webhook, sanitização de uploads e proteção XSS/CORS).
* Validação de performance (build estático otimizado, renderização WebGL sem vazamento de memória e consultas SQL indexadas com `EXPLAIN ANALYZE`).


3. **Totalmente Documentado:**
* Atualização da documentação técnica da API (**OpenAPI 3.0 / Swagger** ou `docs/API.md`) com exemplos de request/response.
* Scripts de migração SQL versionados (`database/migrations/`) e diagrama/dicionário de dados atualizado.
* Registro da conclusão no `CHANGELOG.md` e instruções de configuração/deploy no `README.md` (incluindo variáveis de ambiente no `.env.example`).



---

## 2. Stack Tecnológica e Arquitetura

| Camada | Tecnologia | Diretriz de Implementação |
| --- | --- | --- |
| **Frontend** | **Angular 22+** (Standalone Components) | Build estático (`ng build --configuration production`) servido diretamente pela hospedagem. Uso obrigatório de `NgZone.runOutsideAngular()` para o loop do mapa e do Gamepad. |
| **Motor de Mapa** | **MapLibre GL JS** (WebGL) | Suporte nativo a 2.5D/3D (`pitch` até 65°, `bearing` 360°), extrusão de prédios em GeoJSON e carregamento de *tiles* raster `512x512` em **WebP** (`tiles/{z}/{x}/{y}.webp`). |
| **Backend** | **PHP 8.5+** (Slim Framework 4 ou Arquitetura MVC REST limpa) | API RESTful stateless com JWT (para sessão pós-Google OAuth) e driver `PDO_PGSQL`. |
| **Banco de Dados** | **MySQL 15+** | Uso de `UUID` / `BIGSERIAL`, colunas `JSONB` para metadados flexíveis, índices `GIN` e `BTREE`, e transações ACID com `SELECT ... FOR UPDATE` para sorteio de cotas. |
| **Autenticação** | **Google Identity Services (OAuth 2.0)** | Login em 1 clique no frontend; validação do ID Token no backend PHP. |
| **Pagamentos** | **Asaas API v3** | Integração via cURL/Guzzle em PHP (PIX QR Code/Copia e Cola + Cartão de Crédito) e Webhook assíncrono autenticado. |
| **CDN / Cache** | **Cloudflare (Free Tier)** | Cache de borda para a pasta `/tiles/` e assets estáticos, protegendo CPU e banda da hospedagem compartilhada. |

---

## 3. Requisitos Funcionais (RF)

### Módulo 1: Mapa Interativo 2.5D/3D e Personalidade

* **RF01 — Renderização de Tiles e 3D:** Carregar mapa base de alta resolução fatiado em *tiles* WebP sob demanda (*lazy loading*). Permitir alternar entre visão 2D superior e visão 2.5D/3D (inclinação de câmera + camadas de prédios 3D extrudados via GeoJSON).
* **RF02 — Modo Explorador ("Bonequinho" / Street Perspective):** Permitir arrastar um marcador de personagem (ou ativar via botão `R3` no joystick) para qualquer ponto do mapa, acionando uma animação suave (`flyTo`) com câmera baixa (`pitch: 65°`, zoom máximo) e rotação livre em 360°. Deixar suporte estrutural pronto para abrir visualizador panorâmico 360° caso o POI possua `panorama_url` preenchido.
* **RF03 — Pontos de Interesse (POIs) e Filtros:** Exibir categorias (Armas, Colecionáveis, Missões, Lojas, Easter Eggs, Eventos) com busca textual, contadores de progresso e renderização em WebGL/Canvas (suportando > 2.000 pins a 60 FPS).
* **RF04 — Checklist de Progresso (Free vs. VIP):**
* *Usuário Gratuito:* Progresso salvo apenas em `LocalStorage` (limite de até 15 marcações simultâneas; exibição de banners discretos).
* *Usuário VIP (Plano Fundador):* Sincronização automática em nuvem no PostgreSQL, marcações ilimitadas, múltiplos perfis de save (ex: *História*, *Platina*), pins personalizados com anotações privadas, planejador de rotas otimizadas entre colecionáveis e navegação sem anúncios.


* **RF05 — Deep Linking e SEO Dinâmico:** Ao selecionar um POI, atualizar a URL (`/?poi={id}` ou `/?x={x}&y={y}&z={z}`). O backend PHP deve detectar bots sociais (WhatsApp, Discord, Googlebot) e injetar Meta Tags OpenGraph dinâmicas com título, descrição e imagem do ponto.

### Módulo 2: Acessibilidade e Navegação por Joystick (Gamepad API)

* **RF06 — Detecção e Controle Nativo:** Implementar serviço dedicado no Angular usando `window.navigator.getGamepads()` com `requestAnimationFrame` fora da `NgZone` (suporte a DualSense, Xbox e controles genéricos).
* **RF07 — Mapeamento de Comandos:**
* *Analógico Esquerdo:* Mover câmera (*pan*) / cursor virtual central no mapa (com zona morta configurável de `0.15`).
* *Analógico Direito:* Eixo Y controla Zoom In/Out; Eixo X controla rotação 360° (`bearing`); segurando `L2/LT` + Analógico Direito controla inclinação 3D (`pitch`).
* *L1 / R1 (LB / RB):* Navegar entre abas e categorias de filtros.
* *Botão X / A:* Selecionar POI sob a mira, abrir modal de detalhes ou marcar como "encontrado".
* *Botão R3 (clique do analógico direito):* Alternar entre Visão Aérea e Modo Explorador 3D (câmera baixa).


* **RF08 — HUD Dinâmico:** Exibir ícones de botões correspondentes ao controle conectado assim que qualquer input do gamepad for detectado.

### Módulo 3: Autenticação e Perfil

* **RF09 — Login Exclusivo com Google:** Autenticação em 1 clique via Google OAuth 2.0, importando `google_id`, `nome`, `email` e `avatar_url`.
* **RF10 — Dados Complementares:** Campo opcional de texto livre para `psn_id` / `gamertag` no perfil. Coleta de **CPF** e **WhatsApp** apenas no modal pré-checkout do Asaas (salvos no perfil após a primeira compra).

### Módulo 4: Plano Fundador, Pagamentos (Asaas) e Meta do PS5 Pro

* **RF11 — Planos e Meta Financeira:**
* Meta global configurável (padrão: **R$ 12.000,00** = 800 cotas pagas de R$ 15,00).
* Exibição de barra de progresso em tempo real na interface.
* Pacotes configuráveis: **R$ 15,00** (VIP + 1 número), **R$ 35,00** (VIP + 3 números), **R$ 60,00** (VIP + 6 números).
* **Conformidade de Gateway:** A descrição enviada ao Asaas deve ser obrigatoriamente `"Assinatura Plano Fundador - Acesso VIP Mapa Interativo"` (nunca mencionar "rifa" ou "aposta").


* **RF12 — Checkout e Webhook Asaas:**
* Geração de cobrança PIX (retornando QR Code Base64 + Copia e Cola) e Cartão de Crédito via API v3 do Asaas.
* Endpoint `POST /api/webhooks/asaas` validando o cabeçalho `asaas-access-token`.
* Ao receber `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`: ativar status VIP do usuário, gerar automaticamente os números da sorte disponíveis na faixa `000`–`799` dentro de uma transação PostgreSQL (com lock para evitar duplicidade) e processar bônus de indicação.


* **RF13 — Apuração Transparente (Loteria Federal):**
* Faixa total de números: `000` a `999` (`000–799` para compras pagas; `800–999` reservados para bônus de indicação).
* Ao atingir 100% da meta, travar novas aquisições de cotas e exibir na home o número e a data do próximo concurso da **Loteria Federal**.
* Regra de extração documentada na interface: 3 últimos dígitos do 1º prêmio (fallback: 2º ao 5º prêmio ou número imediatamente superior vendido).
* Página pública de auditoria listando cotas confirmadas com nomes mascarados conforme LGPD (ex: `Lucas M. — Cota #532`).



### Módulo 5: Programa de Indicação (Indique e Ganhe)

* **RF14 — Rastreamento de Afiliado:** Cada usuário autenticado possui um código único (`referral_code`) e link compartilhável (`/?ref=CODIGO`). O frontend persiste o código em `LocalStorage`/Cookie por 7 dias.
* **RF15 — Recompensa e Anti-Fraude:**
* A indicação só é contabilizada após a confirmação financeira real via webhook do Asaas (exige CPF válido e pagamento confirmado).
* **Regra de Bônus:** A cada **2 amigos indicados com pagamento confirmado**, o indicador recebe automaticamente **+1 número da sorte bônus** (extraído da faixa `800–999`).
* Ranking público de "Top Indicadores" para premiação extra configurável ao bater a meta.



### Módulo 6: Backoffice Administrativo e Crowdsourcing

* **RF16 — Painel Admin (`/admin`):** Protegido por papel `role = 'ADMIN'`. Permite clicar diretamente no mapa para criar, mover ou editar POIs; upload de imagens com conversão automática no servidor PHP para **WebP**; gestão de usuários/cotas; e registro do concurso/ganhador da Loteria Federal.
* **RF17 — Sugestão da Comunidade:** Usuários logados podem sugerir novos POIs ou reportar erros em pontos existentes; o admin aprova ou rejeita com 1 clique no backoffice.

---

## 4. Requisitos Não Funcionais (RNF)

* **RNF01 — Performance:** *First Contentful Paint* (FCP) < 1.5s; taxa de quadros do mapa em 60 FPS; imagens de POIs convertidas para WebP com tamanho máximo de 300 KB.
* **RNF02 — Segurança e LGPD:** Senhas inexistentes (delegado ao Google OAuth); CPF criptografado ou mascarado em logs; proteção contra CSRF/XSS; *Rate Limiting* nos endpoints de criação de cobrança e sugestões; validação estrita de token no webhook do Asaas.
* **RNF03 — Concorrência e Integridade (PostgreSQL):** Alocação de números da sorte obrigatoriamente atômica (`BEGIN ... SELECT ... FOR UPDATE SKIP LOCKED ... COMMIT`) e idempotência garantida por `asaas_payment_id UNIQUE` para impedir geração dupla de cotas em reenvios de webhook.
* **RNF04 — Responsividade:** Layout adaptável para uso simultâneo no celular (segunda tela ao jogar no console) e desktop.

---

## 5. Modelagem Inicial do Banco de Dados (PostgreSQL)

O agente deve criar migrações versionadas contemplando, no mínimo, as tabelas abaixo:

```sql
-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(180) UNIQUE NOT NULL,
    avatar_url TEXT,
    psn_id VARCHAR(64),
    cpf VARCHAR(14),
    whatsapp VARCHAR(20),
    asaas_customer_id VARCHAR(64),
    role VARCHAR(20) NOT NULL DEFAULT 'USER', -- USER | ADMIN
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Categorias de POIs
CREATE TABLE poi_categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon_name VARCHAR(60) NOT NULL,
    color_hex VARCHAR(7) NOT NULL DEFAULT '#FF007F',
    sort_order INT NOT NULL DEFAULT 0
);

-- 3. Pontos de Interesse (POIs)
CREATE TABLE pois (
    id BIGSERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES poi_categories(id),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    coord_x DOUBLE PRECISION NOT NULL,
    coord_y DOUBLE PRECISION NOT NULL,
    image_url TEXT,
    panorama_url TEXT, -- NULL por padrão; preparado para futuro Street View 360
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED', -- PUBLISHED | PENDING | REJECTED
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pois_category ON pois(category_id);
CREATE INDEX idx_pois_status ON pois(status);
CREATE INDEX idx_pois_metadata ON pois USING GIN (metadata);

-- 4. Progresso em Nuvem e Pins Personalizados (VIP)
CREATE TABLE user_poi_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    save_slot VARCHAR(50) NOT NULL DEFAULT 'default',
    poi_id BIGINT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
    found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, save_slot, poi_id)
);

CREATE TABLE user_custom_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    notes TEXT,
    coord_x DOUBLE PRECISION NOT NULL,
    coord_y DOUBLE PRECISION NOT NULL,
    color_hex VARCHAR(7) DEFAULT '#00F0FF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Pagamentos (Asaas)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    asaas_payment_id VARCHAR(80) UNIQUE NOT NULL,
    package_code VARCHAR(30) NOT NULL, -- VIP_1 | VIP_3 | VIP_6
    amount_cents INT NOT NULL,
    quotas_count INT NOT NULL,
    billing_type VARCHAR(20) NOT NULL, -- PIX | CREDIT_CARD
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING | CONFIRMED | RECEIVED | REFUNDED
    pix_payload TEXT,
    pix_qr_base64 TEXT,
    webhook_payload JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

-- 6. Cotas / Números da Sorte (000 a 999)
CREATE TABLE raffle_quotas (
    quota_number SMALLINT PRIMARY KEY CHECK (quota_number >= 0 AND quota_number <= 999),
    pool_type VARCHAR(20) NOT NULL, -- PAID (000-799) | REFERRAL_BONUS (800-999)
    user_id UUID REFERENCES users(id),
    payment_id UUID REFERENCES payments(id),
    assigned_at TIMESTAMPTZ
);
CREATE INDEX idx_raffle_quotas_available ON raffle_quotas(pool_type) WHERE user_id IS NULL;

-- 7. Configurações Globais da Campanha / Meta
CREATE TABLE campaign_settings (
    key VARCHAR(60) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

```

---

## 6. Plano de Execução em Sprints para o Agente

O agente deve executar as fases sequencialmente. **Ao final de cada fase, gerar relatório de testes (PHPUnit/Jest/Playwright), relatório de validação e atualização de documentação antes de prosseguir.**

1. **Fase 1 — Fundação, Ambiente e Banco PostgreSQL:**
* Estruturar monorepo (`/frontend` Angular + `/backend` PHP + `/database` migrations + `/docs`).
* Configurar conexão `PDO_PGSQL`, migrations e seed inicial (incluindo pré-população dos 1.000 números `000`–`999` em `raffle_quotas` e categorias base).
* *Entrega:* Migrations testadas, conexão validada, `README.md` e `.env.example` documentados.


2. **Fase 2 — Autenticação Google OAuth e Perfil:**
* Implementar login Google no Angular + validação de ID Token e emissão de JWT no PHP.
* Criar geração automática de `referral_code` e captura de `?ref=`.
* *Entrega:* Testes unitários de auth/JWT, validação de segurança e documentação OpenAPI.


3. **Fase 3 — Motor de Mapa 2.5D/3D (MapLibre) + POIs + Joystick:**
* Configurar MapLibre GL JS fora da `NgZone` com *tiles* WebP, câmera 2.5D/3D, extrusão de prédios e Modo Explorador ("bonequinho").
* Implementar CRUD público de leitura de POIs (com cache JSON), filtros, busca, checklist (LocalStorage vs. Nuvem VIP) e Deep Linking com Meta Tags dinâmicas no PHP.
* Implementar `GamepadService` com HUD dinâmico.
* *Entrega:* Testes unitários do `GamepadService` e `MapService`, teste E2E de navegação/filtros e documentação de uso do controle.


4. **Fase 4 — Integração Asaas, Meta Coletiva, Cotas e Indique e Ganhe:**
* Implementar endpoints de checkout (PIX/Cartão), webhook autenticado e idempotente, alocação atômica de cotas (`FOR UPDATE SKIP LOCKED`), barra de progresso da meta e motor de bônus por indicação.
* Criar painel *"Minhas Cotas"* e página pública de transparência (Loteria Federal + nomes mascarados).
* *Entrega:* Testes de integração simulando payloads reais do Asaas (incluindo testes de concorrência/duplicidade e anti-fraude), validação LGPD e documentação completa do fluxo financeiro.


5. **Fase 5 — Backoffice Admin (`/admin`), Upload WebP e Crowdsourcing:**
* Implementar interface administrativa para gestão de POIs direto no mapa, conversão de imagens para WebP, aprovação de sugestões da comunidade e fechamento do sorteio (Loteria Federal).
* *Entrega:* Testes de permissão RBAC (`ADMIN` vs `USER`), testes de upload/sanitização, validação final de build estático para hospedagem compartilhada e manual de operação.


---

## 7. Roadmap de Versões Futuras (Pós-MVP) — Evolução Visual 3D

Itens planejados para evolução visual após a conclusão das Fases 1 a 5 (monetização, autenticação, POIs, cotas e admin):

1. **Céu Pôr-do-Sol & Iluminação Direcional Vice City (`v1.1`):**
   - Configurar `map.setSky(...)` com gradiente `#120B1E → #C9349B → #FFA66B` e névoa atmosférica ao inclinar a câmera em 3D (`pitch: 60°`).
   - Configurar `map.setLight(...)` com luz direcional quente e sombras suaves nos prédios extrudados.
2. **Estradas Vivas em 3D (`v1.1`):**
   - Sobrepor polilinhas GeoJSON (`type: 'line'`) nas rodovias principais e pontes usando `line-gradient` e `line-dasharray` animado fora da `NgZone`.
3. **Casas, Quarteirões e Torres em Múltiplos Níveis (`v1.2`):**
   - Gerar quarteirões e casas dentro das manchas urbanas reais (`geo.urban`) com `fill-extrusion-base` + `fill-extrusion-height` (pódio + torre), evitando áreas de água.
4. **Marcos Icônicos em `.glb` (`v1.3`):**
   - Renderizar pontos-chave (ex.: *Ocean View Hotel*, guindastes de Port Vice) com modelos 3D `.glb` via `Three.js` + `CustomLayerInterface` do MapLibre.
