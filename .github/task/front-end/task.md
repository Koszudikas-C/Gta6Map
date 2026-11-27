Abaixo está o **Anexo de Design System, UX Multiplataforma e Observabilidade**, estruturado para ser entregue diretamente ao seu agente junto ao levantamento anterior. Ele define regras visuais rígidas para evitar estética genérica de "site feito por IA", garante ergonomia real em **Console/TV, Celular e Desktop** e estabelece uma camada profissional de **logs e monitoramento** compatível com hospedagem compartilhada.

---

## 1. Diretriz Anti-Estética "Feito por IA" (Regras Visuais Obrigatórias)

Sites gerados por IA costumam cair em clichês fáceis de identificar (cards todos iguais com bordas arredondadas exageradas, roxo/ciano genérico, emojis como ícones e sombras difusas). Para o site parecer um **companion app oficial da Rockstar / HUD tático de Leonida**, o agente deve seguir estas restrições:

* **Proibido:**
* Usar emojis como ícones de interface ou categorias de mapa.
* Usar gradientes "cyberpunk roxo/azul" genéricos de template SaaS.
* Usar *border-radius* exagerado (`rounded-2xl` / `rounded-3xl`) em tudo. A estética de GTA é mais **editorial, angular e tática** (`2px` a `6px` de raio, ou cantos chanfrados com `clip-path`).
* Colocar o mapa dentro de uma "caixa pequena" cercada de textos e cards de marketing. **O mapa é 100% da tela (`100dvw x 100dvh`)** — a interface flutua sobre ele como um **HUD de jogo**.


* **Obrigatório:**
* **Ícones SVG Customizados e Crisp:** Utilizar **Lucide Icons** (stroke `1.75px`) para controles de UI e um spritesheet SVG próprio para os POIs do jogo (armas, carros, colecionáveis, lojas).
* **Microtexturas e Contraste Real:** Usar superfície *Asphalt Dark* (`#0D0F14`) com ruído sutil (SVG noise a 2% de opacidade) nos painéis laterais e divisórias finas de `1px` (`rgba(255,255,255,0.08)`), remetendo a um GPS/tablet tático.
* **Hierarquia Tipográfica Forte:** Misturar títulos condensados em caixa alta (clima pôster de Vice City) com números em fonte monoespaçada (`tabular-nums`) para coordenadas, dinheiro da meta e números de cota.



---

## 2. Identidade Visual GTA 6 (Paleta, Tipografia e CSS3 Moderno)

### Paleta de Cores "Leonida Sunset & Tactical HUD"

Inspirada na arte oficial de GTA 6 (pôr do sol de Miami, asfalto quente e neon sutil — sem poluir a leitura do mapa):

| Token CSS | Hex | Uso na Interface |
| --- | --- | --- |
| `--bg-asphalt` | `#0B0D12` | Fundo principal, modais e barra lateral (dark mode nativo). |
| `--bg-surface` | `#141821` | Painéis flutuantes (HUD), cards de POI e dropdowns. |
| `--vice-coral` | `#FF4D6D` | Cor primária de ação (botão VIP, pin selecionado, destaque ativo). |
| `--leonida-sunset` | `#FF9E44` | Gradiente sutil apenas na barra de meta do PS5 Pro e selos VIP/Fundador. |
| `--ocean-cyan` | `#00D2D3` | Cor secundária tática (rotas traçadas, modo explorador 3D, foco do Joystick). |
| `--text-primary` | `#F4F6FA` | Textos principais e títulos (alto contraste para leitura na TV/Console). |
| `--text-muted` | `#8E98A8` | Metadados, descrições secundárias e labels. |
| `--status-success` | `#22C55E` | PIX confirmado, POI marcado como encontrado. |

### Tipografia (Google Fonts — Leves, Gratuitas e Fiéis ao Clima do Jogo)

* **Display / Títulos e Bairros:** **`Barlow Condensed`** ou **`Teko`** (Peso `700`/`800`, `text-transform: uppercase`, `letter-spacing: 0.04em`) — entrega o peso editorial e urbano característico dos menus de GTA.
* **UI / Corpo de Texto:** **`Inter`** ou **`Plus Jakarta Sans`** — legibilidade impecável em telas pequenas de celular e à distância na TV.
* **Dados Táticos (Coordenadas, Cotas `#532`, Meta `R$ 12.000`):** **`JetBrains Mono`** com `font-variant-numeric: tabular-nums` (evita que os números "pulem" quando o contador atualiza).

### Stack de CSS3 Moderno e Bibliotecas no Angular

* **Estilização:** **Tailwind CSS v4** (ou SCSS modular com Design Tokens via CSS Variables `:root`).
* **Componentes Acessíveis (Headless):** **Angular CDK** (`Overlay`, `A11y / FocusTrap`, `Dialog`) combinado com **Spartan UI** ou **PrimeNG (modo Unstyled/Tailwind)**. Evite Angular Material padrão (ele deixa o site com cara de sistema corporativo do Google).
* **Recursos CSS3 Modernos Obrigatórios:**
* `100dvh` (Dynamic Viewport Height) para evitar que a barra do navegador no celular corte o HUD inferior.
* **CSS Container Queries (`@container`)** nos cards de POI e modais para adaptação fluida.
* **View Transitions API** e `transform`/`opacity` acelerados por GPU para abrir/fechar painéis sem travar o WebGL do mapa.
* `backdrop-filter: blur(12px) saturate(140%)` **apenas** em painéis pequenos (HUD flutuante), desativado automaticamente em dispositivos de baixo desempenho via `@media (prefers-reduced-transparency)` ou toggle de performance.



---

## 3. Usabilidade Multiplataforma (Console/TV, Celular e Desktop)

O site precisa detectar o contexto de uso e adaptar a ergonomia automaticamente:

| Dispositivo | Perfil de Uso | Regras de UX / Layout |
| --- | --- | --- |
| **Console / TV (Joystick)** | Jogador a 2–3 metros da tela usando navegador ou PC na TV (10-Foot UI). | • **Safe Area (Overscan):** Margem interna de `32px` nas bordas da tela.<br>

<br>• **Foco Visível de Alto Contraste:** Anel de foco em `--ocean-cyan` (`3px solid` + leve glow) obrigatório em todo botão/aba navegável.<br>

<br>• **Mira Central Fixa:** Ao usar o analógico esquerdo, o mapa desliza sob uma mira central tática; ao passar sobre um POI, um mini-card aparece instantaneamente (sem precisar "mirar" um cursor pequeno).<br>

<br>• **Barra de Legendas de Botões (Bottom HUD):** Exibe ícones dinâmicos (`[X] Marcar`, `[R3] Visão 3D`, `[L1/R1] Filtros`) apenas quando o gamepad está ativo. |
| **Celular (Mobile)** | Segunda tela na mão enquanto joga no PS5/Xbox. | • **Zona do Polegar (Bottom Sheet):** Busca, filtros rápidos e botão de "Modo 3D" ficam ancorados na **parte inferior** da tela (estilo Google Maps/Waze), nunca no topo.<br>

<br>• **Gaveta Deslizável (Draggable Sheet):** Ao tocar em um POI, abre um painel inferior compacto (30% da tela) que pode ser arrastado para cima para ver fotos e comentários sem sair do mapa.<br>

<br>• **Alvos de Toque:** Botões com mínimo de `44x44px`. |
| **Desktop** | Jogador em segundo monitor ou planejando rotas de 100%. | • **Sidebar Retrátil à Esquerda (`320px`):** Lista de categorias, busca instantânea (`Ctrl+K` ou `/`), progresso e switcher de Saves VIP.<br>

<br>• **Atalhos de Teclado:** `WASD` / Setas para mover, `Esc` fecha modais, `3` alterna câmera 2D/3D, `H` oculta toda a interface (Modo Cinema/Mapa Limpo). |

---

## 4. Observabilidade, Logs e Monitoramento (Hospedagem Compartilhada)

Para ter visibilidade total de erros, pagamentos do Asaas e performance do mapa sem depender de infraestrutura cara (como Datadog ou ELK Stack), o agente deve implementar uma **camada de observabilidade em 3 níveis**:

### Nível 1: Logs Estruturados no Backend (PHP + Monolog)

* Utilizar **Monolog** configurado com `JsonFormatter` e rotação diária automática (`RotatingFileHandler`, mantendo 30 dias em `/storage/logs/` fora da pasta `public_html`).
* **Correlation ID (`X-Request-ID`):** Todo request recebe um UUID único que é gravado nos logs e devolvido no header da resposta, facilitando rastrear qualquer bug relatado por usuário.
* **Canais de Log Separados:**
* `app.log` — Erros de aplicação, exceções PHP, falhas de login Google.
* `asaas-webhook.log` — **Auditoria Financeira Obrigatória:** registra 100% dos payloads recebidos do Asaas, status de validação do token, tempo de processamento e IDs das cotas geradas (mascarando CPF/dados sensíveis para LGPD).
* `security.log` — Tentativas de acesso não autorizado ao `/admin`, falhas de token no webhook, estouro de *Rate Limit* e bloqueios de upload inválido.
* `slow-query.log` — Qualquer consulta ao PostgreSQL que ultrapassar **200ms** é logada automaticamente com os parâmetros anonimizados.



### Nível 2: Telemetria e Erros no Frontend (Angular)

* Implementar um **`GlobalErrorHandler`** customizado no Angular + **HTTP Interceptor**:
* Captura exceções não tratadas de JavaScript, falhas de carregamento de *tiles* WebP, erros de contexto WebGL (GPU perdida) e falhas de API (`4xx`/`5xx`).
* Envia relatórios leves em lote (*debounced*) para **Sentry (plano gratuito)** ou para um endpoint próprio `POST /api/telemetry/client-error` com: rota atual, tipo de dispositivo (Mobile/Desktop/Gamepad conectado), versão do build e stack trace.


* **Métrica de Performance Real (RUM):** Registrar no console/telemetria o tempo de carregamento inicial do mapa e alertas caso o FPS do MapLibre caia abaixo de 30 FPS por mais de 5 segundos.

### Nível 3: Saúde do Sistema e Painel de Logs no `/admin`

* **Endpoint de Healthcheck (`GET /api/health`):** Verifica conexão ativa com PostgreSQL, espaço livre em disco (para uploads WebP/logs) e status do cache de POIs. Pode ser monitorado gratuitamente a cada 5 minutos pelo **UptimeRobot** com alerta no WhatsApp/Telegram caso o site caia.
* **Visualizador de Auditoria no `/admin`:** Uma aba simples no painel administrativo lendo os últimos eventos críticos (tabela `audit_logs` no PostgreSQL) mostrando:
* Últimos webhooks do Asaas (Sucesso / Falha / Ignorado por duplicidade).
* Últimas cotas alocadas e bônus de indicação disparados.
* Ações administrativas (quem criou/editou/aprovou cada POI).



---

## 5. Critérios Extras de Validação para o Agente (Atualização do DoD)

Adicionar ao protocolo de conclusão de cada tarefa do agente:

1. **Auditoria Lighthouse:** Pontuação mínima de **90+ em Performance**, **90+ em Acessibilidade** e **90+ em SEO** no build de produção.
2. **Teste de Navegação 100% sem Mouse:** Validar que é possível abrir filtros, mover o mapa, ativar a câmera 3D e marcar um POI usando apenas teclado ou emulador de Gamepad.
3. **Teste de Observabilidade:** Verificar se um erro forçado na API gera entrada JSON válida com `request_id`, sem vazar CPF, token do Asaas ou stack trace para o usuário final em produção (`APP_ENV=production`).

Se quiser, posso agora **unificar o Levantamento de Requisitos (Parte 1) + este Guia de Design e Observabilidade (Parte 2)** em um único arquivo **Markdown (`.md`) ou PDF** pronto para você entregar diretamente ao seu agente e ao cliente. Deseja que eu gere esse arquivo consolidado?