sap.ui.define([
	"./BaseController",
	"../service/MapaLeaflet",
	"../model/regras/zonas",
	"sap/m/SegmentedButtonItem",
	"sap/ui/export/Spreadsheet"
], function (
	BaseController,
	MapaLeaflet,
	zonas,
	SegmentedButtonItem,
	Spreadsheet
) {
	"use strict";

	return BaseController.extend(
		"br.com.smartpcm.rastreamento.zrastreio.controller.SalaDeControle",
		{

			onInit: function () {
				this.usarFrota();

				// Repinta quando a carga (assincrona, disparada no App) termina,
				// no botao Atualizar e na troca de prefixo. Nao usar
				// attachPropertyChange: ele nao dispara para setProperty.
				this.frota.aoAtualizar(this._aoMudarModelo, this);

				this.roteador()
					.getRoute("RouteSalaDeControle")
					.attachPatternMatched(
						this._aoEntrar,
						this
					);
			},
			onAfterRendering: function () {

				// Cria o mapa na primeira renderizacao e ja pinta com o que o
				// modelo tiver. Se a carga ainda nao terminou, o aviso de
				// Frota.aoAtualizar repinta quando os dados chegarem.
				this._montarMapa();

				var oCard = this.byId("cardComunicando");

				if (oCard && oCard.$().length) {

					oCard.$()
						.css("cursor", "pointer")
						.off("click.cardComunicando")
						.on(
							"click.cardComunicando",
							this.onAbrirRastreadoresComunicando.bind(this)
						);
				}

				var oCardMudos = this.byId("cardMudos");

				if (oCardMudos && oCardMudos.$().length) {

					oCardMudos.$()
						.css("cursor", "pointer")
						.off("click.cardMudos")
						.on(
							"click.cardMudos",
							this.onAbrirRastreadoresMudos.bind(this)
						);
				}
				var oCardCobertura = this.byId("cardCobertura");

				if (oCardCobertura && oCardCobertura.$().length) {

					oCardCobertura.$()
						.css("cursor", "pointer")
						.off("click.cardCobertura")
						.on(
							"click.cardCobertura",
							this.onAbrirCoberturaArvore.bind(this)
						);
				}
				var oCardDivergentes = this.byId("cardDivergentes");

				if (oCardDivergentes && oCardDivergentes.$().length) {

					oCardDivergentes.$()
						.css("cursor", "pointer")
						.off("click.cardDivergentes")
						.on(
							"click.cardDivergentes",
							this.onAbrirDivergentes.bind(this)
						);
				}

				var oCardGateways = this.byId("cardGateways");

				if (oCardGateways && oCardGateways.$().length) {

					oCardGateways.$()
						.css("cursor", "pointer")
						.off("click.cardGateways")
						.on(
							"click.cardGateways",
							this.onAbrirGateways.bind(this)
						);
				}
				var oCardEfetividade = this.byId("cardEfetividade");

				if (oCardEfetividade && oCardEfetividade.$().length) {

					oCardEfetividade.$()
						.css("cursor", "pointer")
						.off("click.cardEfetividade")
						.on(
							"click.cardEfetividade",
							this.onAbrirEfetividade.bind(this)
						);
				}

			},
			formatarCodigoCurto: function (codigo) {

				return String(codigo || "")
					.replace(/^0+/, "")
					.slice(-8);

			},
			onAbrirArvoreTipo: function () {

				var dados = this.getView()
					.getModel("frota")
					.getProperty("/porFamilia") || [];

				var oModel = new sap.ui.model.json.JSONModel({
					itens: dados
				});

				var oTabela = new sap.m.Table({
					sticky: ["ColumnHeaders"],
					columns: [
						new sap.m.Column({
							header: new sap.m.Text({ text: "Família" })
						}),
						new sap.m.Column({
							header: new sap.m.Text({ text: "Com rastreador" })
						}),
						new sap.m.Column({
							header: new sap.m.Text({ text: "Na árvore SAP" })
						}),
						new sap.m.Column({
							header: new sap.m.Text({ text: "Cobertura" })
						})
					]
				});

				oTabela.setModel(oModel);

				oTabela.bindItems({
					path: "/itens",
					template: new sap.m.ColumnListItem({
						cells: [
							new sap.m.Text({
								text: "{rotulo}"
							}),
							new sap.m.Text({
								text: "{comRastreador}"
							}),
							new sap.m.Text({
								text: "{naArvore}"
							}),
							new sap.m.Text({
								text: {
									path: "cobertura",
									formatter: function (v) {
										return ((v || 0) * 100).toFixed(1) + "%";
									}
								}
							})
						]
					})
				});

				var oDialog = new sap.m.Dialog({
					title: "Rastreadores × árvore SAP, por tipo",
					contentWidth: "1000px",
					contentHeight: "600px",
					draggable: true,
					resizable: true,
					content: [oTabela],

					beginButton: new sap.m.Button({
						text: "EXCEL",
						icon: "sap-icon://excel-attachment",
						press: function () {

							var dadosExcel = dados.map(function (d) {
								return {
									familia: d.rotulo,
									comRastreador: d.comRastreador,
									naArvore: d.naArvore,
									cobertura: ((d.cobertura || 0) * 100).toFixed(1) + "%"
								};
							});

							var oSpreadsheet = new Spreadsheet({
								workbook: {
									columns: [
										{
											label: "Família",
											property: "familia"
										},
										{
											label: "Com rastreador",
											property: "comRastreador"
										},
										{
											label: "Na árvore SAP",
											property: "naArvore"
										},
										{
											label: "Cobertura",
											property: "cobertura"
										}
									]
								},
								dataSource: dadosExcel,
								fileName: "Rastreadores_Arvore_SAP.xlsx"
							});

							oSpreadsheet.build().finally(function () {
								oSpreadsheet.destroy();
							});

						}
					}).addStyleClass("botaoDialogExcel"),

					endButton: new sap.m.Button({
						text: "OK",
						press: function () {
							oDialog.close();
						}
					}).addStyleClass("botaoDialogCinza"),

					afterClose: function () {
						oDialog.destroy();
					}
				});

				oDialog.open();

			},
			onAbrirEfetividade: function () {

				var indicadores = this.getView()
					.getModel("frota")
					.getProperty("/indicadores") || {};

				var cobertura =
					indicadores.cobertura &&
						indicadores.cobertura.valor !== null
						? indicadores.cobertura.valor
						: 0;

				var disponibilidade =
					indicadores.disponibilidade &&
						indicadores.disponibilidade.valor !== null
						? indicadores.disponibilidade.valor
						: 0;

				var gateways =
					indicadores.gateways &&
						indicadores.gateways.valor !== null
						? indicadores.gateways.valor
						: 0;

				var efetividade =
					indicadores.efetividade &&
						indicadores.efetividade.valor !== null
						? indicadores.efetividade.valor
						: 0;

				var coberturaPct = (cobertura * 100).toFixed(1);
				var disponibilidadePct = (disponibilidade * 100).toFixed(1);
				var gatewaysPct = (gateways * 100).toFixed(1);
				var efetividadePct = (efetividade * 100).toFixed(1);

				var oDialog = new sap.m.Dialog({
					title: "Índice Geral de Efetividade",
					contentWidth: "700px",
					contentHeight: "650px",
					verticalScrolling: true,
					draggable: true,
					resizable: true,

					content: [
						new sap.m.VBox({
							alignItems: "Center",
							items: [

								new sap.m.ObjectNumber({
									number: efetividadePct,
									unit: "%"
								}).addStyleClass("tituloIndicadorPopup"),

								new sap.m.Text({
									text: "Índice Geral de Efetividade"
								}).addStyleClass("subtituloPopup"),

								new sap.m.FormattedText({
									htmlText:
										"<b>O que mede?</b><br>" +
										"Consolida os principais indicadores operacionais em uma única visão de desempenho.<br><br>" +

										"<b>Como é calculado?</b><br>" +
										"Cobertura × 40% + Disponibilidade × 40% + Gateways × 20%.<br><br>" +

										"<b>Composição</b><br>" +
										"Cobertura da árvore SAP: " + coberturaPct + "%<br>" +
										"Disponibilidade dos rastreadores: " + disponibilidadePct + "%<br>" +
										"Gateways em operação: " + gatewaysPct + "%<br><br>" +

										"<b>Resultado</b><br>" +
										"(" + coberturaPct + "% × 40%) + " +
										"(" + disponibilidadePct + "% × 40%) + " +
										"(" + gatewaysPct + "% × 20%) = " +
										efetividadePct + "%<br><br>" +

										"<b>Por que é importante?</b><br>" +
										"Permite avaliar em um único indicador a cobertura da solução, a disponibilidade dos rastreadores e a operação da infraestrutura de gateways."
								}).addStyleClass("popupTextoGrande")
							]
						})
					],

					buttons: [

						new sap.m.Button({
							text: "EXCEL",
							icon: "sap-icon://excel-attachment",
							press: function () {

								var oSpreadsheet = new Spreadsheet({
									workbook: {
										columns: [
											{
												label: "Cobertura (%)",
												property: "cobertura"
											},
											{
												label: "Disponibilidade (%)",
												property: "disponibilidade"
											},
											{
												label: "Gateways (%)",
												property: "gateways"
											},
											{
												label: "Efetividade (%)",
												property: "efetividade"
											}
										]
									},
									dataSource: [{
										cobertura: coberturaPct,
										disponibilidade: disponibilidadePct,
										gateways: gatewaysPct,
										efetividade: efetividadePct
									}],
									fileName: "Indice_Efetividade.xlsx"
								});

								oSpreadsheet.build().finally(function () {
									oSpreadsheet.destroy();
								});

							}
						}).addStyleClass("botaoDialogExcel"),

						new sap.m.Button({
							text: "OK",
							press: function () {
								oDialog.close();
							}
						}).addStyleClass("botaoDialogCinza")
					],

					afterClose: function () {
						oDialog.destroy();
					}
				});

				oDialog.addStyleClass("sapUiContentPadding");
				oDialog.addStyleClass("dialogEfetividade");

				oDialog.open();

			},
			onAbrirDetalheGateway: function (oEvent) {

				var g = oEvent.getSource()
					.getBindingContext()
					.getObject();

				var oDialog = new sap.m.Dialog({
					title: "Detalhes do Gateway",
					contentWidth: "500px",

					content: [
						new sap.m.VBox({
							items: [
								new sap.m.Label({ text: "Gateway ID" }),
								new sap.m.Text({ text: g.id || "" }),

								new sap.m.Label({ text: "Identificador" }),
								new sap.m.Text({ text: g.identificador || "" }),

								new sap.m.Label({ text: "Localidade" }),
								new sap.m.Text({ text: g.localidade || "" }),

								new sap.m.Label({ text: "Condição" }),
								new sap.m.Text({ text: g.condicao || "" })
							]
						})
					],

					endButton: new sap.m.Button({
						text: "OK",
						press: function () {
							oDialog.close();
						}
					}),

					afterClose: function () {
						oDialog.destroy();
					}
				});

				oDialog.open();

			},
			onAbrirGateways: function () {

				var dados = this.getView()
					.getModel("frota")
					.getProperty("/gateways") || [];

				var oModel = new sap.ui.model.json.JSONModel({
					itens: dados
				});

				var oTabela = new sap.m.Table({
					sticky: ["ColumnHeaders"],
					columns: [
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Gateway"
							})
						}),
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Localidade"
							})
						}),
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Condição"
							})
						})
					]
				});

				oTabela.setModel(oModel);

				oTabela.bindItems({
					path: "/itens",
					template: new sap.m.ColumnListItem({
						cells: [
							new sap.m.Link({
								text: "{identificador}",
								press: this.onAbrirDetalheGateway.bind(this)
							}),
							new sap.m.Text({
								text: "{localidade}"
							}),
							new sap.m.Text({
								text: "{condicao}"
							})
						]
					})
				});

				var oDialog = new sap.m.Dialog({
					title: "Gateways ativos",
					contentWidth: "1100px",
					contentHeight: "600px",
					draggable: true,
					resizable: true,
					content: [oTabela],

					beginButton: new sap.m.Button({
						text: "Excel",
						icon: "sap-icon://excel-attachment",
						press: function () {

							var dadosExcel = dados.map(function (g) {
								return {
									gateway: g.identificador,
									localidade: g.localidade,
									condicao: g.condicao
								};
							});

							var oSpreadsheet = new Spreadsheet({
								workbook: {
									columns: [
										{
											label: "Gateway",
											property: "gateway"
										},
										{
											label: "Localidade",
											property: "localidade"
										},
										{
											label: "Condição",
											property: "condicao"
										}
									]
								},
								dataSource: dadosExcel,
								fileName: "Gateways.xlsx"
							});

							oSpreadsheet.build().finally(function () {
								oSpreadsheet.destroy();
							});

						}
					}),

					endButton: new sap.m.Button({
						text: "OK",
						press: function () {
							oDialog.close();
						}
					}),

					afterClose: function () {
						oDialog.destroy();
					}
				});

				oDialog.open();

			},
			onAbrirDivergentes: function () {

				var dados = this.getView()
					.getModel("frota")
					.getProperty("/divergentes") || [];

				var oModel = new sap.ui.model.json.JSONModel({
					itens: dados
				});

				var oTabela = new sap.m.Table({
					sticky: ["ColumnHeaders"],
					columns: [
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Equipamento"
							})
						}),
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Local de instalação"
							})
						})
					]
				});

				oTabela.setModel(oModel);

				oTabela.bindItems({
					path: "/itens",
					template: new sap.m.ColumnListItem({
						cells: [
							new sap.m.Link({
								text: {
									path: "identificador",
									formatter: function (v) {
										return String(v || "")
											.replace(/^0+/, "")
											.slice(-8);
									}
								},
								press: this.onAbrirEquipamentoPopup.bind(this)
							}),
							new sap.m.Text({
								text: "{localInstalacao}"
							})
						]
					})
				});

				var oDialog = new sap.m.Dialog({
					title: "Cadastro divergente",
					contentWidth: "1100px",
					contentHeight: "600px",
					draggable: true,
					resizable: true,
					content: [oTabela],

					beginButton: new sap.m.Button({
						text: "Excel",
						icon: "sap-icon://excel-attachment",
						press: function () {

							var dadosExcel = dados.map(function (d) {
								return {
									equipamento: String(d.identificador || "")
										.replace(/^0+/, "")
										.slice(-8),
									local: d.localInstalacao,
									distancia: d.distanciaM
								};
							});

							var oSpreadsheet = new Spreadsheet({
								workbook: {
									columns: [
										{
											label: "Equipamento",
											property: "equipamento"
										},
										{
											label: "Local de instalação",
											property: "local"
										},
										{
											label: "Distância (m)",
											property: "distancia"
										}
									]
								},
								dataSource: dadosExcel,
								fileName: "Cadastro_Divergente.xlsx"
							});

							oSpreadsheet.build().finally(function () {
								oSpreadsheet.destroy();
							});

						}
					}),

					endButton: new sap.m.Button({
						text: "OK",
						press: function () {
							oDialog.close();
						}
					}),

					afterClose: function () {
						oDialog.destroy();
					}
				});

				oDialog.open();

			},
			onAbrirCoberturaArvore: function () {

				var dados = this.getView()
					.getModel("frota")
					.getProperty("/porFamilia") || [];

				var oModel = new sap.ui.model.json.JSONModel({
					itens: dados
				});

				var oTabela = new sap.m.Table({
					sticky: ["ColumnHeaders"],
					columns: [
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Família"
							})
						}),
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Com rastreador"
							})
						}),
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Na árvore SAP"
							})
						}),
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Cobertura"
							})
						})
					]
				});

				oTabela.setModel(oModel);

				oTabela.bindItems({
					path: "/itens",
					template: new sap.m.ColumnListItem({
						cells: [
							new sap.m.Text({
								text: "{rotulo}"
							}),
							new sap.m.Text({
								text: "{comRastreador}"
							}),
							new sap.m.Text({
								text: "{naArvore}"
							}),
							new sap.m.Text({
								text: {
									path: "cobertura",
									formatter: function (v) {
										return ((v || 0) * 100).toFixed(1) + "%";
									}
								}
							})
						]
					})
				});

				var oDialog = new sap.m.Dialog({
					title: "Cobertura da árvore SAP",
					contentWidth: "1100px",
					contentHeight: "600px",
					draggable: true,
					resizable: true,

					content: [
						oTabela
					],

					beginButton: new sap.m.Button({
						text: "Excel",
						icon: "sap-icon://excel-attachment",
						press: function () {

							var dadosExcel = dados.map(function (d) {
								return {
									familia: d.rotulo,
									comRastreador: d.comRastreador,
									naArvore: d.naArvore,
									cobertura:
										((d.cobertura || 0) * 100)
											.toFixed(1) + "%"
								};
							});

							var oSpreadsheet = new Spreadsheet({
								workbook: {
									columns: [
										{
											label: "Família",
											property: "familia"
										},
										{
											label: "Com rastreador",
											property: "comRastreador"
										},
										{
											label: "Na árvore SAP",
											property: "naArvore"
										},
										{
											label: "Cobertura",
											property: "cobertura"
										}
									]
								},
								dataSource: dadosExcel,
								fileName: "Cobertura_Arvore_SAP.xlsx"
							});

							oSpreadsheet.build().finally(function () {
								oSpreadsheet.destroy();
							});

						}
					}),

					endButton: new sap.m.Button({
						text: "OK",
						press: function () {
							oDialog.close();
						}
					}),

					afterClose: function () {
						oDialog.destroy();
					}
				});

				oDialog.open();

			},
			onAbrirRastreadoresMudos: function () {

				var ativos = this.getView().getModel("frota").getProperty("/ativos") || [];

				var dados = ativos
					.filter(function (a) {
						return a.grupoAtual !== "Tags Digitais Não Habilitadas" &&
							a.mudo;
					})
					.map(function (a) {

						return {
							equipamento: String(
								a.codigoOriginal || a.codigo || ""
							)
								.replace(/^0+/, "")
								.slice(-8),

							codigoOriginal: a.codigoOriginal || a.codigo,

							local: a.local || ""
						};
					});

				var oModel = new sap.ui.model.json.JSONModel({
					itens: dados
				});

				var oTabela = new sap.m.Table({
					sticky: ["ColumnHeaders"],
					columns: [
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Equipamento"
							})
						}),
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Local de instalação"
							})
						})
					]
				});

				oTabela.setModel(oModel);

				oTabela.bindItems({
					path: "/itens",
					template: new sap.m.ColumnListItem({
						cells: [
							new sap.m.Link({
								text: "{equipamento}",
								press: this.onAbrirEquipamentoPopup.bind(this)
							}),
							new sap.m.Text({
								text: "{local}"
							})
						]
					})
				});

				var oDialog = new sap.m.Dialog({
					title: "Rastreadores sem comunicação",
					contentWidth: "1100px",
					contentHeight: "600px",
					draggable: true,
					resizable: true,

					content: [
						oTabela
					],

					beginButton: new sap.m.Button({
						text: "Excel",
						icon: "sap-icon://excel-attachment",
						press: function () {

							var oSpreadsheet = new Spreadsheet({
								workbook: {
									columns: [
										{
											label: "Equipamento",
											property: "equipamento"
										},
										{
											label: "Local de instalação",
											property: "local"
										}
									]
								},
								dataSource: dados,
								fileName: "Rastreadores_Sem_Comunicacao.xlsx"
							});

							oSpreadsheet.build().finally(function () {
								oSpreadsheet.destroy();
							});

						}
					}),

					endButton: new sap.m.Button({
						text: "OK",
						press: function () {
							oDialog.close();
						}
					}),

					afterClose: function () {
						oDialog.destroy();
					}
				});

				oDialog.open();

			},
			onAbrirEquipamentoPopup: function (oEvent) {

				var obj = oEvent.getSource()
					.getBindingContext()
					.getObject();

				this.navegarPara("RouteEquipamento", {
					codigo: obj.identificador || obj.codigoOriginal || obj.codigo
				});

			},

			onAbrirRastreadoresComunicando: function () {

				var ativos = this.getView().getModel("frota").getProperty("/ativos") || [];

				var dados = ativos
					.filter(function (a) {
						return a.grupoAtual !== "Tags Digitais Não Habilitadas" &&
							!a.mudo;
					})
					.map(function (a) {

						return {
							equipamento: String(
								a.codigoOriginal || a.codigo || ""
							)
								.replace(/^0+/, "")
								.slice(-8),

							codigoOriginal: a.codigoOriginal || a.codigo,

							local: a.local || ""
						};
					});
				var oModel = new sap.ui.model.json.JSONModel({
					itens: dados
				});

				var oTabela = new sap.m.Table({
					sticky: ["ColumnHeaders"],
					columns: [
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Equipamento"
							})
						}),
						new sap.m.Column({
							header: new sap.m.Text({
								text: "Local de instalação"
							})
						})
					]
				});

				oTabela.setModel(oModel);

				oTabela.bindItems({
					path: "/itens",
					template: new sap.m.ColumnListItem({
						cells: [
							new sap.m.Link({
								text: "{equipamento}",
								press: this.onAbrirEquipamentoPopup.bind(this)
							}),
							new sap.m.Text({
								text: "{local}"
							})
						]
					})
				});

				var oDialog = new sap.m.Dialog({
					title: "Rastreadores comunicando",
					contentWidth: "1100px",
					contentHeight: "600px",
					draggable: true,
					resizable: true,

					content: [
						oTabela
					],

					beginButton: new sap.m.Button({
						text: "Excel",
						icon: "sap-icon://excel-attachment",
						press: function () {

							var oSpreadsheet = new Spreadsheet({
								workbook: {
									columns: [
										{
											label: "Equipamento",
											property: "equipamento"
										},
										{
											label: "Local de instalação",
											property: "local"
										}
									]
								},
								dataSource: dados,
								fileName: "Rastreadores_Comunicando.xlsx"
							});

							oSpreadsheet.build().finally(function () {
								oSpreadsheet.destroy();
							});

						}
					}),

					endButton: new sap.m.Button({
						text: "OK",
						press: function () {
							oDialog.close();
						}
					}),

					afterClose: function () {
						oDialog.destroy();
					}
				});

				oDialog.open();

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
					base: "satelite",
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
					that.navegarPara("RouteEquipamento", { codigo: a.codigo });
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
				this.navegarPara("RouteEquipamento", { codigo: contexto.getProperty("codigo") });
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
				this.frota.pararDeOuvir(this._aoMudarModelo, this);
				if (this._mapa) { this._mapa.destruir(); this._mapa = null; }
			}
		});
});
