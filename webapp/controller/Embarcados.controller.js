sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/export/Spreadsheet"
], function (BaseController, JSONModel, Spreadsheet) {
	"use strict";

	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Embarcados", {

		onInit: function () {
			this.usarFrota();
			this.escuro(false);
			this._tela = new JSONModel({ veiculo: "", linhas: [] });
			this.getView().setModel(this._tela, "tela");
		},

		onSelecionar: function (evento) {
			var contexto = evento.getParameter("listItem").getBindingContext("frota");
			this._tela.setData({
				veiculo: contexto.getProperty("nome"),
				linhas: contexto.getProperty("linhas") || []
			});
		},

		onExportar: function () {
			var veiculos = this.frota.modelo().getProperty("/conferencia/veiculos") || [];
			var linhas = [];
			veiculos.forEach(function (v) {
				(v.linhas || []).forEach(function (l) {
					linhas.push({
						veiculo: v.nome, local: v.local, familia: l.rotulo,
						naArvore: l.naArvore, comRastreador: l.comRastreador, diferenca: l.diferenca
					});
				});
			});
			new Spreadsheet({
				workbook: {
					columns: [
						{ label: "Veículo", property: "veiculo", width: 14 },
						{ label: "Local de instalação", property: "local", width: 18 },
						{ label: "Família", property: "familia", width: 20 },
						{ label: "Na árvore SAP", property: "naArvore", width: 12, type: "number" },
						{ label: "Com rastreador", property: "comRastreador", width: 12, type: "number" },
						{ label: "Diferença", property: "diferenca", width: 10, type: "number" }
					]
				},
				dataSource: linhas,
				fileName: "conferencia-embarcados.xlsx"
			}).build();
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
