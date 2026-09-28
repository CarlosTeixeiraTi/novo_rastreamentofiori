/**
 * Base dos controllers das telas novas.
 *
 * As tres telas antigas nao herdam daqui e seguem intactas.
 */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"../model/Frota",
	"../model/Configuracoes",
	"../model/regras/indicadores",
	"../model/regras/detalhamentos",
	"../model/regras/prefixo",
	"../service/RelatorioPopup"
], function (Controller, UIComponent, Frota, Configuracoes, indicadores, detalhamentos, prefixo, RelatorioPopup) {
	"use strict";

	return Controller.extend("br.com.smartpcm.rastreamento.zrastreio.controller.BaseController", {

		frota: Frota,

		/** Configuracoes do sistema em vigor (guia Configuracoes). */
		configuracoes: Configuracoes,

		/** Declaracao das listas clicaveis — disponivel para todas as telas. */
		detalhamentos: detalhamentos,

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
			this.getView().setModel(Configuracoes.modelo(), "config");
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
		},

		/* ================================================================
		 * Itens clicaveis → popup exportavel (o padrao da Sala de Controle)
		 * ================================================================ */

		/**
		 * Torna um card (VBox) clicavel e acessivel por teclado.
		 * Chamar no onInit: attachBrowserEvent sobrevive a re-renderizacao,
		 * ao contrario do .on() do jQuery feito no onAfterRendering, e nao
		 * acumula um handler novo a cada renderizacao.
		 */
		tornarClicavel: function (id, aoClicar) {
			var controle = typeof id === "string" ? this.byId(id) : id;
			if (!controle) { return; }
			var that = this;
			controle.addStyleClass("valeCardClicavel");
			controle.attachBrowserEvent("click", function () { aoClicar.call(that); });
			controle.attachBrowserEvent("keydown", function (e) {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					aoClicar.call(that);
				}
			});
			controle.addEventDelegate({
				onAfterRendering: function () {
					controle.$().attr({ tabindex: 0, role: "button" });
				}
			});
		},

		/** Snapshot da frota do qual todas as listas saem. */
		dadosDaFrota: function () {
			return Frota.modelo().getData();
		},

		/**
		 * Abre o popup de uma lista. Aceita a definicao pronta ou o nome de
		 * uma funcao de detalhamentos + argumentos:
		 *   this.abrirDetalhamento("mudos")
		 *   this.abrirDetalhamento("familia", "MOTOR")
		 */
		abrirDetalhamento: function (defOuNome) {
			var def = defOuNome;
			if (typeof defOuNome === "string") {
				var args = [this.dadosDaFrota()].concat(Array.prototype.slice.call(arguments, 1));
				def = detalhamentos[defOuNome].apply(detalhamentos, args);
			}
			if (!def) { return null; }
			return RelatorioPopup.abrir(def, this._opcoesDoPopup());
		},

		/** Exporta uma lista direto para Excel, sem abrir popup. */
		exportarDetalhamento: function (def) {
			return RelatorioPopup.exportar(def);
		},

		/** Se o equipamento tem ficha (rastreador no recorte atual). */
		temFicha: function (codigo) {
			var k = prefixo.chave(codigo);
			if (!k) { return false; }
			return (Frota.modelo().getProperty("/ativos") || []).some(function (a) {
				return a.codigo === k;
			});
		},

		/** Vai para a ficha do equipamento, fechando qualquer popup aberto. */
		abrirFicha: function (codigo) {
			RelatorioPopup.fecharTodos();
			this.navegarPara("RouteEquipamento", { codigo: prefixo.chave(codigo) });
		},

		_gatewayPorChave: function (chave) {
			var alvo = String(chave || "");
			return (Frota.modelo().getProperty("/gateways") || []).filter(function (g) {
				return g.identificador === alvo || g.id === alvo;
			})[0] || null;
		},

		/** Gateway clicado: equipamentos lidos por ele, com o cadastro no topo. */
		abrirGateway: function (chave) {
			var g = this._gatewayPorChave(chave);
			var id = g ? (g.identificador || g.id) : chave;
			var def = detalhamentos.doGateway(this.dadosDaFrota(), id);
			if (g) {
				def.nota = "ID: " + (g.id || "—") +
					"  ·  Localidade: " + (g.localidade || "—") +
					"  ·  Condição: " + (g.condicao || "—") +
					"  ·  Situação: " + (g.ativo ? "Ativo" : "Inativo");
			}
			return this.abrirDetalhamento(def);
		},

		/** Drill-down de uma coluna "acao" para a lista seguinte. */
		_acionar: function (acao, linha) {
			var d = this.dadosDaFrota();
			if (acao === "familia") {
				return this.abrirDetalhamento(detalhamentos.familia(d, linha.familia));
			}
			if (acao === "veiculo") {
				return this.abrirDetalhamento(detalhamentos.familiasDoVeiculo(d, linha.veiculo));
			}
			if (acao === "veiculoFamilia") {
				return this.abrirDetalhamento(detalhamentos.veiculoFamilia(d, linha.veiculo, linha.familiaId));
			}
			if (acao === "parcela") {
				return this.abrirDetalhamento(detalhamentos.parcela(d, linha.parcela));
			}
			return null;
		},

		_podeAcionar: function (acao, linha) {
			if (acao === "familia") { return !!linha.familia; }
			if (acao === "veiculo") { return !!linha.veiculo; }
			if (acao === "veiculoFamilia") { return !!(linha.veiculo && linha.familiaId); }
			if (acao === "parcela") { return !!linha.parcela; }
			return false;
		},

		_opcoesDoPopup: function () {
			var that = this;
			return {
				temFicha: function (c) { return that.temFicha(c); },
				abrirFicha: function (c) { that.abrirFicha(c); },
				temGateway: function (c) {
					return !!that._gatewayPorChave(c) ||
						(Frota.modelo().getProperty("/ativos") || []).some(function (a) { return a.gateway === c; });
				},
				abrirGateway: function (c) { that.abrirGateway(c); },
				podeAcionar: function (a, l) { return that._podeAcionar(a, l); },
				acionar: function (a, l) { that._acionar(a, l); }
			};
		}
	});
});
