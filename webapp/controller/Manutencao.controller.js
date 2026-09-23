sap.ui.define([
	"./BaseController",
	"../model/regras/prefixo",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/export/Spreadsheet"
], function (BaseController, prefixo, JSONModel, Filter, FilterOperator, Spreadsheet) {
	"use strict";

	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Manutencao", {

		onInit: function () {
			this.usarFrota();
			this.escuro(false);
			this._tela = new JSONModel({ semTag: 0 });
			this.getView().setModel(this._tela, "tela");
			this.frota.modelo().attachPropertyChange(this._contar, this);
			this.roteador().getRoute("RouteManutencao").attachPatternMatched(this._contar, this);
		},

		/** Nota aberta cujo equipamento nao tem tag: ninguem acompanha. */
		_contar: function () {
			var m = this.frota.modelo();
			var comTag = {};
			(m.getProperty("/ativos") || []).forEach(function (a) { comTag[a.codigo] = true; });
			var semTag = (m.getProperty("/notas") || []).filter(function (n) {
				return !comTag[prefixo.chave(n.equipamento)];
			}).length;
			this._tela.setProperty("/semTag", semTag);
		},

		onBuscar: function (evento) {
			var termo = String(evento.getParameter("newValue") || "").trim();
			var filtros = termo ? [new Filter({
				filters: [
					new Filter("equipamento", FilterOperator.Contains, termo),
					new Filter("nota", FilterOperator.Contains, termo),
					new Filter("txt_breve_nota", FilterOperator.Contains, termo),
					new Filter("oficina", FilterOperator.Contains, termo)
				],
				and: false
			})] : [];
			this.byId("tabela").getBinding("items").filter(filtros);
		},

		onAbrir: function (evento) {
			var contexto = evento.getSource().getBindingContext("frota");
			var codigo = prefixo.chave(contexto.getProperty("equipamento"));
			this.navegarPara("RouteEquipamento", { codigo: codigo });
		},

		onExportar: function () {
			var binding = this.byId("tabela").getBinding("items");
			var linhas = (binding ? binding.getCurrentContexts() : []).map(function (c) { return c.getObject(); });
			new Spreadsheet({
				workbook: {
					columns: [
						{ label: "Equipamento", property: "equipamento", width: 14 },
						{ label: "Nota", property: "nota", width: 12 },
						{ label: "Ordem", property: "ordem_numero", width: 12 },
						{ label: "Texto breve", property: "txt_breve_nota", width: 40 },
						{ label: "Oficina", property: "oficina", width: 18 },
						{ label: "Local de instalação", property: "local_instalacao", width: 16 },
						{ label: "Status sistema", property: "status_sistema", width: 12 },
						{ label: "Prioridade", property: "prioridade", width: 10 }
					]
				},
				dataSource: linhas,
				fileName: "notas-e-ordens.xlsx"
			}).build();
		},

		onExit: function () {
			this.frota.modelo().detachPropertyChange(this._contar, this);
		}
	});
});
