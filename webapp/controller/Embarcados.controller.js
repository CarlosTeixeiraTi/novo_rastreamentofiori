sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Embarcados", {

		onInit: function () {
			this.usarFrota();
			this.escuro(false);
			this._tela = new JSONModel({ veiculo: "", linhas: [] });
			this.getView().setModel(this._tela, "tela");

			// Cards: cada um abre a lista de veiculos por tras do numero.
			this.tornarClicavel("cardVeiculos", function () { this.abrirDetalhamento("veiculos"); });
			this.tornarClicavel("cardConformes", function () { this.abrirDetalhamento("veiculos", "conformes"); });
			this.tornarClicavel("cardDivergentes", function () { this.abrirDetalhamento("veiculos", "divergentes"); });
			this.tornarClicavel("cardCobertura", function () { this.abrirDetalhamento("conferencia"); });
		},

		/** Familia do veiculo selecionado: os componentes rastreados dela. */
		onAbrirFamiliaDoVeiculo: function (evento) {
			var contexto = evento.getSource().getBindingContext("tela");
			if (!contexto) { return; }
			this.abrirDetalhamento("veiculoFamilia", this._tela.getProperty("/veiculo"), contexto.getProperty("familia"));
		},

		onExportarFamilias: function () {
			this.exportarDetalhamento(this.detalhamentos.familiasDoVeiculo(
				this.dadosDaFrota(), this._tela.getProperty("/veiculo"), this._tela.getProperty("/linhas")
			));
		},

		onSelecionar: function (evento) {
			var contexto = evento.getParameter("listItem").getBindingContext("frota");
			this._tela.setData({
				veiculo: contexto.getProperty("nome"),
				linhas: contexto.getProperty("linhas") || []
			});
		},

		/** Conferencia inteira (veiculo × familia), a mesma do card Cobertura. */
		onExportar: function () {
			this.exportarDetalhamento(this.detalhamentos.conferencia(this.dadosDaFrota()));
		},

		paraPercentual: function (f) { return f === null || f === undefined ? 0 : Math.round(Math.min(f, 1) * 100); },
		estadoDaCobertura: function (f) {
			if (f === null || f === undefined) { return "None"; }
			var p = f * 100;
			return p >= 100 ? "Success" : (p >= 80 ? "Warning" : "Error");
		},
		textoSituacao: function (conforme) { return conforme ? this.i18n("embConforme") : this.i18n("embDivergente"); },
		estadoSituacao: function (conforme) { return conforme ? "Success" : "Error"; },
		textoDiferenca: function (d) {
			if (d === 0) { return this.i18n("embConfere"); }
			return d < 0 ? this.i18n("embFaltando", [Math.abs(d)]) : this.i18n("embSobrando", [d]);
		},
		estadoDaDiferenca: function (d) { return d === 0 ? "Success" : (d < 0 ? "Error" : "Warning"); }
	});
});
