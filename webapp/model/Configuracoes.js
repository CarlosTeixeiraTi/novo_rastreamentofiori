/**
 * Configuracoes do sistema.
 *
 * Preferencias de uso da aplicacao, guardadas neste navegador
 * (localStorage). Nao mexem no backend nem nos dados: mudam como as telas
 * se comportam — tema, modo TV, atualizacao automatica, limites de
 * silencio, mapa padrao, recorte inicial e o nome usado nos relatorios.
 *
 * O tema continua TAMBEM na chave `zrastreio:tema`, porque e ela que o
 * index.html le antes do bootstrap para nao piscar o tema claro.
 */
sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/base/EventProvider",
	"./regras/silencio"
], function (JSONModel, EventProvider, silencio) {
	"use strict";

	var CHAVE = "zrastreio:config";
	var CHAVE_TEMA = "zrastreio:tema";
	var EVENTO = "alterado";

	/** Telas que o modo TV pode sortear, na ordem do menu. */
	var TELAS_TV = [
		{ rota: "RouteSalaDeControle", i18n: "navMapa" },
		{ rota: "RouteCatalogo", i18n: "navCatalogo" },
		{ rota: "RouteEmbarcados", i18n: "navEmbarcados" },
		{ rota: "RouteIndicadores", i18n: "navIndicadores" },
		{ rota: "RouteManutencao", i18n: "navManutencao" }
	];

	// Valores de fabrica das regras, capturados antes de qualquer ajuste.
	var SILENCIO_INSTALADO = silencio.LIMITE_INSTALADO_DIAS;
	var SILENCIO_PADRAO = silencio.LIMITE_PADRAO_DIAS;

	function padrao() {
		var rotas = {};

		TELAS_TV.forEach(function (t) {
			rotas[t.rota] = true;
		});

		return {
			tema: "sap_horizon",
			menuExpandido: true,

			modoCadastro: "padrao",

			tv: {
				rotas: rotas,
				intervaloSeg: 20,
				aleatorio: true,
				telaCheia: true
			},

			atualizacaoMin: 0,

			prefixoPadrao: "",

			silencio: {
				instalado: SILENCIO_INSTALADO,
				padrao: SILENCIO_PADRAO
			},

			mapa: {
				base: "satelite"
			},

			autor: ""
		};
	}

	/** Mescla o salvo sobre o padrao: chave nova no codigo nunca fica undefined. */
	function mesclar(base, salvo) {
		if (!salvo || typeof salvo !== "object") { return base; }
		Object.keys(base).forEach(function (k) {
			if (!(k in salvo)) { return; }
			var b = base[k];
			var s = salvo[k];
			if (b && typeof b === "object" && !Array.isArray(b)) {
				base[k] = mesclar(b, s);
			} else if (typeof s === typeof b) {
				base[k] = s;
			}
		});
		return base;
	}

	function inteiroEntre(v, min, max, recuo) {
		var n = Math.round(Number(v));
		if (!isFinite(n)) { return recuo; }
		return Math.min(max, Math.max(min, n));
	}

	/** Corrige valores fora da faixa antes de gravar ou aplicar. */
	function sanear(c) {
		var p = padrao();
		c.tema = c.tema === "sap_horizon_dark" ? "sap_horizon_dark" : "sap_horizon";
		c.tv.intervaloSeg = inteiroEntre(c.tv.intervaloSeg, 10, 600, p.tv.intervaloSeg);
		c.atualizacaoMin = inteiroEntre(c.atualizacaoMin, 0, 240, 0);
		c.silencio.instalado = inteiroEntre(c.silencio.instalado, 1, 365, p.silencio.instalado);
		c.silencio.padrao = inteiroEntre(c.silencio.padrao, 1, 365, p.silencio.padrao);
		c.mapa.base = c.mapa.base === "claro" ? "claro" : "satelite";
		c.prefixoPadrao = String(c.prefixoPadrao || "").trim().toUpperCase().slice(0, 4);
		c.autor = String(c.autor || "").trim();
		return c;
	}

	function copiar(o) {
		return JSON.parse(JSON.stringify(o));
	}

	var Configuracoes = {
		TELAS_TV: TELAS_TV,
		_modelo: null,
		_eventos: new EventProvider(),

		/** Modelo com a configuracao EM VIGOR (somente leitura para as telas). */
		modelo: function () {
			if (!this._modelo) {
				this._modelo = new JSONModel(this._ler());
				// As telas so LEEM a configuracao em vigor; quem altera e a
				// guia Configuracoes, sempre por salvar().
				this._modelo.setDefaultBindingMode("OneWay");
				this._aplicarRegras();
			}
			return this._modelo;
		},

		obter: function (caminho) {
			return this.modelo().getProperty(caminho);
		},

		/** Copia editavel da configuracao atual. */
		copia: function () {
			return copiar(this.modelo().getData());
		},

		padrao: function () {
			return padrao();
		},

		/** Telas do modo TV habilitadas; nunca vazia. */
		rotasTv: function () {
			var marcadas = this.obter("/tv/rotas") || {};
			var lista = TELAS_TV.filter(function (t) { return marcadas[t.rota]; })
				.map(function (t) { return t.rota; });
			return lista.length ? lista : TELAS_TV.map(function (t) { return t.rota; });
		},

		/** Grava, aplica as regras e avisa quem estiver ouvindo. */
		salvar: function (nova) {
			var anterior = copiar(this.modelo().getData());
			var c = sanear(mesclar(padrao(), copiar(nova)));
			this.modelo().setData(c);
			try {
				window.localStorage.setItem(CHAVE, JSON.stringify(c));
				window.localStorage.setItem(CHAVE_TEMA, c.tema);
			} catch (e) { /* sem storage: vale so nesta sessao */ }
			this._aplicarRegras();
			this._eventos.fireEvent(EVENTO, { anterior: anterior, atual: copiar(c) });
			return c;
		},

		/** So o tema — chamado pelo botao de tema da barra superior. */
		definirTema: function (tema) {
			var c = this.copia();
			c.tema = tema;
			return this.salvar(c);
		},

		aoAlterar: function (fn, ouvinte) {
			this._eventos.attachEvent(EVENTO, fn, ouvinte);
		},

		pararDeOuvir: function (fn, ouvinte) {
			this._eventos.detachEvent(EVENTO, fn, ouvinte);
		},

		_ler: function () {
			var salvo = null;
			var tema = null;
			try {
				salvo = JSON.parse(window.localStorage.getItem(CHAVE) || "null");
				tema = window.localStorage.getItem(CHAVE_TEMA);
			} catch (e) { /* sem storage */ }
			var c = mesclar(padrao(), salvo);
			if (tema) { c.tema = tema; }
			return sanear(c);
		},

		/** Limites de silencio valem para o calculo de mudo em toda a frota. */
		_aplicarRegras: function () {
			var s = this.modelo().getProperty("/silencio");
			silencio.LIMITE_INSTALADO_DIAS = s.instalado;
			silencio.LIMITE_PADRAO_DIAS = s.padrao;
		}
	};

	return Configuracoes;
});
