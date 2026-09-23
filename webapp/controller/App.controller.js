sap.ui.define([
	"./BaseController",
	"../service/Backend",
	"sap/ui/core/Theming",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast"
], function (BaseController, Backend, Theming, JSONModel, MessageToast) {
	"use strict";

	var CHAVE_TEMA = "zrastreio:tema";

	/**
	 * Modo TV: rotaciona SOMENTE entre telas com mapa.
	 *
	 * No projeto legado ele sorteava qualquer tela, inclusive as de
	 * cadastro, e a reclamacao foi direta. Painel de parede serve para
	 * olhar de longe — tabela de nota fiscal nao se le a cinco metros.
	 */
	var ROTAS_TV = ["RouteSalaDeControle", "RouteMapa"];
	var INTERVALO_TV_MS = 20000;

	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.App", {

		onInit: function () {
			var componente = this.getOwnerComponent();
			var fonte = componente.getManifestEntry("/sap.app/dataSources/restService");

			/**
			 * A base sai do manifest, nao do controller. Em
			 * desenvolvimento o proxy do ui5.yaml manda /rest para o host
			 * real; em producao, o xs-app.json manda para a destination.
			 */
			Backend.init({
				base: (fonte && fonte.uri) || "/rest/",
				raizMock: sap.ui.require.toUrl("br/com/smartpcm/rastreamento/zrastreio/localService/mock"),
				mock: /(\?|&)mock=true/.test(window.location.search)
			});

			this.getView().setModel(this.usarFrota().modelo(), "frota");
			this._tela = new JSONModel({ tv: false, escuro: Theming.getTheme() === "sap_horizon_dark" });
			this.getView().setModel(this._tela, "tela");

			try {
				var salvo = window.localStorage.getItem(CHAVE_TEMA);
				if (salvo) { Theming.setTheme(salvo); }
			} catch (e) { /* sem persistencia nao e critico */ }

			this.frota.carregar().catch(function (erro) {
				MessageToast.show("Falha ao carregar: " + erro.message);
			});

			this.roteador().attachRouteMatched(this._aoTrocarDeRota, this);
		},

		_aoTrocarDeRota: function (evento) {
			var nome = evento.getParameter("name") || "";
			var chave = nome.replace(/^Route/, "");
			chave = chave.charAt(0).toLowerCase() + chave.slice(1);
			var nav = this.byId("navLateral");
			if (nav && chave) {
				nav.setSelectedKey(chave === "equipamento" ? "catalogo" : chave);
			}
		},

		onNavegar: function (evento) {
			var chave = evento.getParameter("item").getKey();
			var rotas = {
				salaDeControle: "RouteSalaDeControle",
				mapa: "RouteMapa",
				catalogo: "RouteCatalogo",
				embarcados: "RouteEmbarcados",
				indicadores: "RouteIndicadores",
				manutencao: "RouteManutencao",
				relatorios: "RouteRelatorios"
			};
			if (rotas[chave]) {
				this.navegarPara(rotas[chave]);
			} else if (chave === "gateways") {
				// Existe um relatorio "gateways" pronto (Gateways fora de
				// operacao) — sem o parametro, a tela abre no primeiro
				// relatorio da lista e o link de "Gateways e leitoras"
				// parece nao levar a lugar nenhum.
				this.navegarPara("RouteRelatorios", { id: "gateways" });
			} else {
				MessageToast.show(this.i18n("sobreTexto"));
			}
		},

		onAlternarMenu: function () {
			var pagina = this.byId("toolPage");
			pagina.setSideExpanded(!pagina.getSideExpanded());
		},

		onAlternarTema: function () {
			var atual = Theming.getTheme();
			var proximo = atual === "sap_horizon_dark" ? "sap_horizon" : "sap_horizon_dark";
			Theming.setTheme(proximo);
			this._tela.setProperty("/escuro", proximo === "sap_horizon_dark");
			try { window.localStorage.setItem(CHAVE_TEMA, proximo); } catch (e) { /* ok */ }
		},

		/* ---------------- Modo TV ---------------- */

		onAlternarTv: function () {
			if (this._tela.getProperty("/tv")) {
				this._pararTv();
			} else {
				this._iniciarTv();
			}
		},

		_iniciarTv: function () {
			var that = this;
			this._tela.setProperty("/tv", true);

			// painel de parede: sem menu lateral roubando espaco
			this._ladoAntesDaTv = this.byId("toolPage").getSideExpanded();
			this.byId("toolPage").setSideExpanded(false);

			this._proximaTela();
			this._timerTv = setInterval(function () { that._proximaTela(); }, INTERVALO_TV_MS);

			this._sairComEsc = function (e) {
				if (e.key === "Escape") { that._pararTv(); }
			};
			document.addEventListener("keydown", this._sairComEsc);

			var alvo = document.documentElement;
			if (alvo.requestFullscreen) {
				alvo.requestFullscreen().catch(function () { /* o navegador pode recusar */ });
			}
			MessageToast.show(this.i18n("modoTvLigado"));
		},

		_pararTv: function () {
			this._tela.setProperty("/tv", false);
			if (this._timerTv) { clearInterval(this._timerTv); this._timerTv = null; }
			if (this._sairComEsc) {
				document.removeEventListener("keydown", this._sairComEsc);
				this._sairComEsc = null;
			}
			this.byId("toolPage").setSideExpanded(this._ladoAntesDaTv !== false);
			if (document.fullscreenElement && document.exitFullscreen) {
				document.exitFullscreen().catch(function () { /* ok */ });
			}
		},

		/**
		 * Sorteia a proxima, sem repetir a que ja esta na tela: sortear com
		 * reposicao faz o painel ficar parado na mesma tela por dois ciclos,
		 * e quem olha de longe acha que travou.
		 */
		_proximaTela: function () {
			var disponiveis = ROTAS_TV.filter(function (r) { return r !== this._rotaTvAtual; }, this);
			var escolhida = disponiveis[Math.floor(Math.random() * disponiveis.length)] || ROTAS_TV[0];
			this._rotaTvAtual = escolhida;
			this.navegarPara(escolhida);
		},

		onExit: function () {
			this._pararTv();
		},

		onAtualizar: function () {
			var that = this;
			this.frota.carregar().then(function () {
				MessageToast.show(that.i18n("atualizado"));
			});
		},

		/**
		 * Busca global: codigo de equipamento, nota, ordem ou veiculo.
		 * Achando um equipamento, vai direto para a ficha.
		 */
		onBuscar: function (evento) {
			var termo = String(evento.getParameter("query") || "").trim();
			if (!termo) { return; }

			var ativos = this.frota.modelo().getProperty("/ativos") || [];
			var alvo = termo.toUpperCase();

			var achado = ativos.filter(function (a) {
				return String(a.codigo) === alvo.replace(/^0+/, "") ||
					String(a.codigoOriginal).toUpperCase() === alvo ||
					String(a.nota || "").toUpperCase() === alvo ||
					String(a.ordem || "").toUpperCase() === alvo;
			})[0];

			if (achado) {
				this.navegarPara("RouteEquipamento", { codigo: achado.codigo });
				return;
			}

			this.navegarPara("RouteCatalogo");
			var catalogo = sap.ui.getCore().byId("catalogo");
			if (catalogo) {
				var campo = catalogo.byId ? catalogo.byId("busca") : null;
				if (campo) { campo.setValue(termo); campo.fireSearch({ query: termo }); }
			}
			MessageToast.show(this.i18n("buscaSemResultadoDireto", [termo]));
		}
	});
});
