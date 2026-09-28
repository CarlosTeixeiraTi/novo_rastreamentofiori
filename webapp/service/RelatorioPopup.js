/**
 * Popup de detalhamento exportavel — o padrao da Sala de Controle.
 *
 * Todo item clicavel das telas abre isto: uma tabela, uma busca, o botao
 * EXCEL (exporta exatamente o que esta na tabela, ja filtrado) e o OK.
 *
 * A definicao da lista (titulo, colunas, linhas) vem de
 * model/regras/detalhamentos. Aqui so ha apresentacao:
 *   - coluna "equipamento" vira link para a ficha, quando o equipamento
 *     tem ficha (tem rastreador e esta no recorte); senao fica como texto;
 *   - coluna "gateway" vira link para os equipamentos daquele gateway;
 *   - coluna "acao" vira link para outra lista (drill-down).
 *
 * Ao seguir para a ficha do equipamento, todos os popups abertos fecham —
 * antes o popup ficava aberto por cima da ficha.
 */
sap.ui.define([
	"sap/m/Dialog",
	"sap/m/Table",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/m/Text",
	"sap/m/Link",
	"sap/m/Button",
	"sap/m/SearchField",
	"sap/m/OverflowToolbar",
	"sap/m/ToolbarSpacer",
	"sap/m/VBox",
	"sap/ui/model/json/JSONModel",
	"sap/ui/export/Spreadsheet",
	"sap/ui/export/library",
	"../model/regras/indicadores"
], function (
	Dialog, Table, Column, ColumnListItem, Text, Link, Button, SearchField,
	OverflowToolbar, ToolbarSpacer, VBox, JSONModel, Spreadsheet, exportLibrary,
	indicadores
) {
	"use strict";

	var EdmType = exportLibrary.EdmType;
	var abertos = [];

	function vazio(v) {
		return v === null || v === undefined || v === "";
	}

	/** Valor como aparece na tela (e no Excel, para colunas de texto). */
	function formatar(coluna, valor) {
		if (vazio(valor)) { return coluna.tipo === "numero" || coluna.tipo === "percentual" ? "—" : ""; }
		if (coluna.tipo === "equipamento") { return String(valor).replace(/^0+(?=.)/, ""); }
		if (coluna.tipo === "percentual") { return indicadores.formatarPercentual(valor); }
		if (coluna.tipo === "numero" && typeof valor === "number") {
			return new Intl.NumberFormat("pt-BR").format(valor);
		}
		return String(valor);
	}

	function larguraExcel(coluna) {
		if (coluna.tipo === "numero" || coluna.tipo === "percentual") { return 12; }
		var rem = parseInt(coluna.largura, 10);
		return rem ? Math.max(10, Math.round(rem * 1.6)) : 30;
	}

	function colunasExcel(def) {
		return def.colunas.map(function (c) {
			var col = { label: c.rotulo, property: c.chave, width: larguraExcel(c) };
			if (c.tipo === "numero") { col.type = EdmType.Number; }
			if (c.tipo === "percentual") { col.type = EdmType.Percentage; col.scale = 1; }
			return col;
		});
	}

	/** Linhas no formato do Excel: codigo sem zeros, numero como numero. */
	function linhasExcel(def, linhas) {
		return linhas.map(function (l) {
			var saida = {};
			def.colunas.forEach(function (c) {
				var v = l[c.chave];
				if (c.tipo === "numero" || c.tipo === "percentual") {
					saida[c.chave] = typeof v === "number" ? v : null;
				} else {
					saida[c.chave] = formatar(c, v);
				}
			});
			return saida;
		});
	}

	function nomeArquivo(def) {
		var base = String(def.arquivo || def.titulo || "relatorio")
			.normalize("NFD").replace(/[̀-ͯ]/g, "")
			.replace(/[^\w-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
		return base + ".xlsx";
	}

	/**
	 * Celula de uma linha: link para a ficha, para o gateway, para outra
	 * lista — ou texto. Usada pelo popup e pela tela de Relatorios.
	 */
	function criarCelula(coluna, linha, op) {
		var valor = linha[coluna.chave];
		var rotulo = formatar(coluna, valor);

		if (coluna.tipo === "equipamento" && !vazio(valor)) {
			var temFicha = !op.temFicha || op.temFicha(valor);
			if (temFicha && op.abrirFicha) {
				return new Link({
					text: rotulo,
					tooltip: "Abrir a ficha do equipamento",
					press: function () {
						api.fecharTodos();
						op.abrirFicha(valor);
					}
				}).addStyleClass("valeMono");
			}
			return new Text({
				text: rotulo,
				tooltip: "Sem ficha: equipamento sem rastreador ou fora do recorte atual"
			}).addStyleClass("valeMono");
		}

		if (coluna.tipo === "gateway" && !vazio(valor) && op.abrirGateway &&
			(!op.temGateway || op.temGateway(valor))) {
			return new Link({
				text: rotulo,
				tooltip: "Ver os equipamentos lidos por este gateway",
				press: function () { op.abrirGateway(valor); }
			});
		}

		if (coluna.tipo === "acao" && op.acionar &&
			(!op.podeAcionar || op.podeAcionar(coluna.acao, linha))) {
			return new Link({
				text: rotulo,
				tooltip: "Detalhar",
				press: function () { op.acionar(coluna.acao, linha); }
			});
		}

		return new Text({ text: rotulo, wrapping: coluna.tipo !== "numero" && coluna.tipo !== "percentual" });
	}

	var api = {

		/** Exporta uma definicao (ou um subconjunto das linhas) para Excel. */
		exportar: function (def, linhas) {
			var planilha = new Spreadsheet({
				workbook: { columns: colunasExcel(def) },
				dataSource: linhasExcel(def, linhas || def.linhas || []),
				fileName: nomeArquivo(def)
			});
			return planilha.build().finally(function () {
				planilha.destroy();
			});
		},

		criarCelula: function (coluna, linha, opcoes) {
			return criarCelula(coluna, linha, opcoes || {});
		},

		/** Fecha todos os popups abertos (usado antes de navegar para a ficha). */
		fecharTodos: function () {
			abertos.slice().forEach(function (d) { d.close(); });
		},

		/**
		 * @param {object} def     { titulo, arquivo, colunas, linhas, nota? }
		 * @param {object} opcoes  callbacks:
		 *   temFicha(codigo) / abrirFicha(codigo)
		 *   temGateway(id)   / abrirGateway(id)
		 *   podeAcionar(acao, linha) / acionar(acao, linha)
		 */
		abrir: function (def, opcoes) {
			var op = opcoes || {};
			var todas = (def.linhas || []).slice();
			var modelo = new JSONModel({ linhas: todas, contador: "" });
			modelo.setSizeLimit(100000);

			function contar() {
				var n = modelo.getProperty("/linhas").length;
				modelo.setProperty("/contador", n === todas.length
					? n + (n === 1 ? " item" : " itens")
					: n + " de " + todas.length + " itens");
			}
			contar();

			var dialogo;

			var tabela = new Table({
				sticky: ["ColumnHeaders"],
				growing: true,
				growingThreshold: 200,
				growingScrollToLoad: true,
				noDataText: "Nada a listar.",
				columns: def.colunas.map(function (c) {
					var alinhaDireita = c.tipo === "numero" || c.tipo === "percentual";
					return new Column({
						width: c.largura,
						hAlign: alinhaDireita ? "End" : "Begin",
						header: new Text({ text: c.rotulo, wrapping: true })
					});
				})
			});
			tabela.setModel(modelo, "pop");
			tabela.bindItems({
				path: "pop>/linhas",
				factory: function (id, contexto) {
					var linha = contexto.getObject();
					return new ColumnListItem(id, {
						cells: def.colunas.map(function (c) { return criarCelula(c, linha, op); })
					});
				}
			});

			var busca = new SearchField({
				width: "20rem",
				placeholder: "Buscar na lista",
				liveChange: function (evento) {
					var termo = String(evento.getParameter("newValue") || "").trim().toLowerCase();
					modelo.setProperty("/linhas", !termo ? todas : todas.filter(function (l) {
						return def.colunas.some(function (c) {
							return formatar(c, l[c.chave]).toLowerCase().indexOf(termo) >= 0;
						});
					}));
					contar();
				}
			});

			var contador = new Text({ text: "{pop>/contador}" }).addStyleClass("valeKpiPe");
			contador.setModel(modelo, "pop");

			var conteudo = [];
			if (def.nota) {
				conteudo.push(new Text({ text: def.nota, renderWhitespace: true })
					.addStyleClass("valeKpiPe sapUiSmallMarginBegin sapUiSmallMarginEnd sapUiTinyMarginTop sapUiTinyMarginBottom"));
			}
			conteudo.push(tabela);

			dialogo = new Dialog({
				title: def.titulo,
				contentWidth: def.largura || "1100px",
				contentHeight: def.altura || "600px",
				draggable: true,
				resizable: true,
				subHeader: new OverflowToolbar({ content: [busca, new ToolbarSpacer(), contador] }),
				content: [new VBox({ items: conteudo })],
				beginButton: new Button({
					text: "EXCEL",
					icon: "sap-icon://excel-attachment",
					tooltip: "Exportar para Excel o que está na lista",
					press: function () {
						api.exportar(def, modelo.getProperty("/linhas"));
					}
				}).addStyleClass("botaoDialogExcel"),
				endButton: new Button({
					text: "OK",
					press: function () { dialogo.close(); }
				}).addStyleClass("botaoDialogCinza"),
				afterClose: function () {
					abertos = abertos.filter(function (d) { return d !== dialogo; });
					dialogo.destroy();
				}
			});
			dialogo.addStyleClass("valeRelatorioPopup");

			abertos.push(dialogo);
			dialogo.open();
			return dialogo;
		}
	};

	return api;
});
