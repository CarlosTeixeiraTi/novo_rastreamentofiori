/**
 * Testes das regras puras.
 *
 * Os blocos marcados REGRESSAO travam defeitos que existem hoje no
 * Rastreamento2. Se alguem "simplificar" de volta, eles falham.
 *
 * Roda com `npm run test:regras` — sem navegador e sem dependencia.
 */
import { carregar } from "./carregar.mjs";

const R = "webapp/model/regras/";
const prefixo = carregar(R + "prefixo.js");
const arvore = carregar(R + "arvore.js");
const silencio = carregar(R + "silencio.js");
const confianca = carregar(R + "confianca.js");
const zonas = carregar(R + "zonas.js");
const indicadores = carregar(R + "indicadores.js");

let pass = 0, fail = 0;
const t = (nome, cond) => { if (cond) { pass++; } else { fail++; console.log("  FALHOU:", nome); } };

/* ===== REGRESSAO 1 — prefixo sao SEMPRE os 4 primeiros caracteres ===== */
t("prefixo de FEIT0042", prefixo.de("FEIT0042") === "FEIT");
t("FEIT-EMREF_EX continua sendo FEIT", prefixo.de("FEIT-EMREF_EX") === "FEIT");
t("_EMREF_EXT NAO e prefixo proprio", prefixo.de("FEIT-EMREF_EXT") === "FEIT");
t("local curto nao vira prefixo", prefixo.de("FEI") === null);
t("nulo devolve null", prefixo.de(null) === null && prefixo.de("") === null);
t("casa com recorte", prefixo.casa("FEIT0042", "FEIT") && !prefixo.casa("FEMN0001", "FEIT"));
t("sem recorte, tudo casa", prefixo.casa("QUALQUER", null));
t("zeros a esquerda sao ignorados", prefixo.chave("000000010042") === "10042");
t("so zeros vira 0", prefixo.chave("0000") === "0");

const cont = prefixo.contar(
	[{ EQUIPAMENTO: "0001", LOCAL_INSTALACAO: "FEIT01" }, { EQUIPAMENTO: "0002", LOCAL_INSTALACAO: "FEIT02" },
	 { EQUIPAMENTO: "0003", LOCAL_INSTALACAO: "FEMN01" }, { EQUIPAMENTO: "0004", LOCAL_INSTALACAO: "FEIT03" }],
	{ "1": true, "2": true, "3": true });
t("conta so quem tem rastreador", cont.total === 3);
t("agrupa por prefixo", cont.prefixos.find(p => p.prefixo === "FEIT").total === 2);
t("equipamento sem tag fica de fora", !cont.prefixos.some(p => p.total === 4));

/* ===== REGRESSAO 2 — espaco final em "Instalado no X " ===== */
t("sem espaco final casa", arvore.veiculoDoGrupo("Instalado no CF-01") === "CF-01");
t("COM espaco final casa igual", arvore.veiculoDoGrupo("Instalado no CF-01 ") === "CF-01");
t("espaco duplicado nao atrapalha", arvore.veiculoDoGrupo("Instalado  no  CF-01") === "CF-01");
t("caixa baixa casa", arvore.veiculoDoGrupo("instalado no cf-01") === "CF-01");
t("outro grupo nao vira veiculo", arvore.veiculoDoGrupo("A reformar") === null);
t("prefixo sem nome nao inventa", arvore.veiculoDoGrupo("Instalado no   ") === null);

/* ===== REGRESSAO 3 — CONVERSOR x CONVERSOR DE TORQUE ===== */
t("conversor devolve a chave do SAP", arvore.familiaDe("CONVERSOR TORQUE 793D") === "CONVERSOR DE TORQUE");
t("a chave existe nas familias", arvore.FAMILIAS.some(f => f.id === "CONVERSOR DE TORQUE"));
t("motor combustao", arvore.familiaDe("MOTOR COMBUSTAO C27") === "MOTOR");
t("comando final antes de motor", arvore.familiaDe("COMANDO FINAL COM MOTOR") === "COMANDO FINAL");
t("transmissao com acento", arvore.familiaDe("TRANSMISSÃO PLANETARIA") === "TRANSMISSAO");
t("fora das cinco familias devolve null", arvore.familiaDe("BOMBA HIDRAULICA") === null);

/* ===== comparacao contra a arvore ===== */
const rastreados = [
	{ grupoAtual: "Instalado no CF-01 ", descEquipamento: "MOTOR COMBUSTAO" },
	{ grupoAtual: "Instalado no CF-01", descEquipamento: "CONVERSOR TORQUE" },
	{ grupoAtual: "Instalado no CF-01", descEquipamento: "COMANDO FINAL ESQ" },
	{ grupoAtual: "Instalado no CF-02", descEquipamento: "MOTOR COMBUSTAO" },
	{ grupoAtual: "A reformar", descEquipamento: "MOTOR COMBUSTAO" }
];
const v1 = arvore.conferirVeiculo({ nome: "CF-01" }, { MOTOR: 1, "COMANDO FINAL": 2 }, rastreados);
t("conta so o que esta neste veiculo", v1.comRastreador === 3);
t("componente de outro veiculo nao entra", !v1.linhas.some(l => l.itens.length > 2));
t("faltando comando final e divergente", v1.conforme === false);
t("familia nao esperada aparece como sobra", v1.linhas.find(l => l.familia === "CONVERSOR DE TORQUE").diferenca === 1);
t("sobra NAO compensa falta na cobertura", Math.abs(v1.cobertura - 2 / 3) < 1e-9);
t("cobertura nunca passa de 100%", v1.cobertura <= 1);

const semArvore = arvore.conferirVeiculo({ nome: "CF-09" }, {}, rastreados);
t("sem arvore devolve cobertura nula, nao zero", semArvore.cobertura === null);

const frota = arvore.compararFrota(
	[{ nome: "CF-01", local: "L1" }, { nome: "CF-02", local: "L2" }],
	{ L1: { MOTOR: 1, "COMANDO FINAL": 2 }, L2: { MOTOR: 1 } }, rastreados);
t("agrega por familia", frota.porFamilia.find(f => f.familia === "MOTOR").naArvore === 2);
t("resumo conta divergentes", frota.resumo.divergentes === 1);
t("pior cobertura primeiro", frota.veiculos[0].nome === "CF-01");
t("frota vazia nao quebra", arvore.compararFrota([], {}, []).resumo.cobertura === null);

const unicos = arvore.veiculosUnicos([
	{ Veiculo: "A", LOCAL_INSTALACAO: "X", DataAtualizacao: "2026-01-01", Latitude: "-19.9", Longitude: "-43.9" },
	{ Veiculo: "A", LOCAL_INSTALACAO: "Y", DataAtualizacao: "2026-09-01", Latitude: "-19.8", Longitude: "-43.8" },
	{ Veiculo: "  ", LOCAL_INSTALACAO: "Z", DataAtualizacao: "2026-09-01" }
]);
t("deduplica por veiculo", unicos.length === 1);
t("fica o mais recente", unicos[0].local === "Y");
t("coordenada em texto vira numero", unicos[0].posicao.lat === -19.8);
t("veiculo sem nome sai", !unicos.some(v => !v.nome));

/* ===== REGRESSAO 4 — limite de silencio de 15 dias ===== */
const AGORA = new Date("2026-09-20T12:00:00Z").getTime();
const hA = (d) => new Date(AGORA - d * 86400000).toISOString();
t("instalado tem limite de 15 dias", silencio.limiteDe("Instalado no CF-01") === 15);
t("fora de veiculo tem limite de 7", silencio.limiteDe("A reformar") === 7);
t("instalado ha 9 dias NAO e mudo", silencio.avaliar(hA(9), "Instalado no CF-01", AGORA).mudo === false);
t("fora de veiculo ha 9 dias E mudo", silencio.avaliar(hA(9), "A reformar", AGORA).mudo === true);
t("instalado ha 20 dias e mudo", silencio.avaliar(hA(20), "Instalado no CF-01", AGORA).mudo === true);
t("nunca comunicou e mudo", silencio.avaliar(null, "A reformar", AGORA).mudo === true);

/* ===== confianca: 25 m sobre a mediana E troca de gateway ===== */
const perto = (n, g) => Array.from({ length: n }, (_, i) => ({
	latitude: -19.9612 + (i % 3) * 0.00005, longitude: -43.9386, gateway: g, recebidoEm: hA(i)
}));
t("mesma posicao e mesmo gateway: nao moveu", confianca.deslocamento(perto(10, "GW-1")).moveu === false);

const longeMesmoGw = perto(6, "GW-1").concat([{ latitude: -19.9700, longitude: -43.9386, gateway: "GW-1" }]);
const dLonge = confianca.deslocamento(longeMesmoGw);
t("passou dos 25 m mas sem trocar gateway: deriva", dLonge.deriva === true && dLonge.moveu === false);

const longeOutroGw = perto(6, "GW-1").concat([{ latitude: -19.9700, longitude: -43.9386, gateway: "GW-2" }]);
t("passou dos 25 m E trocou gateway: moveu", confianca.deslocamento(longeOutroGw).moveu === true);
t("limiar padrao e 25 m", confianca.DERIVA_M === 25);
t("sem coordenada nao inventa deslocamento", confianca.deslocamento([]).medido === false);

/* a mediana resiste a uma fixacao solta */
const comOutlier = perto(20, "GW-1").concat([{ latitude: -18.5, longitude: -43.0, gateway: "GW-1" }]);
const ancora = confianca.posicaoMediana(comOutlier);
t("a mediana ignora o ponto solto", Math.abs(ancora.lat + 19.9612) < 0.001);

const hist = confianca.historicoDeLocal(
	[{ local_instalacao: "FEIT01", data_modificacao: "2026-09-10", nota: "1" }],
	[{ local_instalacao: "FEIT01", data_criacao: "2026-08-01", ordem: "2" }]);
t("local estavel no historico", hist.estavel === true);
const hist2 = confianca.historicoDeLocal(
	[{ local_instalacao: "FEIT02", data_modificacao: "2026-09-10", nota: "1" }],
	[{ local_instalacao: "FEIT01", data_criacao: "2026-08-01", ordem: "2" }]);
t("local que mudou nao e estavel", hist2.estavel === false);

const suspeito = confianca.avaliar({
	leituras: longeOutroGw, localAtual: "FEIT01",
	notas: [{ local_instalacao: "FEIT01", data_modificacao: "2026-09-10" }], ordens: [], amostras: 100
});
t("moveu + local parado = cadastro suspeito", suspeito.cadastroSuspeito === true);
t("cadastro suspeito derruba a confianca", suspeito.nivel === "BAIXA");
t("os testes vem nomeados para a tela", suspeito.testes.length === 3 && suspeito.testes.every(x => x.texto));

const ok = confianca.avaliar({
	leituras: perto(100, "GW-1"), localAtual: "FEIT01",
	notas: [{ local_instalacao: "FEIT01", data_modificacao: "2026-09-10" }], ordens: [], amostras: 100
});
t("tudo concordando da confianca alta", ok.nivel === "ALTA");

/* ===== zonas: formato e hierarquia ===== */
const quad = (clat, clng, r) => JSON.stringify([
	{ lat: clat + r, lon: clng - r }, { lat: clat + r, lon: clng + r },
	{ lat: clat - r, lon: clng + r }, { lat: clat - r, lon: clng - r }]);

t("pontos como string JSON sao lidos", zonas.pontosDaZona({ pontos: quad(-19.9, -43.9, 0.01) }).length === 4);
t("o campo lon vira lng", zonas.pontosDaZona({ pontos: quad(-19.9, -43.9, 0.01) })[0][1] === -43.91);
t("JSON quebrado nao derruba", zonas.pontosDaZona({ pontos: "{[quebrado" }).length === 0);
t("pontos ausente devolve vazio", zonas.pontosDaZona({}).length === 0);

const preparadas = zonas.preparar([
	{ idZona: "U1", nome: "Mina Cauê", pontos: quad(-19.9, -43.9, 0.05) },
	{ idZona: "L1", nome: "Oficina", pontos: quad(-19.9, -43.9, 0.005) },
	{ idZona: "X", nome: "Linha", pontos: JSON.stringify([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }]) }
]);
t("menos de 3 pontos nao vira poligono", preparadas.length === 2);
t("a maior vira unidade", preparadas.find(z => z.id === "U1").tipo === "unidade");
t("a contida vira local", preparadas.find(z => z.id === "L1").tipo === "local");
t("o local aponta para a unidade que o contem", preparadas.find(z => z.id === "L1").mae.nome === "Mina Cauê");
t("unidade em magenta Vale", preparadas.find(z => z.id === "U1").cor === "#e10073");
t("local em verde Vale", preparadas.find(z => z.id === "L1").cor === "#00807c");

const onde = zonas.localizar({ lat: -19.9, lng: -43.9 }, preparadas);
t("localiza o local mais especifico", onde.local.nome === "Oficina");
t("e tambem a unidade", onde.unidade.nome === "Mina Cauê");
t("fora de tudo devolve nulo", zonas.localizar({ lat: 0, lng: 0 }, preparadas).local === null);

const gws = zonas.prepararGateways([
	{ gatewayId: "g1", latitude: "-19.96", longitude: "-43.93", condicao: "Ativo" },
	{ gatewayId: "g2", latitude: null, longitude: null, condicao: "Ativo" },
	{ gatewayId: "g3", latitude: "0", longitude: "0", condicao: "Ativo" },
	{ gatewayId: "g4", latitude: "-19.9", longitude: "-43.9", condicao: "Manutenção" }
]);
t("coordenada em texto vira numero", gws[0].posicao.lat === -19.96);
t("sem coordenada sai", !gws.some(g => g.id === "g2"));
t("0,0 sai", !gws.some(g => g.id === "g3"));
t("manutencao nao conta como ativo", gws.find(g => g.id === "g4").ativo === false);

/* ===== indicadores: formula e dado, e a conta impressa bate ===== */
const comp = indicadores.INDICADORES.find(i => i.tipo === "composto");
t("os pesos somam 1", Math.abs(comp.parcelas.reduce((s, p) => s + p.peso, 0) - 1) < 1e-9);
t("toda parcela existe", comp.parcelas.every(p => indicadores.obter(p.id)));

const ctx = { arvore: { comRastreador: 190, naArvore: 247 }, rastreadores: { comunicando: 148, total: 190 }, gateways: { ativos: 4, total: 8 } };
const res = indicadores.calcular(ctx);
t("cobertura da arvore", Math.abs(res.cobertura.valor - 190 / 247) < 1e-9);
t("disponibilidade", Math.abs(res.disponibilidade.valor - 148 / 190) < 1e-9);
t("gateways", res.gateways.valor === 0.5);
t("efetividade ponderada", Math.abs(res.efetividade.valor - (190 / 247 * .4 + 148 / 190 * .4 + .5 * .2)) < 1e-9);

const vazio = indicadores.calcular({});
t("denominador zero devolve null", vazio.cobertura.valor === null);
t("NAO devolve 100% com zero dado", vazio.cobertura.valor !== 1);
t("composto sem parcela tambem e null", vazio.efetividade.valor === null);

const semGw = indicadores.calcular({ arvore: { comRastreador: 1, naArvore: 2 }, rastreadores: { comunicando: 1, total: 2 }, gateways: { ativos: 0, total: 0 } });
t("parcela nao medida e omitida", semGw.efetividade.omitidas.includes("gateways"));
t("pesos reequilibrados, nao zerados", Math.abs(semGw.efetividade.valor - 0.5) < 1e-9);
t("pesos efetivos somam 1", Math.abs(semGw.efetividade.parcelas.reduce((s, p) => s + p.pesoEfetivo, 0) - 1) < 1e-9);

const excede = indicadores.calcular({ arvore: { comRastreador: 300, naArvore: 247 }, rastreadores: { comunicando: 1, total: 1 }, gateways: { ativos: 1, total: 1 } });
t("nada passa de 100%", excede.cobertura.valor === 1);
t("o excedente e sinalizado", excede.cobertura.excedente === true);

/* COERENCIA: a conta impressa tem de ser a conta executada */
const fmt = (v) => v === null ? "—" : (v * 100).toFixed(1).replace(".", ",") + "%";
let incoerentes = 0, conferidos = 0;
for (const cenario of [ctx, {}, semGw && { arvore: { comRastreador: 5, naArvore: 9 }, rastreadores: { comunicando: 3, total: 3 }, gateways: { ativos: 0, total: 0 } },
	{ arvore: { comRastreador: 1, naArvore: 1 }, rastreadores: { comunicando: 0, total: 1 }, gateways: { ativos: 2, total: 7 } }]) {
	const r = indicadores.calcular(cenario);
	for (const ind of indicadores.INDICADORES) {
		const e = indicadores.explicar(ind.id, r);
		const v = r[ind.id].valor;
		conferidos++;
		if (v === null) {
			if (!/não há o que medir|pôde ser medida/.test(e.conta)) { incoerentes++; }
		} else if (!e.conta.endsWith("= " + fmt(v))) {
			incoerentes++;
			console.log("    divergiu:", ind.id, "|", e.conta, "| valor:", fmt(v));
		}
	}
}
t(`a conta impressa bate com o valor calculado (${conferidos} conferencias)`, incoerentes === 0);

t("meta do piloto nao e denominador de indicador", !JSON.stringify(indicadores.INDICADORES).includes("50"));
const piloto = indicadores.avancoDoPiloto({ rastreadores: 25, gateways: 7 });
t("avanco do piloto e medido a parte", piloto.rastreadores.fracao === 0.5 && piloto.gateways.fracao === 1);
t("meta zero nao divide por zero", indicadores.avancoDoPiloto({ rastreadores: 5 }, { rastreadoresPlanejados: 0, gatewaysPlanejados: 0 }).rastreadores.fracao === null);

console.log(`\nregras: ${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
