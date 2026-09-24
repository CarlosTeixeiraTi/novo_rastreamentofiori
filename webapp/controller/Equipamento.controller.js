sap.ui.define([
	"./BaseController",
	"../service/MapaLeaflet",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast"
], function (BaseController, MapaLeaflet, JSONModel, MessageToast) {
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
		onVoltar: function () { this.navegarPara("RouteCatalogo"); },

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
