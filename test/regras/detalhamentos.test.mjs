/**
 * Testes das listas clicaveis (regras/detalhamentos).
 *
 * A promessa central: a lista que o card abre tem exatamente o numero que o
 * card mostra. Se alguem mudar o filtro de um lado so, isto falha.
 *
 * Roda com `npm run test:detalhamentos`.
 */
import { carregar } from "./carregar.mjs";

const R = "webapp/model/regras/";
const arvore = carregar(R + "arvore.js");
const indicadores = carregar(R + "indicadores.js");
const det = carregar(R + "detalhamentos.js");

let pass = 0, fail = 0;
const t = (nome, cond) => { if (cond) { pass++; } else { fail++; console.log("  FALHOU:", nome); } };

/* ---------- snapshot sintetico, no formato do modelo "frota" ---------- */
const ativo = (codigo, extra) => Object.assign({
	codigo, codigoOriginal: "0000" + codigo, descricao: "MOTOR C27", local: "FEIT0040",
	grupoAtual: "Instalado no CF-FEIT01", mudo: false, dias: 1, limite: 15,
	silencioTexto: "há 1 dia", gateway: "GW-1"
}, extra);

const ativos = [
	ativo("1"),
	ativo("2", { mudo: true, dias: 40 }),
	ativo("3", { mudo: true, dias: 99, grupoAtual: "Tags Digitais desatualizadas" }),
	ativo("4", { gateway: "GW-2" }),
	ativo("5", { mudo: true, dias: 20, gateway: null })
];

const rastreados = [
	{ identificador: "0001", descEquipamento: "MOTOR COMBUSTAO C27", grupoAtual: "Instalado no CF-01" },
	{ identificador: "0004", descEquipamento: "DIFERENCIAL TRASEIRO", grupoAtual: "Instalado no CF-01" },
	{ identificador: "0005", descEquipamento: "MOTOR COMBUSTAO C27", grupoAtual: "Instalado no CF-02" }
];
const conferencia = arvore.compararFrota(
	[{ nome: "CF-01", local: "FEIT0040" }, { nome: "CF-02", local: "FEMN0001" }, { nome: "CF-03", local: "PPIC0001" }],
	{ FEIT0040: { MOTOR: 1, DIFERENCIAL: 2 }, FEMN0001: { MOTOR: 1 } },
	rastreados
);

const resultados = indicadores.calcular({
	arvore: { comRastreador: conferencia.resumo.comRastreador, naArvore: conferencia.resumo.naArvore },
	rastreadores: { comunicando: 2, total: 4 },
	gateways: { ativos: 2, total: 2 }
});

const d = {
	ativos,
	conferencia,
	porFamilia: conferencia.porFamilia,
	gateways: [
		{ id: "GW-1", identificador: "GW-1", localidade: "Cauê", condicao: "OK", ativo: true },
		{ id: "GW-2", identificador: "GW-2", localidade: "Brucutu", condicao: "OK", ativo: true }
	],
	divergentes: [{ identificador: "0004", descEquipamento: "DIF", localInstalacao: "FEIT0040", distanciaM: 900, gateways: ["GW-1", "GW-2"] }],
	movimentacoes: [{ codigo: "0001", descricao: "MOTOR", de: "A reformar", para: "Instalado", oficina: "Cauê", quando: "há 1 dia" }],
	notas: [{ equipamento: "0001", nota: "N1" }, { equipamento: "0099", nota: "N2" }, { equipamento: "0000000099", nota: "N3" }],
	ordens: [{ equipamento: "0001", ordem: "O1" }],
	indicadores: resultados
};

/* resumo como o Frota calcula (habilitados = sem "Nao Habilitadas" e sem "desatualizadas") */
const habilitados = ativos.filter((a) => a.grupoAtual !== "Tags Digitais Não Habilitadas" && a.grupoAtual !== "Tags Digitais desatualizadas");
const resumo = {
	comunicando: habilitados.filter((a) => !a.mudo).length,
	mudos: habilitados.filter((a) => a.mudo).length
};

/* ===== a lista bate com o numero do card ===== */
t("comunicando: lista = card", det.comunicando(d).linhas.length === resumo.comunicando);
t("mudos: lista = card (REGRESSAO: desatualizada nao entra)", det.mudos(d).linhas.length === resumo.mudos);
t("mudos nao inclui tag desatualizada", !det.mudos(d).linhas.some((l) => l.equipamento.endsWith("3")));
t("rastreadores = comunicando + mudos", det.rastreadores(d).linhas.length === resumo.comunicando + resumo.mudos);
t("divergentes: lista = card", det.divergentes(d).linhas.length === d.divergentes.length);

/* ===== Sala de Controle: sem comunicacao inclui cadastro divergente ===== */
{
	const dd = Object.assign({}, d, {
		ativos: ativos.map((a) => a.codigo === "3" ? Object.assign({}, a, { cadastroDivergente: true }) : a)
			.concat([ativo("6", { mudo: true, dias: 50, grupoAtual: "Tags Digitais desatualizadas" })]) // desatualizada, sem divergencia
	});
	const hab = dd.ativos.filter((a) => a.grupoAtual !== "Tags Digitais Não Habilitadas" && a.grupoAtual !== "Tags Digitais desatualizadas");
	const semCom = dd.ativos.filter((a) => a.mudo && (hab.includes(a) || a.cadastroDivergente)).length;
	const com = hab.filter((a) => !a.mudo).length;
	t("sem comunicacao: lista = card", det.semComunicacao(dd).linhas.length === semCom);
	t("sem comunicacao inclui mudo com cadastro divergente", det.semComunicacao(dd).linhas.some((l) => l.equipamento.endsWith("3")));
	t("sem comunicacao nao inclui desatualizada sem divergencia", !det.semComunicacao(dd).linhas.some((l) => l.equipamento.endsWith("6")));
	t("sem comunicacao = mudos + divergentes mudos", semCom === det.mudos(dd).linhas.length + 1);
	t("habilitados = comunicando + sem comunicacao", det.habilitados(dd).linhas.length === com + semCom);
	t("habilitados sem repeticao", new Set(det.habilitados(dd).linhas.map((l) => l.equipamento)).size === com + semCom);
}
t("gateways ativos: lista = card", det.gateways(d, true).linhas.length === d.gateways.filter((g) => g.ativo).length);

const veic = det.veiculos(d);
t("veiculos: lista = card", veic.linhas.length === conferencia.resumo.veiculos);
t("conformes: lista = card", det.veiculos(d, "conformes").linhas.length === conferencia.resumo.conformes);
t("divergentes (veiculo): lista = card", det.veiculos(d, "divergentes").linhas.length === conferencia.resumo.divergentes);

/* ===== familia: os componentes listados sao os que a arvore contou ===== */
conferencia.porFamilia.forEach((f) => {
	t(`familia ${f.familia}: lista = com rastreador`, det.familia(d, f.familia).linhas.length === f.comRastreador);
});
t("veiculo × familia filtra os dois", det.veiculoFamilia(d, "CF-01", "MOTOR").linhas.length === 1);
t("veiculo sem familia traz o veiculo inteiro", det.veiculoFamilia(d, "CF-01").linhas.length === 2);
t("veiculo inexistente devolve lista vazia", det.veiculoFamilia(d, "XX", "MOTOR").linhas.length === 0);

/* ===== manutencao ===== */
t("notas: todas", det.notas(d).linhas.length === 3);
t("notas sem rastreador ignora zeros a esquerda", det.notasSemRastreador(d).linhas.length === 2);
t("ordens: todas", det.ordens(d).linhas.length === 1);

/* ===== gateway ===== */
t("equipamentos do gateway GW-1", det.doGateway(d, "GW-1").linhas.length === 3);
t("contagem de leituras por gateway", det.gateways(d).linhas.find((g) => g.gateway === "GW-2").leituras === 1);

/* ===== indice geral ===== */
const ef = det.efetividade(d);
const parcelas = ef.linhas.filter((l) => l.parcela);
const soma = parcelas.reduce((s, l) => s + (l.contribuicao || 0), 0);
t("composicao soma o indice geral", Math.abs(soma - resultados.efetividade.valor) < 1e-9);
t("pesos efetivos somam 100%", Math.abs(parcelas.reduce((s, l) => s + (l.peso || 0), 0) - 1) < 1e-9);
t("cada parcela abre uma lista", parcelas.every((l) => det.parcela(d, l.parcela) && det.parcela(d, l.parcela).linhas));
t("a nota da composicao traz a conta", ef.nota.includes("="));

/* ===== forma: toda coluna declarada existe nas linhas ===== */
const todas = [
	det.comunicando(d), det.mudos(d), det.semComunicacao(d), det.habilitados(d), det.rastreadores(d), det.porFamilia(d), det.familia(d, "MOTOR"),
	det.veiculoFamilia(d, "CF-01", "MOTOR"), det.veiculos(d), det.conferencia(d), det.familiasDoVeiculo(d, "CF-01"),
	det.divergentes(d), det.gateways(d), det.doGateway(d, "GW-1"), det.movimentacoes(d), det.notas(d),
	det.ordens(d), det.notasSemRastreador(d), det.efetividade(d),
	det.historico({ ativo: ativos[0], historico: [{ recebidoEm: "01/09, 10:00", grupo: "X", gateway: "GW-1", comunicacao: "LoRa", mudou: true }] })
];
todas.forEach((def) => {
	t(`${def.titulo}: tem titulo, arquivo e colunas`, def.titulo && def.arquivo && def.colunas.length > 0);
	const faltando = def.colunas.filter((c) => def.linhas.length && !(c.chave in def.linhas[0]));
	t(`${def.titulo}: toda coluna existe na linha`, faltando.length === 0);
	t(`${def.titulo}: coluna "acao" diz qual acao`, def.colunas.every((c) => c.tipo !== "acao" || !!c.acao));
});

console.log(`\ndetalhamentos: ${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
