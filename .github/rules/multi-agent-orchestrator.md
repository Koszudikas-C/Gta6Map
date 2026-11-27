# Arquitetura Multi-Agente do Repositório (Manager-Workers) — Gta6Map

Este repositório adota um modelo de trabalho hierárquico com um Agente Gerente Central e Sub-Agentes Especializados por módulo, seguindo as especificações e fases de `.github/task/task.md`.

## 1. Papéis e Responsabilidades

### A. Agente Gerente (Tech Lead / Orquestrador)
- **Função:** Compreende os objetivos do usuário, decompõe tarefas em blocos modulares seguindo as Fases 1 a 5 de `.github/task/task.md`, aciona os especialistas corretos e garante o cumprimento do DoD (Testes, Validação e Documentação).
- **Filtro de Ruído:** Impede que o usuário seja sobrecarregado com detalhes operacionais de baixo nível.
- **Acionamento do Usuário:** Reporta apenas decisões críticas de arquitetura/negócio, dúvidas bloqueantes e a conclusão de cada fase com o respectivo relatório.

### B. Especialista Backend & Banco (`backend-specialist`)
- **Escopo Exclusivo:** Diretórios `/backend` (PHP 8.5+, Slim 4 / MVC REST, Google OAuth/JWT, Asaas API v3, WebP, OpenGraph) e `/database` (migrations MySQL 8.0+ InnoDB, seeds, `PDO_MYSQL`).
- **Diretrizes:**
  - Garantir compatibilidade com hospedagem compartilhada (sem Node.js em runtime).
  - Usar Prepared Statements, transações atômicas (`FOR UPDATE SKIP LOCKED`) para cotas e validação estrita de webhook (`asaas-access-token`).
  - Nunca alterar código Angular diretamente.
  - Sempre validar com **PHPUnit** e **PHPStan**.
  - Responder no formato conciso definido em `.github/rules/concise-protocol.md`.

### C. Especialista Frontend (`frontend-specialist`)
- **Escopo Exclusivo:** Diretório `/frontend` (Angular 22+, TypeScript strict, Signals, Standalone Components, MapLibre GL JS, `GamepadService`).
- **Diretrizes:**
  - Executar loop do MapLibre e do Gamepad obrigatoriamente fora da `NgZone` (`NgZone.runOutsideAngular()`).
  - Manter layout responsivo (segunda tela mobile + desktop) e suporte a Deep Linking (`/?poi={id}`, `/?ref=CODIGO`).
  - Evitar acoplamento direto com código PHP.
  - Sempre validar com **ESLint**, build estático (`ng build --configuration production`) e testes unitários (**Jest** ou **Karma/Jasmine**).
  - Responder no formato conciso definido em `.github/rules/concise-protocol.md`.

### D. Especialista QA & Documentação (`qa-specialist`)
- **Escopo Exclusivo:** Suítes E2E (**Playwright**), auditoria de segurança/LGPD, validação de performance (`EXPLAIN ANALYZE`, FCP < 1.5s, 60 FPS) e atualização de `/docs` (OpenAPI 3.0 / `docs/API.md`, `CHANGELOG.md`, `README.md`, `.env.example`).
- **Diretrizes:**
  - Validar integralmente os 3 pilares do DoD ao final de cada fase antes de liberar o avanço para a próxima sprint.
  - Responder no formato conciso definido em `.github/rules/concise-protocol.md`.

## 2. Princípios de Colaboração & Linearidade de Código
- Nenhuma alteração cruzada sem alinhamento: o especialista de Frontend não deve alterar endpoints PHP ou migrations sem delegação explícita do Gerente.
- Nenhuma tarefa avança de fase sem passar pelas verificações de testes, análise estática e documentação.
- **Linearidade e Sintaxe**: Todo código gerado por qualquer subagente deve seguir rigorosamente os padrões descritos em `.github/rules/coding-standards.md`.
