sap.ui.define([
	"./BaseController",
	"../service/Backend",
	"../service/RelatoriosSalvos",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, Backend, RelatoriosSalvos, JSONModel, MessageToast, MessageBox) {
	"use strict";

	/**
	 * Guia "Configuracoes do sistema".
	 *
	 * Edita um rascunho (modelo `cfg`) e so aplica em "Salvar". Quem
	 * aplica cada item e quem o usa: App (tema, menu, modo TV,
	 * atualizacao automatica, limites de silencio → recalculo), telas de
	 * mapa (base padrao) e RelatoriosSalvos (autor).
	 */
	return BaseController.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Configuracoes", {

		onInit: function () {
			this.usarFrota();

			this._rascunho = new JSONModel();
			this._rascunho.attachPropertyChange(this._marcarAlterado, this);
			this.getView().setModel(this._rascunho, "cfg");

			this._sistema = new JSONModel({});
			this.getView().setModel(this._sistema, "sis");

			this.roteador().getRoute("RouteConfiguracoes")
				.attachPatternMatched(this._aoEntrar, this);
		},

		_aoEntrar: function () {
			this._carregarRascunho(this.configuracoes.copia());
			this._atualizarSistema();
		},

		_carregarRascunho: function (dados) {
			// Autor: o que o RelatoriosSalvos ja usa (FLP ou ultimo informado).
			if (!dados.autor) { dados.autor = RelatoriosSalvos.autor() || ""; }
			this._original = JSON.stringify(this._semControle(dados));
			dados._alterado = false;
			this._rascunho.setData(dados);
		},

		_semControle: function (dados) {
			var c = JSON.parse(JSON.stringify(dados));
			delete c._alterado;
			return c;
		},

		_marcarAlterado: function () {
			var atual = JSON.stringify(this._semControle(this._rascunho.getData()));
			this._rascunho.setProperty("/_alterado", atual !== this._original);
		},

		_atualizarSistema: function () {
			var manifesto = this.getOwnerComponent().getManifestEntry("/sap.app") || {};
			var fonte = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/restService");
			this._sistema.setData({
				versaoApp: (manifesto.applicationVersion && manifesto.applicationVersion.version) || "—",
				versaoUi5: (sap.ui && sap.ui.version) || "—",
				fonte: Backend.estaSimulado()
					? this.i18n("cfgFonteSimulada", [])
					: ((fonte && fonte.uri) || "/rest/")
			});
		},

		onSalvar: function () {
			var dados = this._semControle(this._rascunho.getData());
			var marcadas = Object.keys(dados.tv.rotas || {}).filter(function (k) {
				return dados.tv.rotas[k];
			});
			if (!marcadas.length) {
				MessageBox.warning(this.i18n("cfgTvNenhuma", []));
				return;
			}

			RelatoriosSalvos.lembrarAutor(dados.autor);

			var salva = this.configuracoes.salvar(dados);

			// Menu lateral: aplica ja, alem de valer na proxima abertura.
			var pagina = this._toolPage();
			if (pagina) { pagina.setSideExpanded(salva.menuExpandido); }

			// Recorte padrao escolhido agora: aplica tambem nesta sessao.
			var atual = this.frota.modelo().getProperty("/prefixo") || "";
			if (salva.prefixoPadrao && salva.prefixoPadrao !== atual) {
				this.frota.definirPrefixo(salva.prefixoPadrao);
			} else {
				this.frota.recalcular();
			}

			this._carregarRascunho(this.configuracoes.copia());

			MessageToast.show(this.i18n("cfgSalvo", []));
		},

		onDescartar: function () {
			this._carregarRascunho(this.configuracoes.copia());
		},

		onRestaurarPadroes: function () {
			var that = this;
			MessageBox.confirm(this.i18n("cfgRestaurarConfirma", []), {
				onClose: function (acao) {
					if (acao !== MessageBox.Action.OK) { return; }
					var padrao = that.configuracoes.padrao();
					padrao._alterado = true;
					that._rascunho.setData(padrao);
					that._marcarAlterado();
				}
			});
		},

		onAtualizarAgora: function () {
			var that = this;
			this.frota.carregar().then(function () {
				that._atualizarSistema();
				MessageToast.show(that.i18n("atualizado", []));
			});
		},

		formatarData: function (data) {
			if (!data) { return "—"; }
			return new Date(data).toLocaleString("pt-BR");
		},

		/** ToolPage da moldura (App.view), dono do menu lateral. */
		_toolPage: function () {
			var controle = this.getView().getParent();
			while (controle) {
				if (controle.isA && controle.isA("sap.tnt.ToolPage")) { return controle; }
				controle = controle.getParent();
			}
			return null;
		}
	});
});
