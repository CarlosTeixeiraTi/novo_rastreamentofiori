/**
 * Grafico do resultado de um relatorio personalizado.
 *
 * Usa o VizFrame (sap.viz, ja declarado no manifest). Se a biblioteca nao
 * carregar — ambiente sem sap.viz, ou erro de renderizacao — desenha barras
 * simples em HTML, para o relatorio nunca ficar sem o grafico por causa de
 * infraestrutura.
 *
 * Entrada: `grafico` do motor (regras/relatorioPersonalizado):
 *   { tipo: barras|colunas|pizza|linha, categorias: [...], series: [{ nome, valores }],
 *     percentual, empilhado, medida }
 */
sap.ui.define([
	"sap/ui/core/HTML",
	"sap/ui/model/json/JSONModel"
], function (HTML, JSONModel) {
	"use strict";

	var TIPOS_VIZ = {
		barras: "bar",
		colunas: "column",
		pizza: "pie",
		linha: "line"
	};

	var TIPOS_EMPILHADOS = { bar: "stacked_bar", column: "stacked_column" };

	function escapar(t) {
		return String(t === null || t === undefined ? "" : t)
			.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	function valorExibido(v, percentual) {
		if (v === null || v === undefined || !isFinite(v)) { return null; }
		return percentual ? Math.round(v * 1000) / 10 : v;
	}

	/** Barras horizontais em HTML — plano B, sem dependencia nenhuma. */
	function barrasHtml(grafico) {
		var serie = grafico.series[0] || { valores: [] };
		var valores = serie.valores.map(function (v) { return valorExibido(v, grafico.percentual); });
		var maximo = Math.max.apply(null, valores.filter(function (v) { return v !== null; }).concat([0])) || 1;
		var linhas = grafico.categorias.map(function (c, i) {
			var v = valores[i];
			var largura = v === null ? 0 : Math.max(0, v) / maximo * 100;
			return "<div class=\"valeBarra\"><span class=\"valeBarra__rotulo\" title=\"" + escapar(c) + "\">" + escapar(c) + "</span>" +
				"<span class=\"valeBarra__trilho\"><span class=\"valeBarra__valor\" style=\"width:" + largura.toFixed(1) + "%\"></span></span>" +
				"<span class=\"valeBarra__numero\">" + (v === null ? "—" : new Intl.NumberFormat("pt-BR").format(v) + (grafico.percentual ? "%" : "")) + "</span></div>";
		}).join("");
		return new HTML({ content: "<div class=\"valeBarras\">" + linhas + "</div>", sanitizeContent: false });
	}

	function vizFrame(grafico, altura) {
		var VizFrame = sap.ui.require("sap/viz/ui5/controls/VizFrame");
		var FlattenedDataset = sap.ui.require("sap/viz/ui5/data/FlattenedDataset");
		var FeedItem = sap.ui.require("sap/viz/ui5/controls/common/feeds/FeedItem");
		if (!VizFrame || !FlattenedDataset || !FeedItem) { return null; }

		var tipoViz = TIPOS_VIZ[grafico.tipo] || "bar";
		if (grafico.empilhado && TIPOS_EMPILHADOS[tipoViz]) { tipoViz = TIPOS_EMPILHADOS[tipoViz]; }
		// pizza so com uma serie: com colunas cruzadas vira colunas empilhadas
		var series = grafico.series;
		if (tipoViz === "pie" && series.length > 1) { tipoViz = "stacked_column"; }

		var linhas = grafico.categorias.map(function (c, i) {
			var o = { categoria: c };
			series.forEach(function (s, j) { o["s" + j] = valorExibido(s.valores[i], grafico.percentual); });
			return o;
		});
		var medidas = series.map(function (s, j) {
			return { name: s.nome + (grafico.percentual ? " (%)" : ""), value: "{s" + j + "}" };
		});

		var frame = new VizFrame({
			width: "100%",
			height: altura || "360px",
			vizType: tipoViz,
			uiConfig: { applicationSet: "fiori" }
		});
		frame.setModel(new JSONModel({ linhas: linhas }));
		frame.setDataset(new FlattenedDataset({
			dimensions: [{ name: "Categoria", value: "{categoria}" }],
			measures: medidas,
			data: { path: "/linhas" }
		}));
		frame.setVizProperties({
			title: { visible: false },
			legend: { visible: series.length > 1 || tipoViz === "pie" },
			plotArea: {
				dataLabel: { visible: true, formatString: grafico.percentual ? "0.0" : "#,##0.##" },
				drawingEffect: "normal"
			},
			valueAxis: { title: { visible: false } },
			categoryAxis: { title: { visible: false } }
		});

		if (tipoViz === "pie") {
			frame.addFeed(new FeedItem({ uid: "size", type: "Measure", values: [medidas[0].name] }));
			frame.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["Categoria"] }));
		} else {
			frame.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: medidas.map(function (m) { return m.name; }) }));
			frame.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Categoria"] }));
		}
		return frame;
	}

	var api = {

		/** true quando ha o que desenhar. */
		temGrafico: function (grafico) {
			return !!(grafico && grafico.tipo && grafico.tipo !== "nenhum" &&
				grafico.categorias && grafico.categorias.length && grafico.series && grafico.series.length);
		},

		/**
		 * Devolve uma Promise com o controle do grafico (VizFrame ou barras
		 * em HTML). `altura`: "360px" na tela, menor na pre-visualizacao.
		 */
		criar: function (grafico, altura) {
			if (!api.temGrafico(grafico)) { return Promise.resolve(null); }
			return new Promise(function (resolver) {
				sap.ui.require([
					"sap/viz/ui5/controls/VizFrame",
					"sap/viz/ui5/data/FlattenedDataset",
					"sap/viz/ui5/controls/common/feeds/FeedItem"
				], function () {
					try {
						resolver(vizFrame(grafico, altura) || barrasHtml(grafico));
					} catch (e) {
						resolver(barrasHtml(grafico));
					}
				}, function () {
					resolver(barrasHtml(grafico));
				});
			});
		}
	};

	return api;
});
