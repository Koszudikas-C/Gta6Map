---
name: regression-testing
description: >-
  Procedimento obrigatório após corrigir qualquer bug ou implementar qualquer feature no Gta6Map:
  adicionar ou atualizar testes unitários (Jest/PHPUnit) e testes E2E (Playwright) para evitar regressões,
  e validar build, unit e E2E antes de finalizar.
---

# Regression Testing Skill — Gta6Map

Esta skill define o checklist obrigatório para impedir regressões recorrentes após qualquer correção de bug ou entrega de feature.

## Checklist Obrigatório

1. **Identificar a Regressão ou Comportamento Novo**:
   - Para **bugs**: traduzir exatamente o cenário que falhou (ex.: item da Mochila sumindo ao receber foco, botão não fechando modal, seleção no mapa) em uma asserção automatizada.
   - Para **features**: cobrir o caminho feliz e os principais casos de borda/interação (mouse, teclado, mobile e joystick/gamepad quando aplicável).

2. **Escrever os Testes**:
   - **Unitário (`frontend/src/**/*.spec.ts` ou backend PHPUnit)**: testar a lógica isolada no service/componente.
   - **E2E (`frontend/e2e/*.spec.ts`)**: testar o comportamento real no navegador via Playwright (visibilidade, estilos computados, navegação, abertura/fechamento de modais e interações no mapa).

3. **Executar a Verificação Completa**:
   ```powershell
   Push-Location frontend
   npm run build -- --configuration production
   npm test -- --watchAll=false
   npm run e2e
   Pop-Location
   ```
   - Só concluir a tarefa quando build, todos os testes unitários e todos os testes E2E passarem sem falhas.
