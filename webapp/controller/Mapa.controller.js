sap.ui.define([
	"./BaseController",
	"../service/MapaLeaflet",
	"../model/regras/zonas",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast"
], function (BaseController, MapaLeaflet, zonas, JSONModel, MessageToast) {
	"use strict";

	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Mapa", {

		onInit: function () {
			this.usarFrota();
			this.escuro(false);
			this._tela = new JSONModel({ selecionado: null });
			this.getView().setModel(this._tela, "tela");

			this.frota.aoAtualizar(this._pintar, this);
			this.roteador().getRoute("RouteMapa").attachPatternMatched(this._aoEntrar, this);
			this.byId("mapaCheio").attachAfterRendering(this._montar, this);
		},

		_aoEntrar: function () {
			if (this._mapa) {
				this._mapa.ajustar();
				this._pintar();
			}
		},

		_montar: function () {
			if (this._mapa) { return; }
			var dominio = this.byId("mapaCheio").getDomRef();
			if (!dominio) { return; }
			var alvo = dominio.querySelector(".valeMapa") || dominio;

			// ampliado: satelite em brilho cheio, sem o veu da miniatura
			this._mapa = MapaLeaflet.criar(alvo, { base: "satelite", zoom: 12 });
			this._pintar();
		},

		_pintar: function () {
			if (!this._mapa) { return; }
			var m = this.frota.modelo();
			var cercas = m.getProperty("/zonas") || [];
			var antenas = m.getProperty("/gateways") || [];
			var ativos = m.getProperty("/ativos") || [];
			var that = this;

			this._mapa.desenharCercas(this.byId("btnCercas").getPressed() ? cercas : []);
			this._mapa.desenharGateways(this.byId("btnGateways").getPressed() ? antenas : []);
			this._mapa.desenharAtivos(ativos, function (a) {
				return that._posicaoDe(a);
			}, function (a) {
				that._tela.setProperty("/selecionado", a);
			});

			if (!this._enquadrou) {
				var caixa = zonas.enquadrar(
					cercas.reduce(function (acc, z) { return acc.concat(z.pontos); }, []),
					antenas.map(function (g) { return g.posicao; })
				);
				if (caixa) { this._mapa.enquadrar(caixa); this._enquadrou = true; }
			}
		},

		_posicaoDe: function (ativo) {
			var detalhe = this.frota.detalhe(ativo.codigo);
			if (detalhe && detalhe.posicao) { return detalhe.posicao; }
			var conf = this.frota.modelo().getProperty("/conferencia") || { veiculos: [] };
			var v = (conf.veiculos || []).filter(function (x) {
				return String(x.nome || "").toUpperCase() === ativo.veiculo;
			})[0];
			return v ? v.posicao : null;
		},

		onTrocarBase: function (evento) {
			this._mapa.trocarBase(evento.getParameter("item").getKey());
		},

		onAlternarCercas: function () { this._pintar(); },
		onAlternarGateways: function () { this._pintar(); },

		onAlternarLegendas: function (evento) {
			this._mapa.alternarLegendas(evento.getSource().getPressed());
		},

		onBuscarNoMapa: function (evento) {
			var termo = String(evento.getParameter("query") || "").trim().toUpperCase();
			if (!termo) { return; }
			var ativos = this.frota.modelo().getProperty("/ativos") || [];
			var achado = ativos.filter(function (a) {
				return String(a.codigoOriginal).toUpperCase().indexOf(termo) >= 0 ||
					String(a.nota || "").toUpperCase() === termo ||
					String(a.veiculo || "").indexOf(termo) >= 0;
			})[0];
			if (!achado) {
				MessageToast.show(this.i18n("mapaNadaEncontrado", [termo]));
				return;
			}
			this._tela.setProperty("/selecionado", achado);
			this._mapa.irPara(this._posicaoDe(achado), 17);
		},

		onAbrirFicha: function () {
			var a = this._tela.getProperty("/selecionado");
			if (a) { this.navegarPara("RouteEquipamento", { codigo: a.codigo }); }
		},

		onReduzir: function () {
			this.navegarPara("RouteSalaDeControle");
		},

		onExit: function () {
			this.frota.pararDeOuvir(this._pintar, this);
			if (this._mapa) { this._mapa.destruir(); this._mapa = null; }
		}
	});
});
