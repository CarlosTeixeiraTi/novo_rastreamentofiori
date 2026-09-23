sap.ui.define([
	"./BaseController",
	"../model/regras/arvore",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/Item",
	"sap/ui/export/Spreadsheet"
], function (BaseController, arvore, Filter, FilterOperator, Item, Spreadsheet) {
	"use strict";

	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Catalogo", {

		onInit: function () {
			this.usarFrota();
			this.escuro(false);
			var seletor = this.byId("filtroFamilia");
			arvore.FAMILIAS.forEach(function (f) {
				seletor.addItem(new Item({ key: f.id, text: f.rotulo }));
			});
			this.frota.modelo().attachPropertyChange(this._contar, this);
			this.roteador().getRoute("RouteCatalogo").attachPatternMatched(this._contar, this);
		},

		onBuscar: function () { this._aplicar(); },
		onFiltrar: function () { this._aplicar(); },

		_aplicar: function () {
			var termo = String(this.byId("busca").getValue() || "").trim();
			var familia = this.byId("filtroFamilia").getSelectedKey();
			var situacao = this.byId("filtroSituacao").getSelectedKey();
			var filtros = [];

			if (termo) {
				filtros.push(new Filter({
					filters: [
						new Filter("codigoOriginal", FilterOperator.Contains, termo),
						new Filter("descricao", FilterOperator.Contains, termo),
						new Filter("identificacaoTecnica", FilterOperator.Contains, termo),
						new Filter("nota", FilterOperator.Contains, termo),
						new Filter("local", FilterOperator.Contains, termo)
					],
					and: false
				}));
			}
			if (familia) { filtros.push(new Filter("familia", FilterOperator.EQ, familia)); }
			if (situacao === "instalado") { filtros.push(new Filter("instalado", FilterOperator.EQ, true)); }
			if (situacao === "mudo") { filtros.push(new Filter("mudo", FilterOperator.EQ, true)); }
			if (situacao === "divergente") { filtros.push(new Filter("confianca", FilterOperator.EQ, "BAIXA")); }
			if (situacao === "semSap") { filtros.push(new Filter("noSap", FilterOperator.EQ, false)); }

			this.byId("tabela").getBinding("items").filter(filtros);
			this._contar();
		},

		_contar: function () {
			var binding = this.byId("tabela").getBinding("items");
			var total = this.frota.modelo().getProperty("/ativos").length;
			var visiveis = binding ? binding.getLength() : total;
			this.byId("contador").setText(this.i18n("catalogoContador", [visiveis, total]));
		},

		onAbrir: function (evento) {
			var contexto = evento.getSource().getBindingContext("frota");
			this.navegarPara("RouteEquipamento", { codigo: contexto.getProperty("codigo") });
		},

		/** Exporta o que esta filtrado, nao a lista inteira. */
		onExportar: function () {
			var binding = this.byId("tabela").getBinding("items");
			var linhas = (binding ? binding.getCurrentContexts() : []).map(function (c) { return c.getObject(); });
			new Spreadsheet({
				workbook: {
					columns: [
						{ label: "Equipamento", property: "codigoOriginal", width: 14 },
						{ label: "Descrição", property: "descricao", width: 34 },
						{ label: "Centro", property: "centro", width: 8 },
						{ label: "Local de instalação", property: "local", width: 18 },
						{ label: "Prefixo", property: "prefixo", width: 8 },
						{ label: "Situação", property: "grupoAtual", width: 22 },
						{ label: "Dias sem comunicar", property: "dias", width: 12, type: "number" },
						{ label: "Limite aplicado", property: "limite", width: 10, type: "number" },
						{ label: "Confiança do cadastro", property: "confianca", width: 12 }
					]
				},
				dataSource: linhas,
				fileName: "catalogo-de-ativos.xlsx"
			}).build();
		},

		estadoDoGrupo: function (instalado) { return instalado ? "Success" : "None"; },
		estadoDoSilencio: function (mudo) { return mudo ? "Error" : "Success"; },
		estadoDaConfianca: function (nivel) {
			if (nivel === "ALTA") { return "Success"; }
			if (nivel === "BAIXA") { return "Error"; }
			return "Warning";
		},

		onExit: function () {
			this.frota.modelo().detachPropertyChange(this._contar, this);
		}
	});
});
