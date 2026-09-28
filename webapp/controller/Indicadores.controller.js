sap.ui.define([
	"./BaseController",
	"../model/regras/indicadores",
	"sap/ui/model/json/JSONModel"
], function (BaseController, indicadores, JSONModel) {
	"use strict";

	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Indicadores", {

		onInit: function () {
			this.usarFrota();
			this.escuro(false);
			this._tela = new JSONModel({ geral: {}, classe: {}, explicacaoGeral: {}, parcelas: [], diferenca: "" });
			this.getView().setModel(this._tela, "tela");
			this.frota.aoAtualizar(this._montar, this);
			this.roteador().getRoute("RouteIndicadores").attachPatternMatched(this._montar, this);

			// Indice geral: a composicao, com cada parcela levando a sua lista.
			this.tornarClicavel("cardGeral", function () { this.abrirDetalhamento("efetividade"); });
		},

		/** Parcela clicada: a lista que forma o numerador e o denominador. */
		onAbrirParcela: function (evento) {
			var contexto = evento.getSource().getBindingContext("tela");
			if (!contexto) { return; }
			this.abrirDetalhamento("parcela", contexto.getProperty("id"));
		},

		onAbrirPilotoRastreadores: function () {
			this.abrirDetalhamento("rastreadores");
		},

		onAbrirPilotoGateways: function () {
			this.abrirDetalhamento("gateways", false);
		},

		/**
		 * Valor e texto saem da MESMA declaracao em regras/indicadores.
		 * Nao ha string de formula escrita a mao em lugar nenhum — e por
		 * isso que o "Como é calculado?" nao tem como divergir do numero.
		 */
		_montar: function () {
			var resultados = this.frota.modelo().getProperty("/indicadores") || {};
			var geral = resultados.efetividade || {};

			var parcelas = indicadores.INDICADORES.filter(function (i) {
				return i.tipo === "razao";
			}).map(function (ind) {
				var r = resultados[ind.id] || {};
				var e = indicadores.explicar(ind.id, resultados) || {};
				return {
					id: ind.id, titulo: ind.titulo, pergunta: ind.pergunta,
					valor: r.valor === undefined ? null : r.valor,
					conta: e.conta || "", ressalva: e.ressalva || ""
				};
			});

			var backend = this.frota.modelo().getProperty("/backend");
			var diferenca = "";
			if (backend && geral.valor !== null && geral.valor !== undefined) {
				var deles = Number(String(backend.indiceEfetividade || "").replace(",", "."));
				if (isFinite(deles)) {
					diferenca = this.i18n("indDiferenca", [Math.abs(deles - geral.valor * 100).toFixed(1).replace(".", ",")]);
				}
			}

			this._tela.setData({
				geral: geral,
				classe: indicadores.classificar(geral.valor),
				explicacaoGeral: indicadores.explicar("efetividade", resultados) || {},
				parcelas: parcelas,
				diferenca: diferenca
			});
		},

		paraPercentual: function (f) { return f === null || f === undefined ? 0 : Math.round(Math.min(f, 1) * 100); },
		estadoDaCobertura: function (f) {
			if (f === null || f === undefined) { return "None"; }
			var p = f * 100;
			return p >= 80 ? "Success" : (p >= 70 ? "Warning" : "Error");
		},

		onExit: function () {
			this.frota.pararDeOuvir(this._montar, this);
		}
	});
});
