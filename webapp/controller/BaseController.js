/**
 * Base dos controllers das telas novas.
 *
 * As tres telas antigas nao herdam daqui e seguem intactas.
 */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"../model/Frota",
	"../model/regras/indicadores"
], function (Controller, UIComponent, Frota, indicadores) {
	"use strict";

	return Controller.extend("br.com.smartpcm.rastreamento.zrastreio.controller.BaseController", {

		frota: Frota,

		roteador: function () {
			return UIComponent.getRouterFor(this);
		},

		i18n: function (chave, partes) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(chave, partes);
		},

		navegarPara: function (rota, parametros) {
			this.roteador().navTo(rota, parametros);
		},

		/**
		 * Liga a tela ao modelo compartilhado e garante uma carga unica.
		 * Cada tela chama isto no onInit; quem chegar depois reaproveita.
		 */
		usarFrota: function () {
			this.getView().setModel(Frota.modelo(), "frota");
			return Frota;
		},

		/** Aplica o escopo escuro nas telas de monitoramento. */
		escuro: function (ligado) {
			var pagina = this.getView().byId("pagina");
			if (!pagina) { return; }
			pagina.toggleStyleClass("valeEscuro", ligado !== false);
		},

		percentual: function (valor) {
			return indicadores.formatarPercentual(valor);
		},

		inteiro: function (valor) {
			if (valor === null || valor === undefined) { return "—"; }
			return new Intl.NumberFormat("pt-BR").format(valor);
		}
	});
});
