# Padrões de Código e Linearidade Estrutural (Gta6Map — Leonida)

Este documento define as diretrizes obrigatórias de sintaxe, estrutura, qualidade e **Definition of Done (DoD)** para todos os subagentes e módulos do projeto **Gta6Map** (Plataforma de Mapa Interativo GTA 6 — Leonida), conforme especificado em `.github/task/task.md`.

---

## 1. Linearidade Geral & Contratos Transversais

1. **Separação Rígida de Responsabilidades (Monorepo)**:
   - `/frontend`: Aplicação SPA em **Angular 22+** (build estático para hospedagem compartilhada).
   - `/backend`: API RESTful stateless em **PHP 8.5+** (compatível com Apache/Nginx em hospedagem compartilhada, sem Node.js em runtime).
   - `/database`: Migrações SQL versionadas (**MySQL 8.0+ / InnoDB**) e seeds.
   - `/docs`: Documentação técnica (**OpenAPI 3.0** / `docs/API.md`), dicionário de dados e manuais.
   - Nenhuma alteração cruzada de arquitetura deve ser feita sem alinhamento prévio via Agente Gerente.
2. **Idioma & Localização**:
   - Público-alvo Brasil (`pt-BR`, moeda `BRL`, domínio `.com.br`).
   - **Padrão de Commits**: Sempre em inglês seguindo Conventional Commits: `feat(...)`, `fix(...)`, `refactor(...)`, `test(...)`, `chore(...)`, `docs(...)`.
3. **Protocolo Obrigatório de Conclusão (Definition of Done — DoD)**:
   - Nenhuma tarefa é considerada concluída sem cumprir os 3 pilares:
     1. **Totalmente Testado**: PHPUnit (backend) + Jest/Jasmine & Playwright E2E (frontend).
     2. **Totalmente Validado**: Critérios de aceite, análise estática (**PHPStan** e **ESLint + TS strict** com 0 erros críticos), segurança e performance.
     3. **Totalmente Documentado**: OpenAPI / `docs/API.md`, migrations em `database/migrations/`, `CHANGELOG.md`, `README.md` e `.env.example`.

---

## 2. Frontend (`/frontend`) — Angular 22+ & MapLibre GL JS

1. **Paradigmas Reativos**:
   - Utilizar **Signals** (`signal()`, `computed()`) para gerenciamento de estado local e reatividade de componentes.
   - Utilizar RxJS para fluxos assíncronos e HTTP, tratando cancelamentos e erros (`catchError`, `takeUntilDestroyed`).
2. **Injeção de Dependências & Componentes**:
   - Adotar exclusivamente `inject(Service)` em propriedades de classe.
   - Componentes **Standalone** com `imports: [...]` explícitos e `ChangeDetectionStrategy.OnPush` sempre que possível.
3. **Motor de Mapa (MapLibre GL JS) & Gamepad API**:
   - Uso obrigatório de `NgZone.runOutsideAngular()` para o loop de renderização do mapa WebGL (60 FPS) e polling do `GamepadService` (`requestAnimationFrame`).
   - Suporte a visão 2D e 2.5D/3D (`pitch` até 65°, `bearing` 360°), *tiles* WebP `512x512` com *lazy loading* e modo explorador.
4. **Build Estático & Tipagem Estrita**:
   - Sem uso de `any` em interfaces de API ou contratos; tipagem estrita em `src/app/core/models/`.
   - Build de produção validado com `ng build --configuration production` (FCP < 1.5s).

---

## 3. Backend (`/backend`) — PHP 8.5+ & MySQL

1. **Arquitetura RESTful Stateless**:
   - Slim Framework 4 ou arquitetura MVC REST limpa, compatível com hospedagem compartilhada.
   - Autenticação via **Google Identity Services (OAuth 2.0)** com validação de ID Token no PHP e emissão de **JWT**.
   - Endpoints públicos com detecção de bots sociais (WhatsApp, Discord, Googlebot) para injeção dinâmica de Meta Tags OpenGraph.
2. **Banco de Dados (`PDO_MYSQL` / MySQL 8.0+ InnoDB)**:
   - Uso exclusivo de **Prepared Statements** (prevenção contra SQL Injection).
   - Alocação de cotas (`000–999`) obrigatoriamente atômica: `START TRANSACTION ... SELECT ... FOR UPDATE SKIP LOCKED ... COMMIT`.
   - Consultas indexadas validadas com `EXPLAIN` / `EXPLAIN ANALYZE`.
3. **Pagamentos (Asaas API v3) & Segurança / LGPD**:
   - Descrição obrigatória enviada ao Asaas: `"Assinatura Plano Fundador - Acesso VIP Mapa Interativo"` (nunca mencionar "rifa" ou "aposta").
   - Webhook `POST /api/webhooks/asaas` validando estritamente `asaas-access-token` e garantindo idempotência por `asaas_payment_id UNIQUE`.
   - Upload de imagens com sanitização e conversão automática para **WebP** (máx. 300 KB).
   - Proteção XSS/CORS/CSRF, *Rate Limiting* em cobranças/sugestões e mascaramento de CPF/dados sensíveis em logs e auditoria pública (LGPD).
