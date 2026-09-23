/**
 * Integracao sem navegador: roda a cadeia de regras sobre os arquivos de
 * localService/mock, que e exatamente o que a aplicacao faz ao subir sem
 * backend. Serve para provar que a tela nao abre vazia.
 */
import { readFileSync } from "fs";
import { carregar } from "./regras/carregar.mjs";

const R = "webapp/model/regras/";
const prefixo = carregar(R + "prefixo.js");
const arvore = carregar(R + "arvore.js");
const silencio = carregar(R + "silencio.js");
const confianca = carregar(R + "confianca.js");
const zonas = carregar(R + "zonas.js");
const indicadores = carregar(R + "indicadores.js");

const ler = (n) => JSON.parse(readFileSync("webapp/localService/mock/" + n + ".json", "utf8"));

const equipamentos = ler("Equipamentos");
const rastreados = ler("LocalizacaoAtual");
const veiculosBrutos = ler("Veiculo");
const arvorePorLocal = ler("equipamentos-local");
const leituras = ler("Rastreio-dados");
const notas = ler("NotasReforma");
const ordens = ler("OrdensRastreio");

const comTag = {};
rastreados.forEach((r) => { comTag[prefixo.chave(r.identificador)] = true; });

const cont = prefixo.contar(equipamentos, comTag);
const veiculos = arvore.veiculosUnicos(veiculosBrutos);
const conferencia = arvore.compararFrota(veiculos, arvorePorLocal, rastreados);
const cercas = zonas.preparar(ler("Zonas"));
const antenas = zonas.prepararGateways(ler("Gateway"));

const agora = new Date("2026-09-20T12:00:00Z").getTime();
let comunicando = 0;
rastreados.forEach((r) => {
	if (!silencio.avaliar(r.ultimaPosicaoAnalisada, r.grupoAtual, agora).mudo) { comunicando++; }
});

const porTag = {};
leituras.forEach((l) => { (porTag[prefixo.chave(l.identificador)] ||= []).push(l); });
const notasPorEq = {};
notas.forEach((n) => { (notasPorEq[prefixo.chave(n.equipamento)] ||= []).push(n); });
const ordensPorEq = {};
ordens.forEach((o) => { (ordensPorEq[prefixo.chave(o.equipamento)] ||= []).push(o); });

let divergentes = 0, alta = 0;
Object.keys(comTag).forEach((k) => {
	const a = confianca.avaliar({
		leituras: porTag[k] || [], localAtual: "X",
		notas: notasPorEq[k] || [], ordens: ordensPorEq[k] || [], amostras: (porTag[k] || []).length
	});
	if (a.cadastroSuspeito) { divergentes++; }
	if (a.nivel === "ALTA") { alta++; }
});

const res = indicadores.calcular({
	arvore: { comRastreador: conferencia.resumo.comRastreador, naArvore: conferencia.resumo.naArvore },
	rastreadores: { comunicando, total: rastreados.length },
	gateways: { ativos: antenas.filter((g) => g.ativo).length, total: antenas.length }
});

const pct = indicadores.formatarPercentual;
console.log("prefixos ........", cont.prefixos.map((p) => `${p.prefixo}:${p.total}`).join("  "), `| total ${cont.total}`);
console.log("veiculos ........", conferencia.resumo.veiculos, `| conformes ${conferencia.resumo.conformes} | divergentes ${conferencia.resumo.divergentes}`);
console.log("arvore ..........", `${conferencia.resumo.comRastreador} de ${conferencia.resumo.naArvore} =`, pct(conferencia.resumo.cobertura));
console.log("por familia .....", conferencia.porFamilia.map((f) => `${f.familia.split(" ")[0]} ${f.comRastreador}/${f.naArvore}`).join("  "));
console.log("comunicando .....", comunicando, "de", rastreados.length, "=", pct(res.disponibilidade.valor));
console.log("cercas ..........", cercas.filter((z) => z.tipo === "unidade").length, "unidades +", cercas.filter((z) => z.tipo === "local").length, "locais dentro delas");
console.log("gateways ........", antenas.filter((g) => g.ativo).length, "ativos de", antenas.length, "=", pct(res.gateways.valor));
console.log("confianca .......", alta, "alta |", divergentes, "cadastro divergente");
console.log("efetividade .....", pct(res.efetividade.valor));
console.log("  formula .......", indicadores.explicar("efetividade", res).formula);
console.log("  conta .........", indicadores.explicar("efetividade", res).conta);

const problemas = [];
if (!cont.prefixos.length) { problemas.push("nenhum prefixo derivado"); }
if (!conferencia.resumo.naArvore) { problemas.push("arvore vazia — o denominador ficaria zero"); }
if (res.efetividade.valor === null) { problemas.push("efetividade nao medida"); }
if (!cercas.some((z) => z.tipo === "local")) { problemas.push("hierarquia de cercas nao detectou nenhum local interno"); }
if (!antenas.length) { problemas.push("nenhum gateway plotavel"); }

console.log(problemas.length ? "\nPROBLEMAS: " + problemas.join(" · ") : "\ntudo coerente — a aplicação sobe com dados na tela");
process.exit(problemas.length ? 1 : 0);
