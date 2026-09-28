/**
 * Testes do motor de relatorios personalizados.
 *
 * Roda o Frota.js de verdade sobre as fixtures (test/regras/frotaNode.mjs),
 * entao o que se confere aqui e o que a tela vai mostrar.
 *
 * `npm run test:personalizados`
 */
import { carregar } from "./carregar.mjs";
import { snapshotDaFrota } from "./frotaNode.mjs";

const R = carregar("webapp/model/regras/relatorioPersonalizado.js");
const campos = carregar("webapp/model/regras/campos.js");

let pass = 0, fail = 0;
const t = (nome, cond) => { if (cond) { pass++; } else { fail++; console.log("  FALHOU:", nome); } };
const perto = (a, b) => a !== null && b !== null && Math.abs(a - b) < 1e-9;

const d = await snapshotDaFrota();
const AGORA = new Date(2026, 8, 20, 12).getTime();

/* ===== formula ===== */
t("P1 / P2", R.compilar("P1 / P2").avaliar({ P1: 50, P2: 100 }) === 0.5);
t("precedencia", R.compilar("P1 + P2 * 2").avaliar({ P1: 1, P2: 3 }) === 7);
t("parenteses", R.compilar("(P1 + P2) * 2").avaliar({ P1: 1, P2: 3 }) === 8);
t("menos unario", R.compilar("-P1 + 5").avaliar({ P1: 2 }) === 3);
t("min/max/abs", R.compilar("min(P1, 1) + max(P2, 0) + abs(-2)").avaliar({ P1: 3, P2: -1 }) === 3);
t("divisao por zero e nao medido (null), nunca 0%", R.compilar("P1 / P2").avaliar({ P1: 1, P2: 0 }) === null);
t("parcela nula propaga", R.compilar("P1 + 1").avaliar({ P1: null }) === null);
t("minusculas p1 aceitas", R.compilar("p1/p2").variaveis.join() === "P1,P2");
let lancou = 0;
["", "P1 /", "P1 P2", "eval(1)", "P1 ^ 2", "(P1", "0,5 * P1"].forEach((f) => { try { R.compilar(f); } catch (e) { lancou++; } });
t("formulas invalidas sao recusadas (sem eval)", lancou === 7);

/* ===== Exemplo 1 do pedido: parcela / total = % ===== */
const ex1 = {
	nome: "Rastreadores sem comunicação", tipo: "metrica",
	parcelas: [
		{ rotulo: "Quantidade de rastreadores mudos", fonte: "rastreadores", agregacao: "contagem", filtros: [{ campo: "habilitado", operador: "verdadeiro" }, { campo: "mudo", operador: "verdadeiro" }] },
		{ rotulo: "Quantidade total de rastreadores", fonte: "rastreadores", agregacao: "contagem", filtros: [{ campo: "habilitado", operador: "verdadeiro" }] }
	],
	formula: "P1 / P2", formato: "percentual"
};
const r1 = R.executar(ex1, d, { agora: AGORA });
t("exemplo 1 calcula sem erro", r1.erros.length === 0);
t("exemplo 1: P1 = mudos do card", r1.parcelas[0].valor === d.resumo.mudos);
t("exemplo 1: P2 = total do card", r1.parcelas[1].valor === d.resumo.rastreadores);
t("exemplo 1: conta no formato 'a / b = x%'", /^\d+ \/ \d+ = \d+,\d%$/.test(r1.conta));

/* disponibilidade do modelo pronto = indicador oficial */
const disp = R.executar(R.modelo("disponibilidade"), d);
t("modelo disponibilidade = indicador de disponibilidade", perto(disp.valor, d.indicadores.disponibilidade.valor));
const cob = R.executar(R.modelo("cobertura-por-familia"), d);
t("modelo cobertura por família: total = cobertura da árvore", perto(cob.valor, d.resumo.cobertura));
t("cobertura por família: uma linha por família + total", cob.linhas.length === d.porFamilia.filter((f) => f.naArvore || f.comRastreador).length + 1);

/* ===== Exemplo 2 do pedido: tabela por 4 primeiros caracteres ===== */
const ex2 = R.executar(R.modelo("por-localidade"), d);
const semTotal = ex2.linhas.filter((l) => !l._total);
t("exemplo 2: uma linha por prefixo", semTotal.length === d.prefixos.length);
d.prefixos.forEach((p) => {
	const l = semTotal.find((x) => x.g0 === p.prefixo);
	t(`exemplo 2: ${p.prefixo} = contagem do seletor de prefixo`, l && l.v0 === p.total);
});
t("exemplo 2: % somam 100", perto(semTotal.reduce((s, l) => s + l.p_v0, 0), 1));
t("exemplo 2: ordenado do maior para o menor", semTotal.every((l, i) => i === 0 || semTotal[i - 1].v0 >= l.v0));
t("exemplo 2: total = rastreadores", ex2.linhas.find((l) => l._total).v0 === d.ativos.length);
t("exemplo 2: primeiros 4 == campo prefixo", JSON.stringify(semTotal.map((l) => l.g0).sort()) ===
	JSON.stringify(R.executar(Object.assign(R.modelo("por-localidade"), { linhas: [{ campo: "prefixo" }] }), d).linhas.filter((l) => !l._total).map((l) => l.g0).sort()));

/* ===== metrica aberta por grupo ===== */
const porPrefixo = R.executar(R.modelo("disponibilidade-por-prefixo"), d);
const grupos = porPrefixo.linhas.filter((l) => !l._total);
t("por grupo: P2 dos grupos soma o total", grupos.reduce((s, l) => s + l.P2, 0) === porPrefixo.parcelas[1].valor);
t("por grupo: linha total = métrica geral", perto(porPrefixo.linhas.find((l) => l._total).resultado, porPrefixo.valor));
t("por grupo: cada linha tem farol", grupos.every((l) => ["Success", "Warning", "Error"].includes(l._farol)));
t("agrupar por campo ausente em uma fonte e erro claro", R.validar(Object.assign(R.modelo("disponibilidade"), {
	parcelas: [{ fonte: "rastreadores" }, { fonte: "gateways" }], agrupamento: { campo: "prefixo" }
})).some((e) => e.includes("não existe em Gateways")));

/* ===== metas ===== */
t("meta maior: verde", R.farol(0.95, { sentido: "maior", verde: 90, amarelo: 80 }, "percentual") === "Success");
t("meta maior: amarelo", R.farol(0.85, { sentido: "maior", verde: 90, amarelo: 80 }, "percentual") === "Warning");
t("meta maior: vermelho", R.farol(0.5, { sentido: "maior", verde: 90, amarelo: 80 }, "percentual") === "Error");
t("meta menor: verde", R.farol(0.05, { sentido: "menor", verde: 10, amarelo: 20 }, "percentual") === "Success");
t("meta menor: vermelho", R.farol(0.3, { sentido: "menor", verde: 10, amarelo: 20 }, "percentual") === "Error");
t("sem meta: sem farol", R.farol(0.3, null, "percentual") === "None");
t("nao medido: sem farol", R.farol(null, { verde: 1 }, "numero") === "None");

/* ===== tabela cruzada ===== */
const cruz = R.executar(R.modelo("situacao-por-prefixo"), d);
const cruzLinhas = cruz.linhas.filter((l) => !l._total && !l._outros);
const colunasPrefixo = cruz.colunas.filter((c) => c._coluna);
t("cruzada: uma coluna por prefixo", colunasPrefixo.length === d.prefixos.length);
t("cruzada: soma das células = total da linha", cruzLinhas.every((l) => colunasPrefixo.reduce((s, c) => s + l[c.chave], 0) === l.t_v0));
t("cruzada: top 10 + Outros", cruz.linhas.filter((l) => !l._total).length <= 11);
const totalCruz = cruz.linhas.find((l) => l._total).t_v0;
t("cruzada: com 'Outros' o total continua batendo", cruz.linhas.filter((l) => !l._total).reduce((s, l) => s + l.t_v0, 0) === totalCruz);

/* ===== outras agregacoes e transformacoes ===== */
const media = R.executar({
	nome: "x", tipo: "tabela", fonte: "rastreadores", linhas: [{ campo: "prefixo" }],
	valores: [{ agregacao: "media", campo: "dias" }, { agregacao: "maximo", campo: "dias" }, { agregacao: "contagemDistinta", campo: "gateway" }, { agregacao: "verdadeiros", campo: "mudo" }]
}, d);
t("tabela com 4 valores calcula", media.erros.length === 0 && media.colunas.length === 5);
t("verdadeiros = mudos", media.linhas.find((l) => l._total).v3 === d.ativos.filter((a) => a.mudo).length);
const faixas = R.executar({ nome: "x", tipo: "tabela", fonte: "rastreadores", linhas: [{ campo: "dias", transformacao: { tipo: "faixa", n: 7 } }] }, d);
t("faixas de números", faixas.erros.length === 0 && faixas.linhas.every((l) => l._total || /^\d+ – \d+$/.test(l.g0)));
const meses = R.executar({ nome: "x", tipo: "tabela", fonte: "notas", linhas: [{ campo: "dataCriacao", transformacao: { tipo: "mes" } }] }, d);
t("agrupamento por mês", meses.erros.length === 0 && meses.linhas.every((l) => l._total || /^\d{2}\/\d{4}$/.test(l.g0)));
const dois = R.executar({ nome: "x", tipo: "tabela", fonte: "rastreadores", linhas: [{ campo: "prefixo" }, { campo: "familia" }] }, d);
t("dois níveis de linhas", dois.colunas[0].chave === "g0" && dois.colunas[1].chave === "g1");

/* ===== filtros ===== */
const f = (filtros, fonte) => R.executar({ nome: "x", tipo: "lista", fonte: fonte || "rastreadores", filtros, campos: ["equipamento"] }, d, { agora: AGORA }).registros;
t("filtro contém ignora acento e caixa", f([{ campo: "situacao", operador: "contem", valor: "instalado" }]) === d.ativos.filter((a) => /instalado/i.test(a.grupoAtual)).length);
t("filtro em lista", f([{ campo: "prefixo", operador: "em", valor: "FEIT, FEBR" }]) === d.ativos.filter((a) => ["FEIT", "FEBR"].includes(a.prefixo)).length);
t("filtro maior aceita vírgula", f([{ campo: "dias", operador: "maior", valor: "7,5" }]) === d.ativos.filter((a) => Math.round(a.dias) > 7.5).length);
t("filtro entre", f([{ campo: "dias", operador: "entre", valor: "0", valor2: "7" }]) === d.ativos.filter((a) => Math.round(a.dias) >= 0 && Math.round(a.dias) <= 7).length);
t("filtro de data em formato brasileiro", f([{ campo: "dataCriacao", operador: "maiorIgual", valor: "01/09/2026" }], "notas") === d.notas.filter((n) => n.data_criacao >= "2026-09-01").length);
t("filtro nos últimos N dias", f([{ campo: "dataCriacao", operador: "ultimosDias", valor: "30" }], "notas") >= 0);
t("filtros combinam com E", f([{ campo: "prefixo", operador: "igual", valor: "FEIT" }, { campo: "mudo", operador: "verdadeiro" }]) ===
	d.ativos.filter((a) => a.prefixo === "FEIT" && a.mudo).length);

/* ===== lista ===== */
const lista = R.executar(R.modelo("mudos-30-dias"), d, { agora: AGORA });
t("lista calcula", lista.erros.length === 0);
t("lista ordenada por dias desc", lista.linhas.every((l, i) => i === 0 || lista.linhas[i - 1].dias >= l.dias));
t("lista: coluna equipamento vira link", lista.colunas[0].tipo === "equipamento");
const limitada = R.executar({ nome: "x", tipo: "lista", fonte: "rastreadores", campos: ["equipamento"], limite: 5 }, d);
t("lista: limite corta mas registros conta tudo", limitada.linhas.length === 5 && limitada.registros === d.ativos.length);

/* ===== drill-down ===== */
const it1 = R.itens(ex1, d, { parcela: "P1" });
t("drill métrica: P1 lista os mudos", it1.linhas.length === r1.parcelas[0].valor);
t("drill métrica: coluna equipamento leva à ficha", it1.colunas[0].tipo === "equipamento");
const itG = R.itens(R.modelo("disponibilidade-por-prefixo"), d, { parcela: "P2", grupo: ["FEIT"] });
t("drill métrica por grupo", itG.linhas.length === grupos.find((l) => l.grupo === "FEIT").P2);
const itT = R.itens(R.modelo("por-localidade"), d, { grupo: ["FEMN"] });
t("drill tabela: linha", itT.linhas.length === semTotal.find((l) => l.g0 === "FEMN").v0);
const cel = cruzLinhas[0];
const col = colunasPrefixo.find((c) => cel[c.chave] > 0);
t("drill tabela cruzada: célula", R.itens(R.modelo("situacao-por-prefixo"), d, { grupo: [cel.g0], coluna: col._coluna }).linhas.length === cel[col.chave]);
const outros = cruz.linhas.find((l) => l._outros);
t("drill 'Outros'", !outros || R.itens(R.modelo("situacao-por-prefixo"), d, outros._alvo).linhas.length === outros.t_v0);
t("drill total", R.itens(R.modelo("por-localidade"), d, {}).linhas.length === d.ativos.length);

/* ===== validacao ===== */
t("sem nome", R.validar({ tipo: "lista", fonte: "rastreadores", campos: ["equipamento"] }).includes("Dê um nome ao relatório."));
t("fórmula com parcela inexistente", R.validar(Object.assign(R.modelo("disponibilidade"), { formula: "P1 / P3" })).some((e) => e.includes("P3")));
t("soma de texto é recusada", R.validar({ nome: "x", tipo: "metrica", parcelas: [{ fonte: "rastreadores", agregacao: "soma", campo: "local" }], formula: "P1" }).length > 0);
t("filtro sem valor", R.validar({ nome: "x", tipo: "lista", fonte: "rastreadores", campos: ["equipamento"], filtros: [{ campo: "prefixo", operador: "igual" }] }).some((e) => e.includes("informe o valor")));
t("data inválida", R.validar({ nome: "x", tipo: "lista", fonte: "notas", campos: ["nota"], filtros: [{ campo: "dataCriacao", operador: "maior", valor: "ontem" }] }).some((e) => e.includes("não é uma data")));
t("executar nunca lança", R.executar({ tipo: "metrica", formula: "(((" }, d).erros.length > 0);

/* ===== normalizar: so o esquema vai para o backend ===== */
const sujo = Object.assign(R.modelo("disponibilidade"), { _ui: { aberto: true }, parcelas: [Object.assign({}, R.modelo("disponibilidade").parcelas[0], { camposDisponiveis: [1, 2] })] });
const limpo = R.normalizar(sujo);
t("normalizar remove estado de tela", !("_ui" in limpo) && !("camposDisponiveis" in limpo.parcelas[0]));
t("normalizar é idempotente", JSON.stringify(R.normalizar(limpo)) === JSON.stringify(limpo));
t("todos os modelos são válidos", R.MODELOS.every((m) => R.validar(m).length === 0));
t("todos os modelos calculam sobre a frota", R.MODELOS.every((m) => R.executar(m, d, { agora: AGORA }).erros.length === 0));

/* ===== catalogo ===== */
Object.keys(campos.FONTES).forEach((id) => {
	const linhas = campos.linhas(id, d);
	const f0 = campos.FONTES[id];
	t(`fonte ${id}: tem linhas na frota simulada`, linhas.length > 0);
	t(`fonte ${id}: todo campo declarado existe na linha`, f0.campos.every((c) => c.id in (linhas[0] || {})));
	t(`fonte ${id}: colunas padrão existem`, f0.colunasPadrao.every((c) => campos.campo(id, c)));
});

/* ===== exportacao ===== */
const exp = R.paraExportacao(ex1, r1);
t("exportação da métrica leva a conta", exp.colunas.some((c) => c.chave === "conta") && exp.linhas[0].conta === r1.conta);

/* ===== editor e assistente ===== */
const ed = carregar("webapp/model/regras/editorRelatorio.js");
R.MODELOS.forEach((m) => {
	const def = R.modelo(m.modelo);
	const volta = ed.paraDefinicao(ed.paraEditor(def));
	t(`editor ida e volta sem perda: ${m.modelo}`, JSON.stringify(volta) === JSON.stringify(def));
});
const est = ed.paraEditor(R.modelo("disponibilidade"));
t("editor: parcela tem campos, operadores e agregações", est.parcelas[0].filtros[0]._campos.length > 5 && est.parcelas[0].filtros[0]._operadores.length > 0 && est.parcelas[0]._agregacoes.length === 7);
est.parcelas[0].fonte = "gateways";
ed.atualizar(est);
t("editor: trocar a fonte limpa filtro de campo inexistente", est.parcelas[0].filtros.every((f) => f._operadores.length === 0 && f.operador === ""));
t("editor: estado de tela não vai para a definição", !JSON.stringify(ed.paraDefinicao(est)).includes("_campos"));
const est2 = ed.paraEditor(R.novo("tabela"));
est2.valores[0].agregacao = "soma"; ed.atualizar(est2);
t("editor: soma só oferece campos numéricos", est2.valores[0]._camposAgregacao.slice(1).every((c) => c.tipo === "numero"));
est2.linhas[0].campo = "local"; est2.linhas[0].transformacao.tipo = "primeiros"; ed.atualizar(est2);
t("editor: 'primeiros N' pede N e sugere 4", est2.linhas[0]._temParametro && est2.linhas[0].transformacao.n === 4);

// assistente: reproduz o exemplo 1 (proporcao)
const w1 = ed.novoAssistente();
w1.filtros = [Object.assign(ed.novoFiltro("rastreadores"), { campo: "habilitado" })];
w1.condicoes = [Object.assign(ed.novoFiltro("rastreadores"), { campo: "mudo" })];
ed.atualizarAssistente(w1);
t("assistente: falta condição é detectada", ed.faltaNoPasso(ed.novoAssistente(), "calculo") !== "");
t("assistente: proporção completa passa", ed.faltaNoPasso(w1, "calculo") === "");
const dw1 = ed.doAssistente(w1);
t("assistente: gera definição válida", R.validar(dw1).length === 0);
const rw1 = R.executar(dw1, d);
t("assistente proporção = exemplo 1", rw1.valor === r1.valor && rw1.conta === r1.conta);
t("assistente sugere nome", dw1.nome.length > 5);

// assistente: reproduz o exemplo 2 (tabela por 4 primeiros)
const w2 = Object.assign(ed.novoAssistente(), { tipo: "tabela" });
w2.agrupar.campo = "local"; ed.atualizarAssistente(w2);
w2.agrupar.transformacao.tipo = "primeiros"; ed.atualizarAssistente(w2);
const rw2 = R.executar(ed.doAssistente(w2), d);
t("assistente tabela = exemplo 2", JSON.stringify(rw2.linhas.map((l) => [l.g0, l.v0, l.p_v0])) === JSON.stringify(ex2.linhas.map((l) => [l.g0, l.v0, l.p_v0])));

// assistente: valor simples e lista
const w3 = Object.assign(ed.novoAssistente(), { modoMetrica: "valor" });
w3.calculo.agregacao = "media"; ed.atualizarAssistente(w3); w3.calculo.campo = "dias";
const rw3 = R.executar(ed.doAssistente(w3), d);
t("assistente valor: média de dias", rw3.erros.length === 0 && rw3.parcelas[0].valor > 0);
const w4 = ed.atualizarAssistente(Object.assign(ed.novoAssistente(), { tipo: "lista", ordenarPor: "dias" }));
t("assistente lista", R.executar(ed.doAssistente(w4), d).linhas.length === d.ativos.length);
t("assistente abre no editor sem perda", JSON.stringify(ed.paraDefinicao(ed.paraEditor(dw1))) === JSON.stringify(dw1));

console.log(`\npersonalizados: ${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
