sap.ui.define([
	"./BaseController",
	"../model/regras/relatorios",
	"sap/ui/model/json/JSONModel",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/m/Text",
	"sap/ui/export/Spreadsheet",
	"../service/RelatorioPopup",
	"./personalizados/Personalizados"
], function (BaseController, relatorios, JSONModel, Column, ColumnListItem, Text, Spreadsheet, RelatorioPopup,
	Personalizados) {
	"use strict";

	/**
	 * Duas abas: "Padrao" (os relatorios fixos, abaixo) e "Personalizados"
	 * (montados pelo usuario — metodos em ./personalizados/Personalizados.js,
	 * misturados a este controller).
	 */
	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Relatorios", Object.assign({}, Personalizados, {

		onInit: function () {
			this.usarFrota();
			this.escuro(false);
			this._tela = new JSONModel({ relatorios: [], atual: {}, linhas: [], aba: "padrao" });
			this.getView().setModel(this._tela, "tela");
			this._iniciarPersonalizados();
			this.frota.aoAtualizar(this._recarregar, this);
			this.frota.aoAtualizar(this._recalcularPersonalizado, this);
			this.roteador().getRoute("RouteRelatorios").attachPatternMatched(this._aoEntrar, this);
		},

		/**
		 * O menu "Gateways e leitoras" chega aqui com um id de relatorio em
		 * .../relatorios/{id}. Sem isto a tela sempre abria no primeiro
		 * relatorio da lista, entao o link de Gateways parecia nao levar a
		 * lugar nenhum (mostrava sempre "Componentes sem rastreador").
		 */
		_aoEntrar: function (evento) {
			var args = (evento && evento.getParameter("arguments")) || {};
			if (args.id && relatorios.obter(args.id)) {
				this._atual = args.id;
				this._tela.setProperty("/aba", "padrao");
			}
			// relatorios/personalizados abre direto na aba dos personalizados
			if (args.id === "personalizados") {
				this._tela.setProperty("/aba", "personalizados");
			}
			// carrega a biblioteca ja na entrada: o contador da aba fica certo
			this._garantirPersonalizados();
			this._recarregar();
		},

		/** Todos saem do mesmo contexto da frota — nenhum consulta sozinho. */
		_recarregar: function () {
			var ctx = this.frota.contextoRelatorios();
			var lista = relatorios.RELATORIOS.map(function (r) {
				return {
					id: r.id, titulo: r.titulo, pergunta: r.pergunta, acao: r.acao,
					total: r.linhas(ctx).length
				};
			});
			this._tela.setProperty("/relatorios", lista);

			if (!this._atual && lista.length) { this._atual = lista[0].id; }
			this._mostrar(this._atual);

			var listaUI = this.byId("listaRelatorios");
			var itens = listaUI.getItems();
			for (var i = 0; i < itens.length; i++) {
				if (lista[i] && lista[i].id === this._atual) { listaUI.setSelectedItem(itens[i]); }
			}
		},

		onSelecionar: function (evento) {
			var contexto = evento.getParameter("listItem").getBindingContext("tela");
			this._atual = contexto.getProperty("id");
			this._mostrar(this._atual);
		},

		_mostrar: function (id) {
			var montado = relatorios.montar(id, this.frota.contextoRelatorios());
			if (!montado) { return; }

			this._tela.setProperty("/atual", {
				id: montado.relatorio.id,
				titulo: montado.relatorio.titulo,
				pergunta: montado.relatorio.pergunta,
				acao: montado.relatorio.acao
			});
			this._tela.setProperty("/linhas", montado.linhas);

			/**
			 * As colunas sao reconstruidas a cada troca: cada relatorio tem
			 * o seu conjunto, declarado junto com a consulta que o gera.
			 */
			var tabela = this.byId("tabela");
			tabela.destroyColumns();
			var colunas = montado.relatorio.colunas;
			colunas.forEach(function (c) {
				tabela.addColumn(new Column({
					width: c.largura,
					header: new Text({ text: c.rotulo })
				}));
			});

			// Mesmo padrao dos popups: equipamento leva a ficha, gateway aos
			// equipamentos dele, veiculo a arvore do veiculo.
			var opcoes = this._opcoesDoPopup();
			tabela.bindItems({
				path: "tela>/linhas",
				factory: function (id, contexto) {
					var linha = contexto.getObject();
					return new ColumnListItem(id, {
						cells: colunas.map(function (c) {
							return RelatorioPopup.criarCelula(c, linha, opcoes);
						})
					});
				}
			});
		},

		onExportar: function () {
			var atual = relatorios.obter(this._atual);
			if (!atual) { return; }
			new Spreadsheet({
				workbook: { columns: relatorios.colunasParaExportacao(atual) },
				dataSource: this._tela.getProperty("/linhas"),
				fileName: atual.id + ".xlsx"
			}).build();
		},

		onExit: function () {
			this.frota.pararDeOuvir(this._recarregar, this);
			this.frota.pararDeOuvir(this._recalcularPersonalizado, this);
		}
	}));
});
