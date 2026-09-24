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
