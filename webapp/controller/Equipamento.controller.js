sap.ui.define([
	"./BaseController",
	"../service/MapaLeaflet",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/ui/core/routing/History"
], function (BaseController, MapaLeaflet, JSONModel, MessageToast, History) {
	"use strict";

	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Equipamento", {

		onInit: function () {
			this.usarFrota();
			this.escuro(false);
			this._tela = new JSONModel({ ativo: {}, confianca: { testes: [] }, historico: [], notas: [], ordens: [], arvore: [] });
			this.getView().setModel(this._tela, "tela");
			this.roteador().getRoute("RouteEquipamento").attachPatternMatched(this._aoEntrar, this);
			this.byId("mapaFicha").attachAfterRendering(this._montarMapa, this);
		},

		_aoEntrar: function (evento) {

			var that = this;

			this._codigo =
				evento.getParameter("arguments").codigo;

			this.frota.carregar()
				.then(function () {

					that._mostrar();

				})
				.catch(function (erro) {

					MessageToast.show(
						"Falha ao carregar: " + erro.message
					);

				});

		},

		_mostrar: function () {

			var detalhe =
				this.frota.detalhe(this._codigo);

			if (!detalhe) {

				MessageToast.show(
					this.i18n(
						"detNaoEncontrado",
						[this._codigo]
					)
				);

				return;
			}

			this._tela.setData(detalhe);
			this._pintarMapa();

		},
		_montarMapa: function () {
			if (this._mapa) { return; }
			var dominio = this.byId("mapaFicha").getDomRef();
			if (!dominio) { return; }
			var alvo = dominio.querySelector(".valeMiniMapa") || dominio;
			this._mapa = MapaLeaflet.criar(alvo, { base: "satelite", zoom: 16, zoomControl: false, attribution: false });
			this._pintarMapa();
		},

		/** Miniatura: o mesmo tile de satelite, travado no equipamento. */
		_pintarMapa: function () {
			if (!this._mapa) { return; }

			var dados = this._tela.getData();

			this._mapa.desenharCercas(
				this.frota.modelo().getProperty("/zonas") || []
			);

			this._mapa.ajustar();

			if (dados.posicao) {

				this._mapa.desenharAtivos(
					[dados.ativo],
					function () {
						return dados.posicao;
					},
					null
				);

				this._mapa.irPara(
					dados.posicao,
					16
				);
			}
		},

		onVerNoMapa: function () { this.navegarPara("RouteMapa"); },

		/**
		 * Volta para a tela de onde a ficha foi aberta (Sala, Manutencao,
		 * um popup de qualquer tela...). Sem historico, cai no Catalogo.
		 */
		onVoltar: function () {
			if (History.getInstance().getPreviousHash() !== undefined) {
				window.history.go(-1);
				return;
			}
			this.navegarPara("RouteCatalogo");
		},

		/* --- itens clicaveis e exportacoes da ficha --- */

		onAbrirGatewayAtual: function () {
			var gateway = this._tela.getProperty("/ativo/gateway");
			if (gateway) { this.abrirGateway(gateway); }
		},

		onAbrirGatewayDaLeitura: function (evento) {
			var gateway = evento.getSource().getBindingContext("tela").getProperty("gateway");
			if (gateway) { this.abrirGateway(gateway); }
		},

		/** Familia da arvore do veiculo: os componentes rastreados dela. */
		onAbrirFamiliaDoVeiculo: function (evento) {
			var contexto = evento.getSource().getBindingContext("tela");
			this.abrirDetalhamento("veiculoFamilia", this._tela.getProperty("/ativo/veiculo"), contexto.getProperty("familia"));
		},

		_sufixo: function () {
			return String(this._tela.getProperty("/ativo/codigoOriginal") || this._codigo || "").replace(/^0+/, "");
		},

		onExportarHistorico: function () {
			this.exportarDetalhamento(this.detalhamentos.historico(this._tela.getData()));
		},

		onExportarNotas: function () {
			var def = this.detalhamentos.notas(null, this._tela.getProperty("/notas"));
			def.arquivo = "Notas_" + this._sufixo();
			this.exportarDetalhamento(def);
		},

		onExportarOrdens: function () {
			var def = this.detalhamentos.ordens(null, this._tela.getProperty("/ordens"));
			def.arquivo = "Ordens_" + this._sufixo();
			this.exportarDetalhamento(def);
		},

		onExportarArvore: function () {
			var veiculo = this._tela.getProperty("/ativo/veiculo") || "";
			this.exportarDetalhamento(this.detalhamentos.familiasDoVeiculo(
				this.dadosDaFrota(), veiculo, this._tela.getProperty("/arvore")
			));
		},

		estadoDaConfianca: function (nivel) {
			if (nivel === "ALTA") { return "Success"; }
			if (nivel === "BAIXA") { return "Error"; }
			return "Warning";
		},

		estadoDaDiferenca: function (diferenca) {
			if (diferenca === 0) { return "Success"; }
			return diferenca < 0 ? "Error" : "Warning";
		},

		formatarData: function (valor) {
			if (!valor) { return ""; }
			var d = new Date(valor);
			return isNaN(d) ? String(valor) : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
		},

		onExit: function () {
			if (this._mapa) { this._mapa.destruir(); this._mapa = null; }
		}
	});
});
