/**
 * Indicadores.
 *
 * A formula e DADO, nao codigo espalhado. `calcular` e `explicar` leem a
 * mesma declaracao, entao o texto do "Como é calculado?" nao tem como
 * divergir do numero exibido.
 *
 * Isso existe porque hoje o painel promete uma conta e executa outra:
 *
 *  - `Rastreamento.view.xml` diz "Disp x50% + Cobertura x25% + Consist.
 *    x15% + Gateways x10%", e `ValorGerado.js:267` faz
 *    `disponibilidade*0.70 + rastreabilidade*0.30`. Cobertura, consistencia
 *    e gateways nao entram no indice;
 *  - `Rastreamento2.controller.js:1878` promete "70% Disponibilidade + 30%
 *    Consistencia" e o backend usa rastreabilidade, que so existe no
 *    servidor, enquanto a consistencia so existe no navegador;
 *  - `ValorGeradoSemanal.js` usa outros pesos sobre tres numeros fixos no
 *    codigo (`tempoLocalizacao=66.7`, `cobertura=78.0`,
 *    `rastreabilidade=100.0`).
 *
 * Duas regras de conta valem para todos:
 *  - denominador zero devolve null ("nao da para dizer"), nunca 0% nem
 *    100%. Hoje `online === 0` devolve consistencia de 100%;
 *  - nada passa de 100%, e o excedente e sinalizado em vez de escondido.
 */
sap.ui.define([], function () {
	"use strict";

	/** Metas do piloto. NAO sao medicao — sao numeros combinados. Hoje estao
	 *  como `const totalPlanejado = 50` e `/ 7` em cinco arquivos. */
	var METAS = { rastreadoresPlanejados: 50, gatewaysPlanejados: 7 };

	function razao(n, d) {
		if (!isFinite(n) || !isFinite(d) || d === 0) { return null; }
		return n / d;
	}

	var INDICADORES = [
		{
			id: "cobertura",
			titulo: "Cobertura da árvore SAP",
			pergunta: "Por tipo, quantos componentes da árvore têm rastreador?",
			tipo: "razao",
			numerador: { rotulo: "componentes com rastreador", de: function (c) { return c.arvore.comRastreador; } },
			denominador: { rotulo: "componentes na árvore equivalente", de: function (c) { return c.arvore.naArvore; } },
			ressalva: "O denominador é a árvore dos veículos que têm pelo menos um equipamento rastreado, nunca o catálogo inteiro do SAP."
		},
		{
			id: "disponibilidade",
			titulo: "Disponibilidade dos rastreadores",
			pergunta: "Dos instalados, quantos estão de fato comunicando?",
			tipo: "razao",
			numerador: { rotulo: "rastreadores dentro do limite de silêncio", de: function (c) { return c.rastreadores.comunicando; } },
			denominador: { rotulo: "rastreadores instalados", de: function (c) { return c.rastreadores.total; } },
			ressalva: "O limite é de 15 dias para componente instalado em veículo e 7 dias fora dele. O cálculo atual usa 7 dias para todos e produz alarme falso em máquina em operação."
		},
		{
			id: "gateways",
			titulo: "Gateways em operação",
			pergunta: "Quanto da infraestrutura de leitura está no ar?",
			tipo: "razao",
			numerador: { rotulo: "gateways em condição ativa", de: function (c) { return c.gateways.ativos; } },
			denominador: { rotulo: "gateways cadastrados", de: function (c) { return c.gateways.total; } },
			ressalva: "O denominador é quantos gateways existem cadastrados, não a meta do piloto. O avanço contra a meta é mostrado à parte."
		},
		{
			id: "efetividade",
			titulo: "Índice geral de efetividade",
			pergunta: "Um número só, para acompanhar o conjunto.",
			tipo: "composto",
			parcelas: [
				{ id: "cobertura", peso: 0.4 },
				{ id: "disponibilidade", peso: 0.4 },
				{ id: "gateways", peso: 0.2 }
			],
			ressalva: "Quando uma parcela não pode ser medida, ela sai da conta e os pesos das demais são reequilibrados, em vez de entrar como zero e puxar o índice para baixo sem motivo."
		}
	];

	function obter(id) {
		for (var i = 0; i < INDICADORES.length; i++) {
			if (INDICADORES[i].id === id) { return INDICADORES[i]; }
		}
		return null;
	}

	function normalizarContexto(c) {
		var d = c || {};
		return {
			arvore: Object.assign({ comRastreador: 0, naArvore: 0 }, d.arvore || {}),
			rastreadores: Object.assign({ comunicando: 0, total: 0 }, d.rastreadores || {}),
			gateways: Object.assign({ ativos: 0, total: 0 }, d.gateways || {})
		};
	}

	function pct(v) {
		return v === null || v === undefined ? "—" : (v * 100).toFixed(1).replace(".", ",") + "%";
	}

	function num(v) {
		return new Intl.NumberFormat("pt-BR").format(v);
	}

	var api = {
		METAS: METAS,
		INDICADORES: INDICADORES,
		obter: obter,
		formatarPercentual: pct,

		calcular: function (contexto) {
			var ctx = normalizarContexto(contexto);
			var r = {};

			INDICADORES.forEach(function (ind) {
				if (ind.tipo !== "razao") { return; }
				var n = Number(ind.numerador.de(ctx) || 0);
				var d = Number(ind.denominador.de(ctx) || 0);
				var bruto = razao(n, d);
				r[ind.id] = {
					id: ind.id,
					titulo: ind.titulo,
					valor: bruto === null ? null : Math.min(bruto, 1),
					numerador: n,
					denominador: d,
					excedente: bruto !== null && bruto > 1,
					medido: bruto !== null
				};
			});

			INDICADORES.forEach(function (ind) {
				if (ind.tipo !== "composto") { return; }
				var disponiveis = ind.parcelas.filter(function (p) { return r[p.id] && r[p.id].valor !== null; });
				var pesoTotal = disponiveis.reduce(function (s, p) { return s + p.peso; }, 0);

				r[ind.id] = {
					id: ind.id,
					titulo: ind.titulo,
					valor: pesoTotal ? disponiveis.reduce(function (s, p) { return s + r[p.id].valor * (p.peso / pesoTotal); }, 0) : null,
					medido: pesoTotal > 0,
					parcelas: ind.parcelas.map(function (p) {
						var medida = r[p.id] && r[p.id].valor !== null;
						return {
							id: p.id,
							titulo: obter(p.id) ? obter(p.id).titulo : p.id,
							peso: p.peso,
							pesoEfetivo: pesoTotal && medida ? p.peso / pesoTotal : 0,
							valor: medida ? r[p.id].valor : null
						};
					}),
					omitidas: ind.parcelas.filter(function (p) { return !r[p.id] || r[p.id].valor === null; }).map(function (p) { return p.id; })
				};
			});

			return r;
		},

		/** O "Como é calculado?", gerado da MESMA declaracao do valor. */
		explicar: function (id, resultados) {
			var ind = obter(id);
			var r = resultados && resultados[id];
			if (!ind || !r) { return null; }

			if (ind.tipo === "razao") {
				return {
					titulo: ind.titulo,
					formula: ind.numerador.rotulo + " ÷ " + ind.denominador.rotulo + " × 100",
					conta: r.medido
						? num(r.numerador) + " ÷ " + num(r.denominador) + " × 100 = " + pct(r.valor)
						: num(r.numerador) + " ÷ 0 — sem denominador, não há o que medir",
					termos: [
						{ rotulo: ind.numerador.rotulo, valor: num(r.numerador) },
						{ rotulo: ind.denominador.rotulo, valor: num(r.denominador) }
					],
					ressalva: ind.ressalva,
					excedente: r.excedente ? "Há mais itens medidos do que a árvore declara. O índice foi limitado a 100% e a diferença aparece na conferência." : null
				};
			}

			var usadas = r.parcelas.filter(function (p) { return p.valor !== null; });
			return {
				titulo: ind.titulo,
				formula: usadas.map(function (p) { return p.titulo + " × " + Math.round(p.pesoEfetivo * 100) + "%"; }).join("  +  ") || "—",
				conta: r.medido
					? usadas.map(function (p) { return pct(p.valor) + " × " + Math.round(p.pesoEfetivo * 100) + "%"; }).join("  +  ") + " = " + pct(r.valor)
					: "Nenhuma parcela pôde ser medida.",
				termos: r.parcelas.map(function (p) {
					return {
						rotulo: p.titulo,
						valor: p.valor === null ? "não medido" : pct(p.valor),
						peso: Math.round(p.pesoEfetivo * 100) + "%",
						declarado: Math.round(p.peso * 100) + "%",
						omitida: p.valor === null
					};
				}),
				ressalva: ind.ressalva,
				excedente: null
			};
		},

		classificar: function (valor) {
			if (valor === null || valor === undefined) { return { rotulo: "Não medido", estado: "None" }; }
			var p = valor * 100;
			if (p >= 90) { return { rotulo: "Excelente", estado: "Success" }; }
			if (p >= 80) { return { rotulo: "Muito bom", estado: "Success" }; }
			if (p >= 70) { return { rotulo: "Bom", estado: "Warning" }; }
			return { rotulo: "Abaixo do esperado", estado: "Error" };
		},

		/** Avanco do piloto: mede IMPLANTACAO, nao operacao. Por isso fica
		 *  fora do indice. */
		avancoDoPiloto: function (dados, metas) {
			var d = dados || {};
			var m = metas || METAS;
			function medir(feito, meta) {
				return { feito: feito || 0, meta: meta, fracao: razao(feito || 0, meta), excedente: meta > 0 && (feito || 0) > meta };
			}
			return {
				rastreadores: medir(d.rastreadores, m.rastreadoresPlanejados),
				gateways: medir(d.gateways, m.gatewaysPlanejados)
			};
		}
	};

	return api;
});
