# zrastreio — evolução da tela Rastreamento2

Projeto **SAP BTP Fiori freestyle UI5** (1.149.1, tema `sap_horizon`), evoluído a partir
do `zrastreio` existente. Não é um projeto novo: a cadeia de deploy original
(`mta.yaml`, `xs-app.json`, `ui5-deploy.yaml` com `ui5-task-zipper`, destination
`RASTREIO` + xsuaa) está preservada intacta, e as telas legadas `Rastreamento` e
`Rastreamento3` continuam no lugar, sem uma linha alterada. O que foi refeito é a
`Rastreamento2` — a rota padrão —, agora decomposta em oito telas dentro de uma
moldura única.

Tudo o que a aplicação mostra sai dos modelos e controllers que já existiam no
API_Hana. Nenhum campo foi inventado, nenhuma funcionalidade depende de dado que
o backend não entregue hoje.

---

## Como rodar em localhost

### 1. Descompactar e instalar

```bash
unzip zrastreio-evoluido.zip -d zrastreio-evoluido
cd zrastreio-evoluido
npm install
```

O `npm install` baixa o `@ui5/cli` e o `@sap/ux-ui5-tooling`. O Leaflet **não**
depende dele: as duas bibliotecas estão versionadas em `webapp/libs/` e carregam
pelo `index.html`, justamente para a aplicação subir mesmo numa máquina sem saída
para o registry.

### 2. Subir a aplicação

Dentro da rede corporativa, com o `10.44.32.193:4000` alcançável:

```bash
npm run start-noflp
```

Abre `http://localhost:8080/index.html`. O proxy declarado no `ui5.yaml` encaminha
`/rest` → `http://10.44.32.193:4000`, então o navegador nunca fala com o IP direto
e não há CORS nem mixed content.

Fora da rede corporativa (em casa, ou só para avaliar a interface):

```bash
npm run start-simulado
```

Equivale a `http://localhost:8080/index.html?mock=true`. Sobe com os dados de
`webapp/localService/mock/` — 105 equipamentos, 87 com rastreador, 15 veículos, 12
cercas, 8 gateways, 7.396 leituras — e a tela exibe uma tarja amarela dizendo que
os dados são simulados. Os nomes dos campos são os reais do API_Hana; só os
valores são fabricados.

Se você esquecer o `?mock=true` estando fora da rede, não quebra: o `Backend.js`
detecta a falha de rede na primeira chamada, cai sozinho no modo simulado e avisa
no console e na tela.

### 3. Conferir antes de entregar

```bash
npm run check
```

Encadeia as três verificações:

```
npm run test:regras   # 92 testes das regras de negócio, sem dependência externa
npm run validar       # 13 views, 25 módulos, 161 chaves i18n — XML, AMD e manifest
npm run integracao    # ponta a ponta sobre as fixtures, imprimindo os números
```

O `integracao` imprime o que a tela vai mostrar, o que permite ver se algum número
saiu absurdo antes de abrir o navegador.

### 4. Build e deploy (inalterados)

```bash
npm run build          # ui5 build --clean-dest --dest dist
npm run build:mta      # mbt build → mta_archives/
npm run deploy         # fiori cfDeploy
```

---

## Arquitetura

A moldura é um `sap.tnt.ToolPage` com navegação lateral persistente (`App.view.xml`).
Antes, cada uma das três telas montava a própria barra e as próprias abas, e trocar
de área perdia o contexto. `sap.tnt` é biblioteca padrão do UI5 — foi só declarada
no `manifest.json`, sem nova dependência de npm.

As regras de negócio ficam em `webapp/model/regras/`, em módulos `sap.ui.define`
puros, sem dependência de UI. É o que permite testá-las em Node sem navegador:

| módulo | responsabilidade |
|---|---|
| `prefixo.js` | os 4 primeiros caracteres de `LOCAL_INSTALACAO`, só de equipamento com rastreador |
| `arvore.js` | comparação por família contra a árvore SAP do veículo |
| `silencio.js` | 15 dias instalado em veículo, 7 dias fora |
| `confianca.js` | cruzamento de deslocamento real com o histórico de local declarado |
| `zonas.js` | hierarquia das cercas por contenção geométrica |
| `indicadores.js` | os índices e o texto que os explica |
| `relatorios.js` | os seis relatórios, cada um com pergunta, ação e colunas |

`webapp/service/Backend.js` centraliza os endpoints. No projeto original havia por
volta de 45 URLs escritas à mão dentro dos controllers, todas apontando para
`http://10.44.32.193:4000` e `:4004`; trocar de ambiente exigia varrer três
arquivos de milhares de linhas. Agora a base sai do `dataSources` do manifest e
cada caminho aparece uma vez. Os caminhos não foram renomeados — saem do
`app.use(...)` de cada controller do API_Hana, com a mistura de caixa original
preservada (`/Equipamentos`, `/equipamentos/local`, `/Gateway`).

`webapp/model/Frota.js` é um `JSONModel` compartilhado por todas as telas. Carrega
os dez endpoints de forma tolerante — um endpoint fora do ar degrada aquela seção,
não derruba a tela — e recalcula tudo quando o prefixo muda.

`webapp/service/MapaLeaflet.js` encapsula o mapa. Duas camadas apenas, Claro e
Satélite, ambas com nomes de ruas e lugares: a Claro é OpenStreetMap; a Satélite é
o `World_Imagery` da Esri com o overlay `World_Boundaries_and_Places` por cima, que
é o que põe o texto sobre a foto. Os três já estavam no código do projeto atual.

---

## Itens clicáveis → lista exportável para Excel

O padrão nasceu na Sala de Controle e agora vale para todas as telas novas:
**todo número ou item clicável abre um popup com a lista que o explica**, com
busca, botão **EXCEL** (exporta exatamente o que está na lista, já filtrado) e
**OK**. Dentro da lista:

- **equipamento** é link para a ficha (`RouteEquipamento`). Se o equipamento
  não tem rastreador (ou está fora do recorte de prefixo), aparece como texto,
  porque a ficha abriria vazia. Ao seguir para a ficha, os popups fecham;
- **gateway** é link para os equipamentos lidos por aquele gateway;
- **família, veículo e parcela do índice** são links para a lista seguinte
  (drill-down: veículo → árvore do veículo → componentes da família → ficha).

| Tela | O que é clicável |
|---|---|
| Sala de Controle | 6 cards, famílias da árvore por tipo, gateways no mini-mapa, EXCEL das últimas mudanças |
| Embarcados | 4 cards, famílias do veículo selecionado, EXCEL da árvore do veículo |
| Indicadores | índice geral (composição), cada parcela, avanço do piloto |
| Manutenção | 4 cards (notas, ordens, notas sem rastreador, cadastro divergente) |
| Relatórios | colunas Equipamento, Veículo e Gateway |
| Equipamento | gateway atual, gateways da linha do tempo, famílias da árvore; EXCEL da linha do tempo, notas, ordens e árvore |
| Mapa | gateways |

Onde fica:

- `model/regras/detalhamentos.js`: **o que** cada lista mostra. É um módulo
  puro, que lê o mesmo snapshot da frota que pinta os cards, então a lista
  sempre bate com o número clicado. Testado em
  `test/regras/detalhamentos.test.mjs` (`npm run test:detalhamentos`);
- `service/RelatorioPopup.js`: **como** a lista aparece (popup, busca, links,
  EXCEL);
- `BaseController`: `tornarClicavel(id, fn)` para cards,
  `abrirDetalhamento(nome, ...)`, `abrirFicha(codigo)` e `abrirGateway(id)`.

Para tornar um novo item clicável, declare a lista em `detalhamentos.js` e
chame `this.abrirDetalhamento("nomeDaLista")` no controller.

## Relatórios personalizados

Na tela **Relatórios**, a aba **Personalizados** permite que o usuário monte
relatórios próprios sobre os mesmos dados das telas. Por isso o número de um
relatório personalizado sempre bate com o de um card.

**Três tipos**

| Tipo | Para quê | Exemplo |
|---|---|---|
| **Métrica** | Parcelas P1…Pn (fonte + condições + contagem, soma, média, mín, máx, distintos ou verdadeiros) combinadas por uma fórmula | `P1 / P2` → "18 / 87 = 20,7%" |
| **Tabela dinâmica** | 1 ou 2 níveis de linhas, coluna cruzada opcional, vários valores, % do total, top N (o restante vira "Outros"), total | Rastreadores pelos 4 primeiros caracteres do local: FEIT 37 (42,5%) · FEMN 19 (21,8%)… |
| **Lista** | Registros filtrados com as colunas e a ordem escolhidas | Rastreadores mudos há mais de 30 dias |

- **Fórmula**: aceita `+ - * / ( )`, números com ponto e as funções `min`, `max`
  e `abs`. É interpretada sem `eval`. Divisão por zero dá "não medido", nunca 0%.
- **Métrica por grupo**: a mesma métrica, com uma linha por prefixo, família,
  situação etc.
- **Metas**: faixas de verde e amarelo, para os sentidos "maior é melhor" e
  "menor é melhor".
- **Agrupamentos**: valor inteiro, primeiros ou últimos N caracteres, faixas
  numéricas, dia, mês ou ano.
- **Gráfico**: barras, colunas, pizza ou linha, com `sap.viz`. Se a biblioteca
  não carregar, o gráfico sai como barras simples em HTML.
- **Todo número é clicável** e abre os registros por trás dele, com EXCEL e
  link para a ficha do equipamento. O resultado inteiro também exporta para
  Excel.

**Duas formas de criar**

- **Assistente**, em 5 passos:
  1. o que ver;
  2. sobre quais dados;
  3. o que calcular;
  4. como apresentar;
  5. nome e pré-visualização.

  O próximo passo só é liberado quando o atual está completo. O que o
  assistente monta pode ser aberto no editor completo.
- **Editor completo**, com a pré-visualização recalculada a cada alteração.

Também dá para começar de **8 modelos prontos**, entre eles os dois exemplos
do pedido, e **importar ou exportar a definição (.json)** para levar um
relatório de um ambiente a outro.

**Onde fica cada parte**

| Arquivo | Papel |
|---|---|
| `model/regras/campos.js` | catálogo de fontes, campos, operadores, agregações e agrupamentos |
| `model/regras/relatorioPersonalizado.js` | motor: filtros, agregação, fórmula, tabela dinâmica, metas, drill-down e modelos |
| `model/regras/editorRelatorio.js` | estado do editor e do assistente |
| `service/RelatoriosSalvos.js` | gravação: API_Hana `/relatorios`; no modo simulado, o navegador |
| `service/ResultadoRelatorio.js`, `service/GraficoRelatorio.js` | desenho do resultado e do gráfico |
| `controller/personalizados/Personalizados.js` | a aba, o editor e o assistente |
| `view/personalizados/*.fragment.xml` | editor e assistente |

Os testes do motor e do assistente (`npm run test:personalizados`) rodam o
`Frota.js` de verdade sobre as fixtures (`test/regras/frotaNode.mjs`). Eles
conferem que o modelo "Disponibilidade" dá o mesmo valor do indicador oficial
e que a tabela por localidade bate com o seletor de prefixo.

**Backend.** A rota `/relatorios` (GET, POST, PUT e DELETE) grava na tabela
`RelatoriosPersonalizados` do MySQL `db_MVP`, pelo mesmo Sequelize de
Gateway e Zonas. A tabela é criada pelo `sync()`. A biblioteca é compartilhada:
todos veem todos os relatórios, e o autor fica registrado. Se duas pessoas
editam o mesmo relatório ao mesmo tempo, a segunda gravação recebe **409** em
vez de sobrescrever a primeira. A exclusão é lógica. Os arquivos estão no
pacote `API_Hana_relatorios`.

## As regras, e por que elas são assim

**Recorte por prefixo.** Sempre os quatro primeiros caracteres de
`LOCAL_INSTALACAO`, apenas de equipamento que tem rastreador. A lista de opções sai
do `distinct` dos dados, não de uma constante, e o campo aceita digitação.
`FEIT-EMREF_EX…` é **FEIT** — o `_EMREF_EX` é conteúdo do local, não prefixo. Isso
contradiz de propósito o agrupamento do `onCardEmbarcadosPress` do código atual, que
trata o trecho como se fosse categoria.

**Cobertura da árvore.** O denominador nunca é o catálogo inteiro do SAP. Para cada
veículo onde há rastreador ativo, compara-se a quantidade de equipamentos com
rastreador, por tipo, contra a quantidade daquele tipo na árvore SAP do veículo.
Um conversor sobrando numa família não compensa um comando final faltando em outra
— `encontrados` e `cobertos` são grandezas separadas, exatamente porque um teste
pegou um veículo errado nas duas pontas exibindo 100% de aderência.

**Silêncio.** Quinze dias sem leitura quando o componente está instalado em veículo,
sete dias nos demais casos. Componente rodando em mina comunica menos, e alarmar no
terceiro dia produz ruído que ninguém lê.

**Confiança.** O `device.lat`/`device.lon` é coordenada GPS do device, requisitada
pelo gateway. A posição de referência é a **mediana** das leituras, não a média —
uma leitura ruim não desloca a mediana. Acima de **25 m** de deslocamento considera-se
movimento real, com a troca de gateway como segunda confirmação. Isso é então
cruzado com o histórico do local de instalação declarado, reconstruído das notas YA
e ordens YRR datadas: se o local declarado não muda mas o componente se deslocou de
fato, o cadastro é marcado como suspeito. Essa é a pergunta que o indicador responde
— não "onde ele está", mas "o que o SAP diz bate com o que o rastreador viu".

**Cercas.** O `/Zonas` não tem campo de pai, então a hierarquia é deduzida por
contenção geométrica (ponto-em-polígono por ray casting, área por shoelace). O
polígono que contém outros é unidade operacional e vai em magenta; o contido é local
interno, vai em verde e é rotulado com o nome da unidade onde está.

---

## Defeitos do código atual corrigidos por construção

O que segue não é crítica ao time — é o inventário do que mudou de comportamento, para
você conferir se concorda antes de promover.

A **fórmula exibida divergia da executada** em três telas: o texto do "Como é
calculado?" era literal e a conta estava no controller, e as duas derivaram. Agora
`calcular()` e `explicar()` leem a mesma declaração, então não há como divergirem.

A **`rastreabilidade` ficava presa em 100%**, e a **consistência retornava 100% quando
`online === 0`** — divisão por zero tratada como sucesso. Denominador zero agora
devolve `null`, que a tela mostra como "sem base para medir", nunca como 0% ou 100%.

As **metas do piloto estavam escritas em cinco arquivos** (`totalPlanejado = 50` e um
`/7` solto para gateways). Foram unificadas em `indicadores.js` como `METAS`, e
deveriam sair de configuração — ver pedidos ao backend abaixo.

Um **`slice(0, 3)`** truncava `/ReformadosPorOficina` silenciosamente. O **corpo da
exportação estava duplicado** entre dois handlers. E `img/SAP.png` quebrava em
servidor sensível a caixa.

---

## Pedidos ao backend

**Árvore em lote.** Hoje `arvoreDoLocal` faz uma chamada por veículo. Com 15 veículos
são 15 requisições; com a frota inteira isso não escala. Um `POST /equipamentos/local`
aceitando uma lista de locais resolveria em uma.

**Expor `totalCategoriasEquipamento`.** O valor existe no HANA e hoje é reconstruído
no cliente a partir da varredura dos equipamentos.

**Metas em configuração.** Os 50 rastreadores e 7 gateways planejados são números do
piloto. Quando o piloto virar rollout eles mudam, e mudar número de piloto não
deveria exigir build de front-end.

**Rota `/rest` no `xs-app.json`.** O approuter só declara `/odata`. No BTP, as
chamadas ao API_Hana (leitura e, agora, a gravação dos relatórios
personalizados) precisam de uma rota `^/rest/(.*)$` para a destination do
API_Hana. Por causa do POST, PUT e DELETE, ela precisa de `csrfProtection: false`
ou do token CSRF.

**Paginação em `/Equipamentos`.** A rota devolve a frota inteira sem `top`/`skip`.

---

## Segurança — ação necessária antes de qualquer promoção

Há credenciais de produção em claro, versionadas no repositório do **API_Hana**. Elas
estão no histórico do Git, então trocar o arquivo não basta: **as senhas precisam ser
rotacionadas**, porque quem já clonou o repositório tem as atuais.

| local | credencial |
|---|---|
| `controllers/SQLDB.js` (≈16 ocorrências) | usuário `PJRFID` no Azure SQL `rdb-rfid-prd.database.windows.net` / `BDRFID_PRD` |
| `controllers/SQLDB.js` (blocos comentados) | a mesma conta no ambiente QA `rfid-db-qa.database.windows.net` |
| `controllers/HANA.js:194` | usuário `RFIDMNTUSER` no HANA Cloud `xp0kc2228f55.ca1.hana.ondemand.com` |
| `webapp/controller/Login.controller.js` | `POST /Usuario/login` em HTTP puro, senha trafegando em claro |

O comentário `// Usando variáveis de ambiente` ao lado da senha literal no `HANA.js`
sugere que a intenção existia e a migração não foi concluída. O caminho é mover as
quatro para variáveis de ambiente ou para o serviço de credenciais do BTP, rotacionar
no provedor, e só então limpar o histórico.

A troca de ambiente PRD/QA hoje é feita comentando e descomentando linhas, o que é o
mecanismo pelo qual uma senha de produção chega numa máquina de desenvolvimento.

---

## Verificação — o que foi e o que não foi feito

Foram executados: 92 testes das regras (incluindo blocos de regressão que nomeiam cada
defeito acima), validação estática das 13 views com varredura de XML ciente de aspas,
checagem das 161 chaves de i18n e dos alvos do manifest, e uma execução ponta a ponta
sobre as fixtures.

**Não foi executado um `npm run build` real nem um `ui5 serve`.** O registry npm está
bloqueado neste ambiente (HTTP 403) e eu não contornei isso. Então o que garanto é
sintaxe, estrutura, resolução de referências e as regras de negócio; o que só a sua
máquina confirma é o build do UI5 e o render no navegador. O primeiro comando que vale
a pena rodar aí é `npm run check`, e depois `npm run start-simulado`.
