sap.ui.define([
	"./BaseController",
	"../service/Backend",
	"../model/Configuracoes",
	"sap/ui/core/Theming",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast"
], function (BaseController, Backend, Configuracoes, Theming, JSONModel, MessageToast) {
	"use strict";

	/**
	 * Modo TV: sorteia entre Mapa operacional, Catalogo de ativos,
	 * Componentes embarcados, Indicadores e Manutencao e reforma.
	 *
	 * As telas participantes, o intervalo, a ordem (aleatoria ou em
	 * sequencia) e a tela cheia vem da guia Configuracoes
	 * (model/Configuracoes.js, TELAS_TV).
	 */

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
			this.getView().setModel(Configuracoes.modelo(), "config");
			Configuracoes.aoAlterar(this._aoMudarConfig, this);
			// O tema salvo ja foi aplicado no bootstrap (index.html), antes do
			// primeiro render. Aqui so lemos o estado e acompanhamos mudancas.
			this._tela = new JSONModel({ tv: false, escuro: this._temaEscuro(Theming.getTheme()) });
			this.getView().setModel(this._tela, "tela");
			this._aoAplicarTemaBound = this._aoAplicarTema.bind(this);
			Theming.attachApplied(this._aoAplicarTemaBound); // dispara ja na 1a vez se o tema estiver aplicado

			var that = this;
			this.frota.carregar().then(function () {
				// Recorte padrao definido em Configuracoes (so na abertura).
				var inicial = Configuracoes.obter("/prefixoPadrao");
				if (inicial && !that.frota.modelo().getProperty("/prefixo")) {
					that.frota.definirPrefixo(inicial);
				}
			}).catch(function (erro) {
				MessageToast.show("Falha ao carregar: " + erro.message);
			});

			if (Configuracoes.obter("/menuExpandido") === false) {
				this.byId("toolPage").setSideExpanded(false);
			}
			this._programarAtualizacao();

			this.roteador().attachRouteMatched(this._aoTrocarDeRota, this);
		},

		/* ---------------- Configuracoes ---------------- */

		/** Aplica o que mudou na guia Configuracoes, sem recarregar a pagina. */
		_aoMudarConfig: function (evento) {
			var antes = evento.getParameter("anterior");
			var agora = evento.getParameter("atual");

			if (agora.tema !== Theming.getTheme()) {
				Theming.setTheme(agora.tema);
			}
			if (antes.atualizacaoMin !== agora.atualizacaoMin) {
				this._programarAtualizacao();
			}
			// Limites de silencio mudam quem e "mudo": recalcula os cards.
			if (antes.silencio.instalado !== agora.silencio.instalado ||
				antes.silencio.padrao !== agora.silencio.padrao) {
				this.frota.recalcular();
			}
			// Modo TV ligado: reinicia com as telas/intervalo novos.
			if (this._tela.getProperty("/tv") &&
				JSON.stringify(antes.tv) !== JSON.stringify(agora.tv)) {
				clearInterval(this._timerTv);
				this._rotaTvAtual = null;
				this._indiceTv = -1;
				this._agendarTv();
			}
		},

		/** Atualizacao automatica dos dados (0 = desligada). */
		_programarAtualizacao: function () {
			var that = this;
			if (this._timerAtualizacao) {
				clearInterval(this._timerAtualizacao);
				this._timerAtualizacao = null;
			}
			var minutos = Configuracoes.obter("/atualizacaoMin");
			if (minutos > 0) {
				this._timerAtualizacao = setInterval(function () {
					that.frota.carregar().catch(function () { /* proxima tentativa no ciclo */ });
				}, minutos * 60000);
			}
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

			if (chave === "salaDeControle") {
				window.location.href = "http://localhost:8080/index.html#";
				return;
			}

			if (chave === "configuracoes") {
				this.navegarPara("RouteConfiguracoes", {});
				return;
			}

			var rotas = {
				mapa: "RouteSalaDeControle",
				catalogo: "RouteCatalogo",
				embarcados: "RouteEmbarcados",
				indicadores: "RouteIndicadores",
				manutencao: "RouteManutencao",
				relatorios: "RouteRelatorios"
			};

			if (rotas[chave]) {
				this.navegarPara(rotas[chave], {});
			} else if (chave === "gateways") {
				this.navegarPara("RouteRelatorios", { id: "gateways" });
			} else {
				MessageToast.show(this.i18n("sobreTexto", []));
			}
		},
		onAlternarMenu: function () {
			var pagina = this.byId("toolPage");
			pagina.setSideExpanded(!pagina.getSideExpanded());
		},

		_temaEscuro: function (tema) {
			return /_dark$|_hcb$/.test(tema || "");
		},

		_aoAplicarTema: function () {
			this._tela.setProperty("/escuro", this._temaEscuro(Theming.getTheme()));
		},

		onAlternarTema: function () {
			var proximo = this._temaEscuro(Theming.getTheme()) ? "sap_horizon" : "sap_horizon_dark";
			// Grava a escolha (zrastreio:tema, lida pelo index.html) e dispara
			// _aoMudarConfig, que aplica; /escuro e atualizado em _aoAplicarTema.
			Configuracoes.definirTema(proximo);
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

			this._rotaTvAtual = null;
			this._indiceTv = -1;
			this._agendarTv();

			this._sairComEsc = function (e) {
				if (e.key === "Escape") { that._pararTv(); }
			};
			document.addEventListener("keydown", this._sairComEsc);

			var alvo = document.documentElement;
			if (Configuracoes.obter("/tv/telaCheia") !== false && alvo.requestFullscreen) {
				alvo.requestFullscreen().catch(function () { /* o navegador pode recusar */ });
			}
			MessageToast.show(this.i18n("modoTvLigado", []));
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

		/** Vai para a primeira tela ja e agenda as proximas no intervalo configurado. */
		_agendarTv: function () {
			var that = this;
			var intervaloMs = (Configuracoes.obter("/tv/intervaloSeg") || 20) * 1000;
			this._proximaTela();
			this._timerTv = setInterval(function () { that._proximaTela(); }, intervaloMs);
		},

		/**
		 * Sorteia a proxima, sem repetir a que ja esta na tela: sortear com
		 * reposicao faz o painel ficar parado na mesma tela por dois ciclos,
		 * e quem olha de longe acha que travou. Com "ordem aleatoria"
		 * desligada em Configuracoes, segue a ordem do menu.
		 */
		_proximaTela: function () {
			var rotas = Configuracoes.rotasTv();
			var escolhida;
			if (Configuracoes.obter("/tv/aleatorio") === false) {
				this._indiceTv = ((this._indiceTv === undefined ? -1 : this._indiceTv) + 1) % rotas.length;
				escolhida = rotas[this._indiceTv];
			} else {
				var disponiveis = rotas.filter(function (r) { return r !== this._rotaTvAtual; }, this);
				escolhida = disponiveis[Math.floor(Math.random() * disponiveis.length)] || rotas[0];
			}
			this._rotaTvAtual = escolhida;
			this.navegarPara(escolhida, {});
		},

		onExit: function () {
			this._pararTv();
			if (this._timerAtualizacao) { clearInterval(this._timerAtualizacao); }
			Configuracoes.pararDeOuvir(this._aoMudarConfig, this);
			if (this._aoAplicarTemaBound) { Theming.detachApplied(this._aoAplicarTemaBound); }
		},

		onAtualizar: function () {
			var that = this;
			this.frota.carregar().then(function () {
				MessageToast.show(that.i18n("atualizado", []));
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

			this.navegarPara("RouteCatalogo", {});
			var catalogo = sap.ui.getCore().byId("catalogo");
			if (catalogo) {
				var campo = catalogo.byId ? catalogo.byId("busca") : null;
				if (campo) { campo.setValue(termo); campo.fireSearch({ query: termo }); }
			}
			MessageToast.show(this.i18n("buscaSemResultadoDireto", [termo]));
		}
	});
});
