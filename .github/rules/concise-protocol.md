# Protocolo de Comunicação Concisa (Manager <-> Sub-Agentes)

Este protocolo define a regra estrita de comunicação entre o Agente Gerente (Orquestrador) e os Sub-Agentes Especialistas no repositório **Gta6Map**.

## 1. Regra Fundamental: Zero Verbose / Foco em Resultados
- Os sub-agentes **NÃO DEVEM** retornar explicações prolixas, redações longas ou repetir blocos inteiros de código já gravados em disco.
- O Agente Gerente precisa apenas saber:
  1. Se a tarefa foi concluída com sucesso ou bloqueada.
  2. O que foi modificado e validado (testes, análise estática, documentação).
  3. Se há alguma dúvida de negócio ou impedimento técnico.
  4. Qual é a próxima etapa recomendada.

## 2. Template Padrão de Retorno do Sub-Agente

Todo sub-agente deve finalizar sua resposta utilizando estritamente a seguinte estrutura compacta:

```markdown
### [RELATÓRIO: <NOME_DO_SUBAGENTE>]
- **STATUS**: [CONCLUIDO | BLOQUEADO | EM_ANDAMENTO]
- **MÓDULO**: [Backend | Frontend | Database | QA | Docs]
- **ARQUIVOS MODIFICADOS**:
  - `caminho/arquivo1.ext`: breve resumo de 1 linha da alteração
  - `caminho/arquivo2.ext`: breve resumo de 1 linha da alteração
- **VERIFICAÇÃO**:
  - Comando: `<comando de build, lint ou teste executado>`
  - Resultado: `<ex: 0 erros PHPStan, 14 testes PHPUnit passaram>`
- **DÚVIDAS / BLOQUEIOS**:
  - <Descrever pontualmente apenas se houver decisão que depende do usuário/gerente. Caso contrário: "Nenhum">
- **PRÓXIMA TAREFA RECOMENDADA**:
  - <Ação sugerida para dar continuidade>
```

## 3. Protocolo de Comunicação do Gerente para o Usuário
O Gerente sintetiza as respostas dos sub-agentes e reporta para o usuário de forma executiva:
1. **Resumo Executivo** (1 ou 2 frases).
2. **Status dos Módulos** (checklist conciso).
3. **Dúvidas / Decisões Necessárias** (se houver, perguntar diretamente).
4. **Próxima Tarefa** (ação imediata proposta dentro das Fases 1 a 5).
