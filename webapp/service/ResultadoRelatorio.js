/**
 * Desenha o resultado de um relatorio personalizado dentro de um VBox:
 * cartao da metrica (numero, conta, farol, parcelas clicaveis), a tabela
 * (com cada numero clicavel levando aos registros por tras dele) e o
 * grafico.
 *
 * Usado na aba Personalizados e na pre-visualizacao do editor e do
 * assistente — o que se ve ao montar e o que se ve depois de salvo.
 */
sap.ui.define([
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/m/Title",
	"sap/m/Text",
	"sap/m/Link",
	"sap/m/ObjectStatus",
	"sap/m/MessageStrip",
	"sap/m/Table",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/ui/model/json/JSONModel",
	"./RelatorioPopup",
	"./GraficoRelatorio",
	"../model/regras/relatorioPersonalizado"
], function (VBox, HBox, Title, Text, Link, ObjectStatus, MessageStrip, Table, Column,
	ColumnListItem, JSONModel, RelatorioPopup, GraficoRelatorio, motor) {
	"use strict";

	function escapar(t) {
		return String(t === null || t === undefined ? "" : t)
			.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	function formatar(coluna, v) {
		if (coluna.tipo === "percentual") {
			return v === null || v === undefined ? "—" : motor.formatarValor(v, "percentual", coluna.casas === undefined ? 1 : coluna.casas);
		}
		if (coluna.tipo === "numero") {
			if (v === null || v === undefined || v === "") { return "—"; }
			if (typeof v !== "number") { return String(v); }
			return coluna.formato === "decimal" || coluna.casas !== undefined
				? motor.formatarNumero(v, coluna.casas)
				: motor.formatarNumero(v);
		}
		return v === null || v === undefined ? "" : String(v);
	}

	var CLASSE_FAROL = { Success: "valeFarolVerde", Warning: "valeFarolAmarelo", Error: "valeFarolVermelho" };

	function cartaoMetrica(def, r, op) {
		var numero = new Title({ text: r.texto, level: "H1" }).addStyleClass("valeRelNumero");
		if (CLASSE_FAROL[r.farol]) { numero.addStyleClass(CLASSE_FAROL[r.farol]); }

		var cabeca = new HBox({ alignItems: "Center", wrap: "Wrap", items: [numero] });
		if (r.farol && r.farol !== "None") {
			cabeca.addItem(new ObjectStatus({
				text: r.farolTexto, state: r.farol, inverted: true,
				icon: r.farol === "Success" ? "sap-icon://sys-enter-2" : (r.farol === "Warning" ? "sap-icon://alert" : "sap-icon://error")
			}).addStyleClass("sapUiSmallMarginBegin"));
		}

		var itens = [
			cabeca,
			new Text({ text: r.conta }).addStyleClass("valeMono valeKpiPe")
		];

		if (def.metas && def.metas.verde !== null) {
			var un = def.formato === "percentual" ? "%" : "";
			var sinal = def.metas.sentido === "menor" ? "≤ " : "≥ ";
			itens.push(new Text({
				text: "Meta: verde " + sinal + def.metas.verde + un +
					(def.metas.amarelo !== null && def.metas.amarelo !== undefined ? " · amarelo " + sinal + def.metas.amarelo + un : "")
			}).addStyleClass("valeKpiPe"));
		}

		var parcelas = new VBox().addStyleClass("sapUiSmallMarginTop");
		r.parcelas.forEach(function (p) {
			parcelas.addItem(new HBox({
				alignItems: "Center",
				items: [
					new Link({
						text: p.id + " · " + p.rotulo,
						tooltip: "Ver os " + p.quantidade + " registro(s) de " + p.fonte + " que entram nesta parcela",
						press: function () { op.aoDetalhar({ parcela: p.id }); }
					}),
					new Text({ text: ": " + p.texto }).addStyleClass("valeMono sapUiTinyMarginBegin"),
					new Text({ text: "(" + p.fonte + ")" }).addStyleClass("valeKpiPe sapUiTinyMarginBegin")
				]
			}));
		});
		itens.push(parcelas);

		return new VBox({ items: itens }).addStyleClass("valeCartao sapUiSmallPadding sapUiSmallMarginBottom");
	}

	function tabela(def, r, op) {
		var colunas = r.colunas;
		var t = new Table({
			sticky: op.compacto ? [] : ["ColumnHeaders"],
			growing: true,
			growingThreshold: op.compacto ? 15 : 100,
			noDataText: "Nenhum registro atende aos filtros.",
			columns: colunas.map(function (c) {
				var direita = c.tipo === "numero" || c.tipo === "percentual";
				return new Column({
					hAlign: direita ? "End" : "Begin",
					header: new Text({ text: c.rotulo, wrapping: true })
				});
			})
		});
		var modelo = new JSONModel({ linhas: r.linhas });
		modelo.setSizeLimit(100000);
		t.setModel(modelo, "res");
		t.bindItems({
			path: "res>/linhas",
			factory: function (id, contexto) {
				var linha = contexto.getObject();
				var item = new ColumnListItem(id, {
					cells: colunas.map(function (c) {
						var v = linha[c.chave];

						// resultado da metrica por grupo: com farol
						if (r.tipo === "metrica" && c.chave === "resultado") {
							return new ObjectStatus({ text: formatar(c, v), state: linha._farol || "None" });
						}

						// numero com registros por tras: clicavel
						if (c.drill && typeof v === "number" && linha._alvo) {
							var alvo = Object.assign({}, linha._alvo);
							if (r.tipo === "metrica") { alvo.parcela = c.chave; }
							if (c._coluna !== undefined) { alvo.coluna = c._coluna; }
							return new Link({
								text: formatar(c, v),
								tooltip: "Ver os registros",
								press: function () { op.aoDetalhar(alvo); }
							});
						}

						if (c.tipo === "equipamento") {
							return RelatorioPopup.criarCelula({ chave: c.chave, tipo: "equipamento" }, linha, op.opcoesCelula || {});
						}
						return new Text({ text: formatar(c, v) });
					})
				});
				if (linha._total) { item.addStyleClass("valeLinhaTotal"); }
				if (linha._outros) { item.addStyleClass("valeLinhaOutros"); }
				return item;
			}
		});
		return t;
	}

	var api = {

		formatar: formatar,

		/**
		 * @param {sap.m.VBox} alvo    onde desenhar (os itens atuais sao destruidos)
		 * @param {object} def         definicao normalizada
		 * @param {object} r           resultado de motor.executar
		 * @param {object} op          { compacto, aoDetalhar(alvo), opcoesCelula }
		 */
		desenhar: function (alvo, def, r, op) {
			var o = op || {};
			alvo.destroyItems();

			if (!r || (r.erros && r.erros.length)) {
				alvo.addItem(new MessageStrip({
					type: "Warning",
					showIcon: true,
					enableFormattedText: true,
					text: "<strong>Ajuste para calcular:</strong><br>" +
						((r && r.erros) || ["Relatório vazio."]).map(function (e) { return "• " + escapar(e); }).join("<br>")
				}));
				return;
			}

			if (r.tipo === "metrica") {
				alvo.addItem(cartaoMetrica(def, r, o));
				if (def.agrupamento) { alvo.addItem(tabela(def, r, o)); }
			} else {
				alvo.addItem(new Text({
					text: r.registros + " registro(s) de " + r.fonte + " atendem aos filtros" +
						(r.tipo === "lista" && r.linhas.length < r.registros ? " — mostrando " + r.linhas.length : "") +
						". Clique num número para ver os registros."
				}).addStyleClass("valeKpiPe sapUiTinyMarginBottom"));
				alvo.addItem(tabela(def, r, o));
			}

			if (GraficoRelatorio.temGrafico(r.grafico)) {
				var lugar = new VBox({ width: "100%" }).addStyleClass("sapUiSmallMarginTop");
				alvo.addItem(lugar);
				GraficoRelatorio.criar(r.grafico, o.compacto ? "260px" : "380px").then(function (controle) {
					if (controle && !(lugar.isDestroyed && lugar.isDestroyed())) { lugar.addItem(controle); }
				});
			}
		}
	};

	return api;
});
