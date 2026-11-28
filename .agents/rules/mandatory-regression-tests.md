---
trigger: always_on
---

# Regra Obrigatória: Testes Unitários e E2E após Cada Bug e Feature

Em qualquer alteração no projeto **Gta6Map** (correção de bug, melhoria de UX/controle ou nova funcionalidade):

1. **Testes Obrigatórios Antes de Concluir**:
   - **Bug corrigido**: criar ou atualizar pelo menos **1 teste unitário** (`*.spec.ts` / PHPUnit) e **1 teste E2E** (`frontend/e2e/*.spec.ts` no Playwright) que reproduzam e garantam que a regressão não volte a acontecer.
   - **Nova feature**: criar ou atualizar **testes unitários** para a lógica/serviços e **testes E2E** cobrindo o fluxo completo do usuário (incluindo desktop, mobile ou joystick/gamepad quando aplicável).

2. **Validação Obrigatória Pós-Edição**:
   - Sempre executar após a última edição e reportar o resultado real:
     - `npm run build -- --configuration production`
     - `npm test -- --watchAll=false`
     - `npm run e2e`
   - Não considerar nenhuma entrega concluída se qualquer teste unitário ou E2E estiver falhando ou sem cobertura para o bug/feature implementado.
