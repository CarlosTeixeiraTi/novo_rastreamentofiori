sap.ui.define([
	"./BaseController",
	"../service/MapaLeaflet",
	"../model/regras/zonas",
	"sap/m/SegmentedButtonItem"
], function (
	BaseController,
	MapaLeaflet,
	zonas,
	SegmentedButtonItem
) {
	"use strict";

	return BaseController.extend(
		"br.com.smartpcm.rastreamento.zrastreio.controller.SalaDeControle",
		{

			onInit: function () {
				this.usarFrota();
				this._ligarCards();

				this.frota.aoAtualizar(this._aoMudarModelo, this);
				this.configuracoes.aoAlterar(this._aoMudarConfig, this);

				this.roteador()
					.getRoute("RouteSalaDeControle")
					.attachPatternMatched(
						this._aoEntrar,
						this
					);

				this._timerRefreshSala = setInterval(function () {
					this.frota.carregar();
				}.bind(this), 10 * 60 * 1000);
			},
			onAfterRendering: function () {

				// Cria o mapa na primeira renderizacao e ja pinta com o que o
				// modelo tiver. Se a carga ainda nao terminou, o aviso de
				// Frota.aoAtualizar repinta quando os dados chegarem.
				this._montarMapa();
			},

			/**
			 * Cards clicaveis. Cada um abre a lista que explica o proprio
			 * numero, com EXCEL e link para a ficha de cada equipamento. As
			 * listas saem de regras/detalhamentos, com o MESMO filtro do card.
			 */
			_ligarCards: function () {

				var that = this;

				function ligar(id, fn) {

					var oCard = that.byId(id);

					if (!oCard) {
						return;
					}

					oCard.addStyleClass("valeCardClicavel");

					oCard.attachBrowserEvent("click", function () {
						fn.call(that);
					});

					oCard.attachBrowserEvent("keydown", function (e) {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							fn.call(that);
						}
					});

					oCard.addEventDelegate({
						onAfterRendering: function () {
							oCard.$().attr({
								tabindex: 0,
								role: "button"
							});
						}
					});
				}

				ligar("cardHabilitados", this.onAbrirRastreadoresHabilitados);
				ligar("cardComunicando", this.onAbrirRastreadoresComunicando);
				ligar("cardMudos", this.onAbrirRastreadoresMudos);
				ligar("cardCobertura", this.onAbrirCoberturaArvore);
				ligar("cardDivergentes", this.onAbrirDivergentes);
				ligar("cardGateways", this.onAbrirGateways);
				ligar("cardEfetividade", this.onAbrirEfetividade);

				ligar("cardDesatualizadas", function () {
					this.abrirDetalhamento("desatualizadas");
				});
			},

			formatarCodigoCurto: function (codigo) {

				return String(codigo || "")
					.replace(/^0+/, "")
					.slice(-8);

			},

			onAbrirRastreadoresComunicando: function () {
				this.abrirDetalhamento("comunicando");
			},

			/** Mesmo filtro do card: mudos habilitados + mudos com cadastro divergente. */
			onAbrirRastreadoresMudos: function () {
				this.abrirDetalhamento("semComunicacao");
			},

			onAbrirRastreadoresHabilitados: function () {
				this.abrirDetalhamento("habilitados");
			},

			onAbrirCoberturaArvore: function () {
				this.abrirDetalhamento("porFamilia");
			},

			onAbrirDivergentes: function () {
				this.abrirDetalhamento("divergentes");
			},

			onAbrirGateways: function () {
				this.abrirDetalhamento("gateways", true);
			},

			onAbrirEfetividade: function () {
				this.abrirDetalhamento("efetividade");
			},

			/** Item da lista "por tipo": os rastreadores daquela familia. */
			onAbrirArvoreTipo: function (oEvent) {
				var contexto = oEvent.getSource().getBindingContext("frota");
				if (!contexto) { return; }
				this.abrirDetalhamento("familia", contexto.getProperty("familia"));
			},

			/** Excel das ultimas mudancas, exatamente como estao na tabela. */
			onExportarMovimentacoes: function () {
				this.exportarDetalhamento(
					this.detalhamentos.movimentacoes(this.dadosDaFrota())
				);
			},

			_aoEntrar: function () {

				this._sincronizarPrefixos();

				var that = this;

				// Ao voltar para a tela o container pode ter mudado de
				// tamanho enquanto estava oculto: recalcula e repinta.
				setTimeout(function () {

					if (that._mapa) {
						that._mapa.ajustar();
						that._pintarMapa();
					}

				}, 300);

			},

			/** Disparado por Frota.aoAtualizar sempre que os dados mudam. */
			_aoMudarModelo: function () {

				this._sincronizarPrefixos();
				this._pintarMapa();
			},
			_montarMapa: function () {
				if (this._mapa) {
					return;
				}

				var dominio = this.byId("mapaMini").getDomRef();
				if (!dominio) {
					return;
				}

				var alvo = dominio.querySelector(".valeMapa") || dominio;
				var that = this;

				// Leaflet e o MarkerCluster ja foram carregados pelas tags
				// <script> sincronas do index.html, antes do bootstrap do
				// UI5 — L ja esta disponivel aqui, sem precisar reinjetar
				// nada (o que antes apontava para uma URL sem o arquivo de
				// verdade e nunca resolvia, deixando este mapa sem montar).
				var mapa = MapaLeaflet.criar(alvo, {
					base: this.configuracoes.obter("/mapa/base") || "satelite",
					zoom: 11,
					zoomControl: false
				});

				// Sem Leaflet o construtor retorna sem montar o mapa interno.
				if (!mapa || !mapa._mapa) {
					return;
				}
				this._mapa = mapa;

				alvo.style.filter = "brightness(.72) saturate(.9)";

				this._mapa.aoClicarCerca(function (zona) {
					that._abrirCerca(zona);
				});

				// Gateway no mapa: mesma lista do link de gateway nos popups.
				this._mapa.aoClicarGateway(function (g) {
					that.abrirGateway(g.identificador || g.id);
				});

				// Pinta ja com o que houver no modelo. Na primeira abertura a
				// carga pode ainda estar em andamento — nesse caso as listas
				// vem vazias e o aviso Frota.aoAtualizar repinta depois.
				this._pintarMapa();

				// Pequeno ajuste para o Leaflet recalcular o tamanho do container de 360px
				setTimeout(function () {
					if (that._mapa) {
						that._mapa.ajustar();
					}
				}, 200);
			},

			/** Base padrao do mapa trocada na guia Configuracoes. */
			_aoMudarConfig: function (evento) {
				var antes = evento.getParameter("anterior").mapa.base;
				var agora = evento.getParameter("atual").mapa.base;
				if (antes !== agora && this._mapa) {
					this._mapa.trocarBase(agora);
				}
			},

			onTrocarBase: function (evento) {
				if (this._mapa) {
					this._mapa.trocarBase(evento.getParameter("item").getKey());
				}
			},

			_pintarMapa: function () {
				if (!this._mapa) { return; }
				var m = this.frota.modelo();
				var cercas = m.getProperty("/zonas") || [];
				var antenas = m.getProperty("/gateways") || [];
				var ativos = m.getProperty("/ativos") || [];

				this._mapa.desenharCercas(cercas);
				this._mapa.desenharGateways(antenas);

				var that = this;
				this._mapa.desenharAtivos(ativos, function (a) {
					return that._posicaoDe(a);
				}, function (a) {
					that.abrirFicha(a.codigo);
				});

				if (!this._enquadrou) {
					var caixa = zonas.enquadrar(
						cercas.reduce(function (acc, z) { return acc.concat(z.pontos); }, []),
						antenas.map(function (g) { return g.posicao; })
					);
					if (caixa) {
						this._mapa.enquadrar(caixa);
						this._enquadrou = true;
					}
				}
			},

			_posicaoDe: function (ativo) {

				if (ativo.prefixo === "FEBR") {
					return {
						lat: -19.870131,
						lng: -43.398402
					};
				}

				if (ativo.prefixo === "PPIC") {
					return {
						lat: -20.217185,
						lng: -43.864846
					};
				}

				if (ativo.prefixo === "FEMN") {
					return {
						lat: -20.172795,
						lng: -43.490555
					};
				}

				if (ativo.prefixo === "AABO") {
					return {
						lat: -20.1657789407565,
						lng: -43.87381158662438
					};
				}

				var detalhe = this.frota.detalhe(ativo.codigo);

				if (detalhe && detalhe.posicao) {
					return detalhe.posicao;
				}

				var conf = this.frota.modelo().getProperty("/conferencia") || {
					veiculos: []
				};

				var v = (conf.veiculos || []).filter(function (x) {
					return String(x.nome || "").toUpperCase() === ativo.veiculo;
				})[0];

				return v ? v.posicao : null;
			},


			_abrirCerca: function (zona) {
				this.navegarPara("RouteMapa");
			},

			_sincronizarPrefixos: function () {
				var seg = this.byId("segPrefixo");
				if (!seg) { return; }
				var m = this.frota.modelo();
				var prefixos = m.getProperty("/prefixos") || [];
				var assinatura = prefixos.map(function (p) { return p.prefixo + ":" + p.total; }).join("|");
				if (assinatura === this._assinaturaPrefixos) { return; }
				this._assinaturaPrefixos = assinatura;

				seg.removeAllItems();

				prefixos.forEach(function (p) {
					seg.addItem(new SegmentedButtonItem({
						key: p.prefixo,
						text: p.prefixo + " (" + p.total + ")"
					}));
				});
				seg.addItem(new SegmentedButtonItem({
					key: "__todos__",
					text: "Todos (" +
						(m.getProperty("/totalRastreadores") || 0) + ")"
				}));

				seg.setSelectedKey(
					m.getProperty("/prefixo") || "__todos__"
				);
			},

			onTrocarPrefixo: function (evento) {

				var chave = evento.getParameter("item").getKey();

				// definirPrefixo recalcula a frota e dispara aoAtualizar,
				// que repinta o mapa — com _enquadrou=false ele reenquadra.
				this._enquadrou = false;
				this.frota.definirPrefixo(
					chave === "__todos__" ? null : chave
				);
				this.byId("prefixoDigitado").setValue("");

				if (!this._mapa) {
					return;
				}

				if (chave === "FEIT") {

					this._mapa.irPara({
						lat: -19.641510,
						lng: -43.226143
					}, 12);

				} else if (chave === "FEBR") {

					this._mapa.irPara({
						lat: -19.870131,
						lng: -43.398402
					}, 12);

				} else if (chave === "PPIC") {

					this._mapa.irPara({
						lat: -20.217185,
						lng: -43.864846
					}, 12);

				} else if (chave === "FEMN") {

					this._mapa.irPara({
						lat: -20.172795,
						lng: -43.490555
					}, 12);

				} else if (chave === "AABO") {

					this._mapa.irPara({
						lat: -20.16577,
						lng: -43.873811
					}, 12);

				}

			},
			onDigitarPrefixo: function (evento) {
				var valor = String(evento.getParameter("value") || "").trim().toUpperCase();
				this._enquadrou = false;
				this.frota.definirPrefixo(valor || null);
				this.byId("segPrefixo").setSelectedKey(valor || "__todos__");
			},

			onAmpliarMapa: function () {
				this.navegarPara("RouteMapa", {});
			},

			onAbrirEquipamento: function (evento) {
				var contexto = evento.getSource().getBindingContext("frota");
				if (!contexto) { return; }
				this.abrirFicha(contexto.getProperty("codigo"));
			},

			paraPercentual: function (fracao) {
				if (fracao === null || fracao === undefined) { return 0; }
				return Math.round(Math.min(fracao, 1) * 100);
			},

			estadoDaCobertura: function (fracao) {
				if (fracao === null || fracao === undefined) { return "None"; }
				var p = fracao * 100;
				if (p >= 90) { return "Success"; }
				if (p >= 70) { return "Warning"; }
				return "Error";
			},

			formatarAtualizacao: function (data) {
				if (!data) { return ""; }
				return this.i18n("atualizadoEm", [new Date(data).toLocaleTimeString("pt-BR")]);
			},

			onExit: function () {

				if (this._timerRefreshSala) {
					clearInterval(this._timerRefreshSala);
					this._timerRefreshSala = null;
				}

				this.frota.pararDeOuvir(this._aoMudarModelo, this);
				this.configuracoes.pararDeOuvir(this._aoMudarConfig, this);

				if (this._mapa) {
					this._mapa.destruir();
					this._mapa = null;
				}
			}
		});

});
