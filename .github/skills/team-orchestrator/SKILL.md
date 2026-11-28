---
name: team-orchestrator
description: >-
  Use this skill when orchestrating multi-module tasks across the Gta6Map project
  (GTA 6 Leonida Interactive Map) using specialized subagents (Backend/DB, Frontend, QA/Docs)
  under a central Manager agent.
---

# Team Orchestrator Skill — Gta6Map

Esta skill descreve o procedimento operacional padrão para o Agente Gerente orquestrar o time de especialistas no repositório **Gta6Map**, seguindo as especificações e fases de `.github/task/task.md`.

## Quando Usar
- Execução das Fases 1 a 5 do plano de sprints (Fundação MySQL/PHP, Google OAuth/JWT, MapLibre + Gamepad, Asaas + Cotas + Indique e Ganhe, Backoffice Admin).
- Tarefas que envolvem múltiplos módulos (`/frontend`, `/backend`, `/database`, `/docs`).
- Validação técnica cruzada e cumprimento do **Definition of Done (DoD)** obrigatório (Testado, Validado e Documentado).

## Procedimento de Execução

1. **Decomposição da Demanda:**
   - Consultar a fase atual e critérios de aceite em `.github/task/task.md`.
   - Dividir em subtarefas atômicas atribuídas a:
     - `backend-specialist` (`/backend` PHP 8.5+ e `/database` MySQL)
     - `frontend-specialist` (`/frontend` Angular 22+, MapLibre GL JS, Gamepad API)
     - `qa-specialist` (PHPUnit/Jest/Playwright, PHPStan/ESLint, LGPD/segurança e `/docs`)

2. **Invocação dos Especialistas:**
   - Disparar cada sub-agente com instruções diretas, arquivos-alvo específicos e critérios de aceite.
   - Exigir que o código siga `.github/rules/coding-standards.md` e o retorno siga `.github/rules/concise-protocol.md`.

3. **Avaliação do Gerente (Gate de DoD):**
   - Analisar o relatório do sub-agente.
   - **Regra Obrigatória de Testes (Bug & Feature)**: Exigir que toda correção de bug e toda nova funcionalidade entregue **testes unitários + testes E2E (Playwright)** novos ou atualizados para evitar regressões, além de executar build + unit + E2E antes de encerrar.
   - Garantir que os 3 pilares do DoD (Testes, Validação estática/segurança, Documentação) foram cumpridos antes de avançar para a próxima fase.
   - Se houver dúvida impeditiva de negócio, consolidar e perguntar ao usuário.

4. **Fechamento e Reporte ao Usuário:**
   - Emitir o relatório executivo (máximo 1 parágrafo de resumo + checklist de módulos + status do DoD).
   - Apresentar a próxima fase/tarefa proposta e aguardar confirmação quando necessário.
