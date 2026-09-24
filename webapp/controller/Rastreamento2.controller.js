/* global L */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/export/Spreadsheet",
    "sap/m/BusyDialog"
], (
    Controller,
    JSONModel,
    Spreadsheet,
    BusyDialog
) => {

    "use strict";

    return Controller.extend(
        "br.com.smartpcm.rastreamento.zrastreio.controller.Rastreamento2",
        {
            onInit() {

                let oModelUsuario =
                    this.getOwnerComponent()
                        .getModel("usuarioLogado");

                if (!oModelUsuario) {

                    oModelUsuario =
                        new sap.ui.model.json.JSONModel({
                            usuario: "VISUALIZADOR",
                            nome: "VISUALIZADOR",
                            perfil: "VISUALIZADOR"
                        });

                    this.getOwnerComponent().setModel(
                        oModelUsuario,
                        "usuarioLogado"
                    );
                }

                this.byId("tabDashboard")?.setVisible(false);

                this.byId("tabInformacoes")?.setVisible(false);

                this.byId("tabValorGerado")?.setVisible(false);

                this.byId("tabGraficos")?.setVisible(false);



                this._primeiraCargaMapa = true;

                this.resumoTipoStatus = [];

                this.getView().setModel(
                    new JSONModel({
                        totalEquipamentos: "",
                        online: "",
                        offline: "",
                        gateways: "",
                        grupos: [],
                        ultimasLeituras: [],
                        dashboardVeiculos: [],
                        resumoFrotas: []
                    }),
                    "dashboard"
                );

                this._grupoSelecionado = null;

                this.aplicarPerfilUsuario();

            },
            aplicarPerfilUsuario() {

                const oModelUsuario =
                    this.getOwnerComponent()
                        .getModel("usuarioLogado");

                if (!oModelUsuario) {
                    return;
                }

                const perfil =
                    (oModelUsuario.getProperty("/perfil") || "")
                        .toUpperCase();

                if (perfil !== "VISUALIZADOR") {
                    return;
                }

                this.byId("tabDashboard")?.setVisible(false);
                this.byId("tabInformacoes")?.setVisible(false);
                this.byId("tabValorGerado")?.setVisible(false);
                this.byId("tabGraficos")?.setVisible(false);

            },

            onFecharAjudaPesquisa() {

                const oSearch =
                    this.byId("idPesquisaRastreador");

                if (oSearch) {
                    oSearch.removeStyleClass(
                        "pesquisaDestacada"
                    );
                }

                this.byId(
                    "idAjudaPesquisa"
                ).setVisible(false);

            },

            onButtonVoltarTopoPress() {
                const oDomRef = this.byId("idDashboardPage").getDomRef();

                if (oDomRef) {
                    oDomRef.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            },
            onDetalharStatusTipo: function (
                sStatus,
                sTipo
            ) {


                const aEquipamentos =
                    this._dadosFiltrados.filter(item => {

                        let tipo =
                            (item.descEquipamento || "")
                                .toUpperCase()
                                .trim()
                                .split(" ")[0];

                        let status =
                            this.determinarGrupo(item);

                        if (status &&
                            status.startsWith("Instalado no")) {
                            status = "Instalados";
                        }

                        if (status === "Ref. interna") {
                            status = "Ref. Int.";
                        }

                        if (status === "Ref. externa") {
                            status = "Ref. Ext.";
                        }

                        if (status === "Reformado") {
                            status = "Reformados";
                        }

                        if (status === "A reformar") {
                            status = "Reformar";
                        }

                        return tipo === sTipo &&
                            status === sStatus;

                    });

                const oList = new sap.m.List();

                const oDialog = new sap.m.Dialog({

                    title: sTipo,

                    contentWidth: "auto",

                    content: [oList],

                    buttons: [

                        new sap.m.Button({
                            text: "EXCEL",
                            press: function () {

                                const oSpreadsheet = new Spreadsheet({
                                    workbook: {
                                        columns: [
                                            {
                                                label: "Equipamento",
                                                property: "identificador"
                                            },
                                            {
                                                label: "Descrição",
                                                property: "descEquipamento"
                                            },
                                            {
                                                label: "Local Instalação",
                                                property: "localInstalacao"
                                            },
                                            {
                                                label: "Status",
                                                property: "grupoAtual"
                                            }
                                        ]
                                    },
                                    dataSource: aEquipamentos,
                                    fileName: "Detalhe_" + sTipo + ".xlsx"
                                });

                                oSpreadsheet.build()
                                    .finally(function () {
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

                aEquipamentos.forEach(item => {

                    oList.addItem(
                        new sap.m.StandardListItem({

                            title:
                                item.identificador ||
                                item.tag ||
                                item.epc ||
                                "Equipamento",

                            description:
                                item.descEquipamento || "",

                            info:
                                item.localInstalacao || "",

                            type: "Navigation",

                            press: () => {

                                this.onPesquisarRastreador({
                                    getParameter: function (sName) {
                                        return sName === "query"
                                            ? String(item.identificador)
                                            : "";
                                    }
                                });

                                oDialog.close();

                                if (this._oDialogDetalheStatus) {
                                    this._oDialogDetalheStatus.close();
                                }

                                if (this._oDialogStatus) {
                                    this._oDialogStatus.close();
                                }
                            }

                        })
                    );

                });

                if (this._oDialogDetalheStatus) {
                    this._oDialogDetalheStatus.close();
                }

                oDialog.addStyleClass("sapUiContentPadding");
                oDialog.addStyleClass("dialogRastreadores");
                oDialog.open();

            },

            onCardStatusTipoPress: function () {

                const aDados = this.getView()
                    .getModel("dashboard")
                    .getProperty("/graficoTipoStatus") || [];

                const oResumo = {};

                aDados.forEach(item => {

                    oResumo[item.status] =
                        (oResumo[item.status] || 0)
                        + item.quantidade;

                });

                const oList = new sap.m.List();

                Object.keys(oResumo)
                    .sort()
                    .forEach(function (sStatus) {

                        let sIcon = "sap-icon://hint";

                        switch (sStatus) {
                            case "Instalados":
                                sIcon = "sap-icon://shipping-status";
                                break;

                            case "Ref. Int.":
                                sIcon = "sap-icon://factory";
                                break;

                            case "Reformados":
                                sIcon = "sap-icon://complete";
                                break;

                            case "Reformar":
                                sIcon = "sap-icon://wrench";
                                break;
                        }

                        oList.addItem(
                            new sap.m.StandardListItem({
                                title: sStatus,
                                info: String(oResumo[sStatus]),
                                icon: sIcon,
                                type: "Navigation",
                                press: this.onStatusItemPress.bind(this)
                            })
                        );

                    }.bind(this));

                const oDialog = new sap.m.Dialog({

                    customHeader: new sap.m.Bar({
                        contentLeft: [
                            new sap.m.Title({
                                text: "Status dos Equipamentos"
                            })
                        ],
                        contentRight: [
                            new sap.m.Button({
                                icon: "sap-icon://decline",
                                type: "Transparent",
                                press: function () {
                                    oDialog.close();
                                }
                            }).addStyleClass("btnFecharPopup")
                        ]
                    }),

                    contentWidth: "auto",
                    contentHeight: "auto",

                    content: [oList],

                    buttons: [

                        new sap.m.Button({
                            text: "EXCEL",
                            press: function () {

                                const aExportacao = Object.keys(oResumo)
                                    .sort()
                                    .map(function (sStatus) {
                                        return {
                                            status: sStatus,
                                            quantidade: oResumo[sStatus]
                                        };
                                    });

                                const oSpreadsheet = new Spreadsheet({
                                    workbook: {
                                        columns: [
                                            {
                                                label: "Status",
                                                property: "status"
                                            },
                                            {
                                                label: "Quantidade",
                                                property: "quantidade",
                                                type: "number"
                                            }
                                        ]
                                    },
                                    dataSource: aExportacao,
                                    fileName: "Status_Equipamentos.xlsx"
                                });

                                oSpreadsheet.build()
                                    .finally(function () {
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

                this._oDialogStatus = oDialog;

                oDialog.addStyleClass("sapUiContentPadding");
                oDialog.addStyleClass("dialogRastreadores");

                oDialog.open();

            },
            onDetalharStatus: function (sStatus) {

                const aDados = this.getView()
                    .getModel("dashboard")
                    .getProperty("/graficoTipoStatus") || [];

                const aTipos = aDados.filter(item =>
                    item.status === sStatus
                );

                const oList = new sap.m.List();

                aTipos.forEach(item => {

                    oList.addItem(
                        new sap.m.StandardListItem({
                            title: item.tipo,
                            info: String(item.quantidade),
                            type: "Navigation",

                            press: () => {

                                if (this._oDialogDetalheStatus) {
                                    this._oDialogDetalheStatus.close();
                                }

                                this.onDetalharStatusTipo(
                                    sStatus,
                                    item.tipo
                                );

                            }

                        })
                    );

                });

                const oDialog = new sap.m.Dialog({

                    title: "Status dos Equipamentos",

                    contentWidth: "auto",
                    contentHeight: "auto",

                    content: [oList],

                    buttons: [

                        new sap.m.Button({
                            text: "EXCEL",
                            press: function () {

                                const oSpreadsheet = new Spreadsheet({
                                    workbook: {
                                        columns: [
                                            {
                                                label: "Tipo",
                                                property: "tipo"
                                            },
                                            {
                                                label: "Quantidade",
                                                property: "quantidade",
                                                type: "number"
                                            }
                                        ]
                                    },
                                    dataSource: aTipos,
                                    fileName: "Status_" + sStatus + ".xlsx"
                                });

                                oSpreadsheet.build()
                                    .finally(function () {
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

                this._oDialogDetalheStatus = oDialog;

                if (this._oDialogStatus) {
                    this._oDialogStatus.close();
                }

                oDialog.addStyleClass("sapUiContentPadding");
                oDialog.addStyleClass("dialogRastreadores");
                oDialog.open();

            },
            onStatusItemPress: function (oEvent) {

                const sStatus =
                    oEvent.getSource().getTitle();

                this.onDetalharStatus(sStatus);

            },
            onCardLocalidadesPress() {

                const localidades = [...new Set(
                    (this._dadosFiltrados || [])
                        .map(item => {

                            const local = item.localInstalacao || "";

                            if (local.includes("_EMREF_EXT")) {
                                return "SOTREQ";
                            }

                            const prefixo = local.substring(0, 4).toUpperCase();

                            switch (prefixo) {
                                case "FEIT":
                                    return "ITABIRA";

                                case "FEMN":
                                    return "MARIANA";

                                case "FEBR":
                                    return "BRUCUTU";

                                case "PPIC":
                                    return "PICO";

                                default:
                                    return prefixo;
                            }
                        })
                        .filter(Boolean)
                )].sort();

                const oList = new sap.m.List();

                localidades.forEach(localidade => {

                    let fnPress = null;
                    let sIcon = "sap-icon://map";

                    switch (localidade) {

                        case "ITABIRA":
                            fnPress = this.onIrItabira.bind(this);
                            break;

                        case "MARIANA":
                            fnPress = this.onIrMariana.bind(this);
                            break;

                        case "BRUCUTU":
                            fnPress = this.onIrBrucutu.bind(this);
                            break;

                        case "PICO":
                            fnPress = this.onIrPico.bind(this);
                            break;

                        case "SOTREQ":
                            fnPress = this.onIrVespasiano.bind(this);
                            break;
                    }

                    const quantidade = (this._dadosFiltrados || []).filter(item => {

                        const local = item.localInstalacao || "";

                        let sLocalidade;

                        if (local.includes("_EMREF_EXT")) {
                            sLocalidade = "SOTREQ";
                        } else {

                            const prefixo = local.substring(0, 4).toUpperCase();

                            switch (prefixo) {
                                case "FEIT":
                                    sLocalidade = "ITABIRA";
                                    break;

                                case "FEMN":
                                    sLocalidade = "MARIANA";
                                    break;

                                case "FEBR":
                                    sLocalidade = "BRUCUTU";
                                    break;

                                case "PPIC":
                                    sLocalidade = "PICO";
                                    break;

                                default:
                                    sLocalidade = prefixo;
                                    break;
                            }
                        }

                        return sLocalidade === localidade;

                    }).length;

                    const oItem = new sap.m.StandardListItem({
                        title: `${localidade} (${quantidade})`,
                        icon: sIcon,
                        type: "Active"
                    });

                    if (fnPress) {
                        oItem.attachPress(fnPress);
                    }

                    oList.addItem(oItem);

                });

                this._oDialogLocalidades = new sap.m.Dialog({
                    customHeader: new sap.m.Bar({
                        contentLeft: [
                            new sap.m.Title({
                                text: `Localidades (${localidades.length})`
                            })
                        ],
                        contentRight: [
                            new sap.m.Button({
                                icon: "sap-icon://decline",
                                type: "Transparent",
                                press: function () {
                                    this._oDialogLocalidades.close();
                                }.bind(this)
                            }).addStyleClass("btnFecharPopup")
                        ]
                    }),
                    contentWidth: "500px",
                    contentHeight: "auto",
                    content: [oList],

                    buttons: [

                        new sap.m.Button({
                            text: "EXCEL",
                            press: function () {

                                const oSpreadsheet = new Spreadsheet({
                                    workbook: {
                                        columns: [
                                            {
                                                label: "Localidade",
                                                property: "localidade"
                                            }
                                        ]
                                    },
                                    dataSource: localidades.map(function (sLocalidade) {
                                        return {
                                            localidade: sLocalidade
                                        };
                                    }),
                                    fileName: "Localidades.xlsx"
                                });

                                oSpreadsheet.build()
                                    .finally(function () {
                                        oSpreadsheet.destroy();
                                    });

                            }
                        }).addStyleClass("botaoDialogExcel"),

                        new sap.m.Button({
                            text: "OK",
                            press: function () {
                                this._oDialogLocalidades.close();
                            }.bind(this)
                        }).addStyleClass("botaoDialogCinza")

                    ],

                    afterClose: function () {

                        this._oDialogLocalidades.destroy();
                        this._oDialogLocalidades = null;

                    }.bind(this)
                });
                this._oDialogLocalidades.addStyleClass("sapUiContentPadding");
                this._oDialogLocalidades.addStyleClass("dialogRastreadores");

                this._oDialogLocalidades.open();



            },
            onAfterRendering() {
                const oPage = this.byId("idDashboardPage");

                if (oPage && oPage.getDomRef()) {
                    oPage.getDomRef().scrollIntoView({
                        behavior: "auto",
                        block: "start"
                    });

                }
                this.aplicarPerfilUsuario();

                if (!this._cardEventosRegistrados) {

                    this._cardEventosRegistrados = true;

                    setTimeout(() => {

                        const oPanel =
                            this.byId("idTotalEquipamentosPanel");

                        if (oPanel) {

                            oPanel.$().css("cursor", "pointer");
                            oPanel.$().find("*").css("cursor", "pointer");

                            oPanel.$().on("click", () => {
                                this.onCardComponentesPress();
                            });

                        }
                        oPanel.$().hover(

                            function () {

                                $(this).css({
                                    "transform": "translateY(-3px) scale(1.02)",
                                    "transition": "all 0.2s ease-in-out",
                                    "box-shadow": "0 8px 18px rgba(0,0,0,.15)"
                                });

                            },

                            function () {

                                $(this).css({
                                    "transform": "",
                                    "box-shadow": ""
                                });

                            }

                        );

                        const oGatewayPanel = this.byId("idGatewayPanel");

                        if (oGatewayPanel) {

                            oGatewayPanel.$().css("cursor", "pointer");
                            oGatewayPanel.$().find("*").css("cursor", "pointer");

                            oGatewayPanel.$().on("click", () => {
                                this.onCardGatewaysPress();
                            });

                            oGatewayPanel.$().hover(

                                function () {

                                    $(this).css({
                                        "transform": "translateY(-3px) scale(1.02)",
                                        "transition": "all 0.2s ease-in-out",
                                        "box-shadow": "0 8px 18px rgba(0,0,0,.15)"
                                    });

                                },

                                function () {

                                    $(this).css({
                                        "transform": "",
                                        "box-shadow": ""
                                    });

                                }

                            );

                        }
                        const oDisponibilidadeBox =
                            this.byId("idDisponibilidadeBox");

                        if (oDisponibilidadeBox) {

                            oDisponibilidadeBox.$().css("cursor", "pointer");
                            oDisponibilidadeBox.$().find("*").css("cursor", "pointer");

                            oDisponibilidadeBox.$().on("click", () => {
                                this.onCardDisponibilidadePress();
                            });

                            oDisponibilidadeBox.$().hover(

                                function () {

                                    $(this).css({
                                        "transform": "translateY(-3px) scale(1.02)",
                                        "transition": "all 0.2s ease-in-out",
                                        "box-shadow": "0 8px 18px rgba(0,0,0,.15)"
                                    });

                                },

                                function () {

                                    $(this).css({
                                        "transform": "",
                                        "box-shadow": ""
                                    });

                                }

                            );

                        }

                        const oConsistenciaBox =
                            this.byId("idConsistenciaBox");

                        if (oConsistenciaBox) {

                            oConsistenciaBox.$().css("cursor", "pointer");
                            oConsistenciaBox.$().find("*").css("cursor", "pointer");

                            oConsistenciaBox.$().on("click", () => {
                                this.onCardConsistenciaPress();
                            });

                            oConsistenciaBox.$().hover(

                                function () {

                                    $(this).css({
                                        "transform": "translateY(-3px) scale(1.02)",
                                        "transition": "all 0.2s ease-in-out",
                                        "box-shadow": "0 8px 18px rgba(0,0,0,.15)"
                                    });

                                },

                                function () {

                                    $(this).css({
                                        "transform": "",
                                        "box-shadow": ""
                                    });

                                }

                            );

                        }

                        const oEfetividadePanel =
                            this.byId("idIndicadoresPanel");

                        if (oEfetividadePanel) {

                            oEfetividadePanel.$().css("cursor", "pointer");
                            oEfetividadePanel.$().find("*").css("cursor", "pointer");

                            oEfetividadePanel.$().on("click", () => {
                                this.onCardEfetividadePress();
                            });

                            oEfetividadePanel.$().hover(

                                function () {

                                    $(this).css({
                                        "transform": "translateY(-3px) scale(1.02)",
                                        "transition": "all 0.2s ease-in-out",
                                        "box-shadow": "0 8px 18px rgba(0,0,0,.15)"
                                    });

                                },

                                function () {

                                    $(this).css({
                                        "transform": "",
                                        "box-shadow": ""
                                    });

                                }

                            );
                        }
                        const oLugaresPanel = this.byId("idLugaresPanel");

                        if (oLugaresPanel) {
                            oLugaresPanel.$().css("cursor", "pointer");
                            oLugaresPanel.$().find("*").css("cursor", "pointer");

                            oLugaresPanel.$().on("click", () => {
                                this.onCardLocalidadesPress();
                            });

                            oLugaresPanel.$().hover(
                                function () {
                                    $(this).css({
                                        "transform": "translateY(-3px) scale(1.02)",
                                        "transition": "all 0.2s ease-in-out",
                                        "box-shadow": "0 8px 18px rgba(0,0,0,.15)"
                                    });
                                },
                                function () {
                                    $(this).css({
                                        "transform": "",
                                        "box-shadow": ""
                                    });
                                }
                            );
                        }

                        const oCategoriasPanel = this.byId("idCategoriasEquipamentoPanel");

                        if (oCategoriasPanel) {

                            oCategoriasPanel.$().css("cursor", "pointer");
                            oCategoriasPanel.$().find("*").css("cursor", "pointer");

                            oCategoriasPanel.$().on("click", () => {
                                this.onCardCategoriasPress();
                            });

                            oCategoriasPanel.$().hover(
                                function () {
                                    $(this).css({
                                        "transform": "translateY(-3px) scale(1.02)",
                                        "transition": "all 0.2s ease-in-out",
                                        "box-shadow": "0 8px 18px rgba(0,0,0,.15)"
                                    });
                                },
                                function () {
                                    $(this).css({
                                        "transform": "",
                                        "box-shadow": ""
                                    });
                                }
                            );
                        }
                        const oEmbarcadosPanel =
                            this.byId("idEmbarcadosPanel");

                        if (oEmbarcadosPanel) {

                            oEmbarcadosPanel.$().css("cursor", "pointer");

                            oEmbarcadosPanel.$().find("*")
                                .css("cursor", "pointer");

                            oEmbarcadosPanel.$().on("click", () => {
                                this.onCardEmbarcadosPress();
                            });

                        }
                        const oStatusTipoPanel =
                            this.byId("idStatusTipoPanel");

                        if (oStatusTipoPanel) {

                            oStatusTipoPanel.$().css("cursor", "pointer");

                            oStatusTipoPanel.$().find("*")
                                .css("cursor", "pointer");

                            oStatusTipoPanel.$().on("click", () => {
                                this.onCardStatusTipoPress();
                            });

                        }
                        const oOnlinePanel =
                            this.byId("idOnlinePanel");

                        if (oOnlinePanel) {

                            oOnlinePanel.$().css("cursor", "pointer");

                            oOnlinePanel.$().on("click", () => {
                                this.onCardOnlinePress();
                            });

                        }

                        const oOfflinePanel =
                            this.byId("idOfflinePanel");

                        if (oOfflinePanel) {

                            oOfflinePanel.$().css("cursor", "pointer");
                            oOfflinePanel.$().find("*").css("cursor", "pointer");

                            oOfflinePanel.$().on("click", () => {
                                this.onCardOfflinePress();
                            });

                        }

                        $(document)
                            .off("click", ".cardVeiculoCustom")
                            .on("click", ".cardVeiculoCustom", (e) => {

                                const sVeiculo = $(e.currentTarget)
                                    .find(".tituloCardVeiculo")
                                    .text()
                                    .trim()
                                    .toUpperCase();

                                this.onPesquisarRastreador({
                                    getParameter: function (sName) {
                                        return sName === "query"
                                            ? sVeiculo
                                            : "";
                                    }
                                });

                            });


                    }, 500);

                }

                if (!this._zoomAplicado) {



                }

                if (this._dashboardCarregado) {
                    return;
                }

                this._dashboardCarregado = true;

                this.carregarDashboard();

            },
            gerarDetalhamentoIndicadores() {
                return [
                    {
                        indicador: "Disponibilidade",
                        oQueMede: "...",
                        comoCalculado: "...",
                        formula: "...",
                        importancia: "..."
                    },
                    {
                        indicador: "Cobertura",
                        oQueMede: "...",
                        comoCalculado: "...",
                        formula: "...",
                        importancia: "..."
                    },
                    {
                        indicador: "Gateways",
                        oQueMede: "...",
                        comoCalculado: "...",
                        formula: "...",
                        importancia: "..."
                    },
                    {
                        indicador: "Consistência",
                        oQueMede: "...",
                        comoCalculado: "...",
                        formula: "...",
                        importancia: "..."
                    },
                    {
                        indicador: "Índice Geral de Efetividade",
                        oQueMede: "...",
                        comoCalculado: "...",
                        formula: "...",
                        importancia: "..."
                    }
                ];
            },
            gerarDistribuicaoMinas(dados) {

                const resumo = {
                    Itabira: 0,
                    Brucutu: 0,
                    Pico: 0,
                    Vespasiano: 0
                };

                dados.forEach(item => {

                    const local =
                        (item.localInstalacao || "")
                            .toUpperCase();

                    if (local.startsWith("FEBR")) {

                        resumo.Brucutu++;

                    } else if (local.startsWith("PPIC")) {

                        resumo.Pico++;

                    } else if (local.includes("_EMREF_EXT")) {

                        resumo.Vespasiano++;

                    } else {

                        resumo.Itabira++;

                    }

                });

                return [

                    {
                        mina: "ITABIRA",
                        quantidade: resumo.Itabira
                    },

                    {
                        mina: "BRUCUTU",
                        quantidade: resumo.Brucutu
                    },

                    {
                        mina: "PICO",
                        quantidade: resumo.Pico
                    },

                    {
                        mina: "SOTREQ",
                        quantidade: resumo.Vespasiano
                    }

                ];

            },
            gerarDistribuicaoImplantacao(dados) {

                const resumo = {};

                dados.forEach(item => {

                    let mina = "Itabira";

                    const local =
                        (item.localInstalacao || "")
                            .toUpperCase();

                    if (local.startsWith("FEBR")) {

                        mina = "Brucutu";

                    } else if (local.startsWith("PPIC")) {

                        mina = "Pico";

                    } else if (local.includes("_EMREF_EXT")) {

                        mina = "Vespasiano";

                    }

                    let localizacao = "";

                    if (
                        item.grupoAtual &&
                        item.grupoAtual.startsWith("Instalado no ")
                    ) {

                        localizacao =
                            item.grupoAtual.replace(
                                "Instalado no ",
                                ""
                            );

                    } else {

                        localizacao =
                            item.descLocalInstalacao ||
                            item.localInstalacao ||
                            "Não informado";

                    }

                    const chave =
                        mina +
                        "|" +
                        localizacao;

                    if (!resumo[chave]) {

                        resumo[chave] = {
                            mina,
                            localizacao,
                            comandoFinal: 0,
                            transmissao: 0,
                            conversorTorque: 0,
                            diferencial: 0,
                            motor: 0,
                            total: 0
                        };

                    }

                    const equipamento =
                        (item.descEquipamento || "").toUpperCase();

                    if (equipamento.includes("COMANDO FINAL")) {
                        resumo[chave].comandoFinal++;
                    }
                    else if (equipamento.includes("TRANSM")) {
                        resumo[chave].transmissao++;
                    }
                    else if (equipamento.includes("CONVERSOR")) {
                        resumo[chave].conversorTorque++;
                    }
                    else if (equipamento.includes("DIFERENCIAL")) {
                        resumo[chave].diferencial++;
                    }
                    else if (equipamento.includes("MOTOR")) {
                        resumo[chave].motor++;
                    }

                    resumo[chave].total++;

                });

                const resultado = Object.values(resumo)
                    .sort((a, b) => {

                        if (a.mina !== b.mina) {
                            return a.mina.localeCompare(b.mina);
                        }

                        return a.localizacao.localeCompare(
                            b.localizacao
                        );

                    });

                const total = {
                    mina: "",
                    localizacao: "TOTAL",
                    comandoFinal: 0,
                    transmissao: 0,
                    conversorTorque: 0,
                    diferencial: 0,
                    motor: 0,
                    total: 0
                };

                resultado.forEach(item => {

                    total.comandoFinal += item.comandoFinal;
                    total.transmissao += item.transmissao;
                    total.conversorTorque += item.conversorTorque;
                    total.diferencial += item.diferencial;
                    total.motor += item.motor;
                    total.total += item.total;

                });

                resultado.push(total);

                return resultado;

            },
            gerarDistribuicaoRastreadores(dados) {

                return dados.map(item => {

                    let mina = "Itabira";

                    const local =
                        (item.localInstalacao || "")
                            .toUpperCase();

                    if (local.startsWith("FEBR")) {

                        mina = "Brucutu";

                    } else if (local.startsWith("PPIC")) {

                        mina = "Pico";

                    } else if (local.includes("_EMREF_EXT")) {

                        mina = "Vespasiano";

                    }

                    let localizacaoAtual = "";

                    if (
                        item.grupoAtual &&
                        item.grupoAtual.startsWith("Instalado no ")
                    ) {

                        localizacaoAtual =
                            item.grupoAtual.replace(
                                "Instalado no ",
                                ""
                            );

                    } else {

                        localizacaoAtual =
                            item.descLocalInstalacao ||
                            item.localInstalacao ||
                            "";

                    }

                    return {

                        mina,

                        localizacaoAtual,

                        codigoSap:
                            item.identificador,

                        equipamento:
                            item.descEquipamento

                    };

                });

            },
            _mostrarAjudaCobertura() {

                const instalados =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/instalados");

                const planejado = 50;

                const faltantes =
                    planejado - instalados;

                sap.m.MessageBox.information(

                    "Meta planejada: " +
                    planejado +

                    "\nRastreadores instalados: " +
                    instalados +

                    "\nRastreadores pendentes: " +
                    faltantes +

                    "\n\nFaltam " +
                    faltantes +
                    " rastreadores para atingir 100% da cobertura planejada do.",

                    {
                        title: "Cobertura de Rastreadores"
                    }

                );

            },
            _mostrarAjudaDisponibilidade() {

                const disponibilidade =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/disponibilidadeMonitoramento");

                const componentesDisponiveis =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/componentesDisponiveis");

                const totalComponentes =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/totalComponentesValorGerado");

                const componentesIndisponiveis =
                    totalComponentes - componentesDisponiveis;

                sap.m.MessageBox.information(

                    "Componentes elegíveis: " +
                    totalComponentes +

                    "\nComponentes disponíveis: " +
                    componentesDisponiveis +

                    "\nComponentes indisponíveis: " +
                    componentesIndisponiveis +

                    "\n\nDisponibilidade atual: " +
                    disponibilidade +
                    "%" +

                    "\n\nExistem " +
                    componentesIndisponiveis +
                    " componentes que não apresentaram comunicação recente e devem ser avaliados.",

                    {
                        title: "Disponibilidade de Monitoramento"
                    }

                );

            },
            _mostrarAjudaGateway() {

                const gatewaysAtivos =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/gateways");

                const gatewaysPlanejados = 7;

                const gatewaysPendentes =
                    gatewaysPlanejados - gatewaysAtivos;

                const percentual =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/percentualGateway");

                sap.m.MessageBox.information(

                    "Gateways planejados: " +
                    gatewaysPlanejados +

                    "\nGateways ativos: " +
                    gatewaysAtivos +

                    "\nGateways pendentes: " +
                    gatewaysPendentes +

                    "\n\nCobertura atual: " +
                    percentual +
                    "%" +

                    "\n\nFaltam " +
                    gatewaysPendentes +
                    " gateways para concluir a infraestrutura RFID prevista para o.",

                    {
                        title: "Cobertura de Gateways"
                    }

                );

            },
            _mostrarAjudaConsistencia() {

                const falhas =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/falhasMovimentacao");

                const consistentes =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/consistenciasMovimentacao");

                const online =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/online");

                const percentual =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/percentualConsistenciaMovimentacao");

                sap.m.MessageBox.information(

                    "Rastreadores online: " +
                    online +

                    "\nMovimentações consistentes: " +
                    consistentes +

                    "\nInconsistências identificadas: " +
                    falhas +

                    "\n\nConsistência atual: " +
                    percentual +
                    "%" +

                    "\n\nForam identificadas " +
                    falhas +
                    " divergências entre a localização cadastrada no SAP e a localização detectada pela infraestrutura RFID.",

                    {
                        title: "Consistência das Movimentações"
                    }

                );

            },
            onAjudaOportunidadePress(oEvent) {

                const tipo =
                    oEvent.getSource()
                        .getBindingContext("dashboard")
                        .getProperty("tipo");

                switch (tipo) {

                    case "cobertura":
                        this._mostrarAjudaCobertura();
                        break;

                    case "disponibilidade":
                        this._mostrarAjudaDisponibilidade();
                        break;

                    case "gateway":
                        this._mostrarAjudaGateway();
                        break;

                    case "consistencia":
                        this._mostrarAjudaConsistencia();
                        break;

                    default:

                        sap.m.MessageBox.information(
                            "Nenhum detalhamento disponível."
                        );

                }

            },
            async onAtualizacaoManualPress() {

                const oBusyDialog = new BusyDialog({
                    title: "Atualização Manual",
                    text: "Atualizando dados dos rastreadores....."
                });

                oBusyDialog.open();

                try {

                    const response = await fetch(
                        "http://10.44.32.193:4000/LocalizacaoAtual/processar"
                    );

                    if (!response.ok) {

                        throw new Error(
                            `Erro ${response.status}`
                        );

                    }

                    sap.m.MessageToast.show(
                        "Processamento concluído com sucesso."
                    );

                    await this.carregarDashboard();

                    const oIconTabBar =
                        this.byId("idIconTabBar");

                    if (oIconTabBar) {

                        oIconTabBar.setSelectedKey(
                            "geo"
                        );

                    }

                } catch (e) {

                    sap.m.MessageBox.error(
                        e.message ||
                        "Erro ao processar atualização."
                    );

                } finally {

                    oBusyDialog.close();

                }

            },


            onButtonAjudaDisponibilidadeMonitoramentoPress() {

                const componentesDisponiveis =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/componentesDisponiveis");

                const totalComponentes =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/totalComponentesValorGerado");

                const disponibilidade =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/disponibilidadeMonitoramento");

                const formula =
                    componentesDisponiveis +
                    " componentes disponíveis ÷ " +
                    totalComponentes +
                    " componentes elegíveis × 100 = " +
                    disponibilidade +
                    "%";

                const oDialog = new sap.m.Dialog({
                    title: "Disponibilidade",
                    contentWidth: "650px",

                    content: new sap.m.FormattedText({
                        htmlText:

                            "<strong>O que mede?</strong><br><br>" +

                            "Indica o percentual de componentes elegíveis que permaneceram disponíveis para rastreamento durante o período analisado.<br><br>" +

                            "<strong>Como é calculado?</strong><br><br>" +

                            "Considera os componentes que apresentaram comunicação frequente. Itabira.<br><br>" +

                            "<strong>" +
                            formula +
                            "</strong><br><br>" +

                            "<strong>Por que é importante?</strong><br><br>" +

                            "Demonstra a capacidade real da solução de monitorar continuamente os componentes, considerando apenas indisponibilidades que efetivamente podem ser atribuídas à infraestrutura monitorada."
                    }),

                    beginButton: new sap.m.Button({
                        text: "OK",
                        press: function () {
                            oDialog.close();
                            oDialog.destroy();
                        }
                    })
                });

                oDialog.open();

            },
            onButtonAjudaComponentesMovimentadosPress() {

                const componentesMovimentados =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/componentesMovimentados");

                const totalComponentes =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/totalComponentesValorGerado");

                const percentualMovimentados =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/percentualMovimentados");

                sap.m.MessageBox.information(

                    "O que mede?\n\n" +

                    "Quantidade de componentes que apresentaram pelo menos uma mudança de localização durante o período do.\n\n" +

                    "Como é calculado?\n\n" +

                    "A partir da análise do histórico de rastreamento, identificando componentes que registraram movimentações entre locais, oficinas, minas ou fases do processo.\n\n" +

                    componentesMovimentados +
                    " componentes movimentados ÷ " +
                    totalComponentes +
                    " componentes monitorados × 100 = " +
                    percentualMovimentados +
                    "%\n\n" +

                    "Por que é importante?\n\n" +

                    "Comprova a utilização real da solução em componentes que efetivamente circularam pela operação, validando o rastreamento em cenários reais.",

                    {
                        title: "Componentes Movimentados"
                    }

                );

            },
            onAjudaOportunidadePress(oEvent) {

                const tipo =
                    oEvent.getSource()
                        .getBindingContext("dashboard")
                        .getProperty("tipo");

                switch (tipo) {

                    case "cobertura":
                        this._mostrarAjudaCobertura();
                        break;

                    case "disponibilidade":
                        this._mostrarAjudaDisponibilidade();
                        break;

                    case "gateway":
                        this._mostrarAjudaGateway();
                        break;

                    case "consistencia":
                        this._mostrarAjudaConsistencia();
                        break;

                }

            },

            onButtonAjudaCoberturaPress() {

                const oDashboard =
                    this.getView()
                        .getModel("dashboard")
                        .getData();

                const instalados =
                    oDashboard.instalados;

                const planejado = 50;

                const cobertura =
                    oDashboard.coberturaValorGerado;

                const oDialog = new sap.m.Dialog({
                    title: "Cobertura de Rastreadores",
                    contentWidth: "650px",

                    content: new sap.m.FormattedText({
                        htmlText:

                            "<strong>O que mede?</strong><br><br>" +

                            "Percentual da meta de implantação efetivamente alcançada durante o.<br><br>" +

                            "<strong>Como é calculado?</strong><br><br>" +

                            "Relação entre a quantidade de componentes monitorados e a meta planejada para o.<br><br>" +

                            "<strong>" +
                            instalados +
                            " componentes instalados ÷ " +
                            planejado +
                            " componentes planejados × 100 = " +
                            cobertura +
                            "%" +
                            "</strong><br><br>" +

                            "<strong>Por que é importante?</strong><br><br>" +

                            "Mostra o nível de adoção da solução e indica se os resultados obtidos são representativos para apoiar uma expansão da iniciativa."
                    }),

                    beginButton: new sap.m.Button({
                        text: "OK",
                        press: function () {
                            oDialog.close();
                            oDialog.destroy();
                        }
                    })
                });

                oDialog.open();

            },
            onButtonAjudaIndiceEfetividadePress: function () {
                const oView = this.getView();
                const oModel = oView.getModel("dashboard");

                const disponibilidade = Math.round(
                    parseFloat(oModel.getProperty("/disponibilidadeMonitoramento")) || 0
                );

                const consistencia = Math.round(
                    parseFloat(oModel.getProperty("/percentualConsistenciaMovimentacao")) || 0
                );

                const indice = Math.round(
                    parseFloat(oModel.getProperty("/indiceEfetividade")) || 0
                );

                const calcDisp = Math.round(disponibilidade * 0.70);
                const calcCons = Math.round(consistencia * 0.30);

                const oDialog = new sap.m.Dialog({
                    title: "Índice Geral de Efetividade",
                    contentWidth: "580px",
                    contentHeight: "580px",
                    verticalScrolling: true,
                    content: new sap.m.VBox({
                        styleClass: "sapUiMediumMargin sapUiSmallMarginBottom",
                        items: [
                            new sap.m.VBox({
                                alignItems: "Center",
                                styleClass: "sapUiMediumMarginBottom",
                                items: [
                                    // 1.   Mudamos para ObjectNumber para ativar o CSS do .tituloIndicadorPopup
                                    new sap.m.ObjectNumber({
                                        number: indice + "%"
                                    }).addStyleClass("tituloIndicadorPopup"),// Aplica ambas as classes do seu CSS

                                    // 2. Mantemos o Text com a classe de subtítulo
                                    new sap.m.Text({
                                        text: "Índice Geral de Efetividade"
                                    }).addStyleClass("subtituloPopup")
                                ]
                            }),

                            new sap.m.FormattedText({
                                htmlText:
                                    "<strong>O que mede?</strong><br><br>" +
                                    "Consolida os principais resultados em uma única métrica de desempenho, considerando a disponibilidade dos componentes monitorados e a consistência sistêmica da solução.<br><br>" +
                                    "<strong>Como é calculado?</strong><br><br>" +
                                    "O índice é composto por 70% de Disponibilidade de Monitoramento e 30% de Consistência.<br><br>" +
                                    "<strong>Composição</strong><br><br>" +
                                    "Disponibilidade: <strong>" + disponibilidade + "%</strong><br>" +
                                    "Consistência: <strong>" + consistencia + "%</strong><br><br>" +
                                    "<strong>Cálculo</strong><br><br>" +
                                    "Disponibilidade (" + disponibilidade + "% × 70%) = " + calcDisp + "%<br>" +
                                    "Consistência (" + consistencia + "% × 30%) = " + calcCons + "%<br><br>" +
                                    "<strong>Resultado</strong><br><br>" +
                                    calcDisp + "% + " + calcCons + "% = <strong>" + indice + "%</strong><br><br>" +
                                    "<strong>Por que é importante?</strong><br><br>" +
                                    "Permite avaliar a efetividade global da solução combinando a capacidade de monitoramento dos componentes e a consistência sistêmica da solução."
                            }).addStyleClass("popupTextoGrande")
                        ]
                    }),
                    buttons: [

                        new sap.m.Button({
                            text: "EXCEL",
                            press: function () {

                                const oSpreadsheet = new Spreadsheet({
                                    workbook: {
                                        columns: [
                                            {
                                                label: "Disponibilidade (%)",
                                                property: "disponibilidade"
                                            },
                                            {
                                                label: "Consistência (%)",
                                                property: "consistencia"
                                            },
                                            {
                                                label: "Índice Geral de Efetividade (%)",
                                                property: "indice"
                                            }
                                        ]
                                    },
                                    dataSource: [{
                                        disponibilidade: disponibilidade,
                                        consistencia: consistencia,
                                        indice: indice
                                    }],
                                    fileName: "Indice_Geral_Efetividade.xlsx"
                                });

                                oSpreadsheet.build()
                                    .finally(function () {
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
                oDialog.addStyleClass("dialogIndicadores");
                oDialog.open();
            },


            onCardOnlinePress() {

                const agora = new Date();

                const limiteOnline = new Date(
                    agora.getTime() -
                    (7 * 24 * 60 * 60 * 1000)
                );

                const dados =
                    this._dadosFiltrados.filter(item => {

                        if (!item.ultimaPosicao) {
                            return false;
                        }

                        if (!this._testeData) {

                            this._testeData = true;

                            sap.m.MessageBox.information(
                                "Identificador: " + item.identificador +
                                "\n\nÚltima posição recebida:" +
                                "\n" + item.ultimaPosicao
                            );

                        }

                        const dataPosicao =
                            this.converterDataBr(
                                item.ultimaPosicao
                            );

                        if (
                            !dataPosicao ||
                            isNaN(dataPosicao.getTime())
                        ) {
                            return true;
                        }

                        return dataPosicao < limiteOnline;

                    });

                let texto = "";

                texto +=
                    "Componentes Online: " +
                    dados.length +
                    "\n\n";

                dados.forEach(item => {

                    texto +=
                        "Equipamento: " +
                        item.identificador +
                        "\n" +

                        "Descrição: " +
                        item.descEquipamento +
                        "\n" +

                        "Local: " +
                        (item.descLocalInstalacao ||
                            item.localInstalacao ||
                            "Não informado") +
                        "\n" +

                        "Grupo: " +
                        item.grupoAtual +
                        "\n" +

                        "Gateway: " +
                        (item.gateway || "Não informado") +
                        "\n" +

                        "Última atualização: " +
                        item.ultimaPosicao +
                        "\n\n" +

                        "─────────────────────────" +
                        "\n\n";

                });

                sap.m.MessageBox.information(
                    texto,
                    {
                        title: "Componentes Online"
                    }
                );

            },
            onCardOfflinePress() {

                const agora = new Date();

                const limiteOnline = new Date(
                    agora.getTime() -
                    (7 * 24 * 60 * 60 * 1000)
                );

                const dados =
                    this._dadosFiltrados.filter(item => {

                        if (!item.ultimaPosicao) {
                            return true;
                        }

                        const dataPosicao =
                            this.converterDataBr(
                                item.ultimaPosicao
                            );

                        if (
                            !dataPosicao ||
                            isNaN(dataPosicao.getTime())
                        ) {
                            return true;
                        }

                        return dataPosicao < limiteOnline;

                    });

                let texto = "";

                const offlineCard =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/offline");

                texto += `Componentes Offline: ${dados.length}\n\n`;

                dados.forEach(item => {

                    texto +=
                        `Equipamento: ${item.identificador}\n` +
                        `Descrição: ${item.descEquipamento}\n` +
                        `Local: ${item.localInstalacao}\n` +
                        `Grupo: ${item.grupoAtual}\n` +
                        `Gateway: ${item.gateway || "Não informado"}\n` +
                        `Última atualização: ${item.ultimaPosicao || "Sem comunicação"}\n\n` +
                        `─────────────────────────\n\n`;

                });

                sap.m.MessageBox.information(
                    texto,
                    {
                        title: "Componentes Offline"
                    }
                );

            },
            onCardComponentesPress() {

                const dadosExibidos =
                    (this._dadosFiltrados || [])
                        .filter(item => {

                            if (
                                (item.grupoAtual || "")
                                    .trim()
                                    .toUpperCase() ===
                                "NÃO DEFINIDO"
                            ) {
                                return false;
                            }

                            if (
                                item.identificador ===
                                "11039948"
                            ) {
                                return false;
                            }

                            return true;

                        });

                const total =
                    dadosExibidos.length;


                let html = `
                    <div style="
                        max-height:650px;
                        overflow-y:auto;
                        font-size:12px;
                    ">
                `;

                dadosExibidos
                    .sort((a, b) =>
                        String(a.identificador)
                            .localeCompare(
                                String(b.identificador)
                            )
                    )
                    .forEach(item => {

                        html += `
                            <div
                                class="linhaRastreadorPopup"
                                data-id="${item.identificador}"
                                style="
                                    padding:8px;
                                    border-bottom:1px solid #e5e7eb;
                                    margin-bottom:4px;
                                    border-radius:8px;
                                    cursor:pointer;
                                    transition:all .15s ease;
                                "
                            >

                                <div>
                                    <b>${item.identificador}</b>
                                </div>

                                <div>
                                    ${item.descEquipamento || ""}
                                </div>

                                <div style="
                                    color:#2563eb;
                                    font-weight:bold;
                                ">
                                    ${item.grupoAtual || ""}
                                </div>

                                <div style="
                                    color:#64748b;
                                    font-size:12px;
                                ">
                                    ${item.localInstalacao || ""}
                                </div>

                            </div>
                        `;

                    });

                html += "</div>";

                this._oDialogRastreadores = new sap.m.Dialog({

                    customHeader: new sap.m.Bar({
                        contentLeft: [
                            new sap.m.Title({
                                text: `Rastreadores (${total})`
                            })
                        ],
                        contentRight: [
                            new sap.m.Button({
                                icon: "sap-icon://decline",
                                type: "Transparent",
                                press: function () {
                                    this._oDialogRastreadores.close();
                                }.bind(this)
                            }).addStyleClass("btnFecharPopup")
                        ]
                    }),

                    contentWidth: "900px",
                    contentHeight: "700px",

                    content: [
                        new sap.ui.core.HTML({
                            content: html
                        })
                    ],

                    buttons: [

                        new sap.m.Button({
                            text: "EXCEL",
                            press: function () {

                                const oSpreadsheet = new Spreadsheet({
                                    workbook: {
                                        columns: [
                                            {
                                                label: "Identificador",
                                                property: "identificador"
                                            },
                                            {
                                                label: "Descrição",
                                                property: "descEquipamento"
                                            },
                                            {
                                                label: "Grupo Atual",
                                                property: "grupoAtual"
                                            },
                                            {
                                                label: "Local Instalação",
                                                property: "localInstalacao"
                                            }
                                        ]
                                    },
                                    dataSource: dadosExibidos,
                                    fileName: "Rastreadores.xlsx"
                                });

                                oSpreadsheet.build()
                                    .finally(function () {
                                        oSpreadsheet.destroy();
                                    });

                            }
                        }).addStyleClass("botaoDialogExcel"),

                        new sap.m.Button({
                            text: "OK",
                            press: function () {
                                this._oDialogRastreadores.close();
                            }.bind(this)
                        }).addStyleClass("botaoDialogCinza")

                    ],
                    afterClose: function () {

                        this._oDialogRastreadores.destroy();
                        this._oDialogRastreadores = null;

                    }.bind(this)

                });


                this._oDialogRastreadores.addStyleClass(
                    "sapUiContentPadding"
                );
                this._oDialogRastreadores.addStyleClass(
                    "dialogRastreadores"
                );
                this._oDialogRastreadores.open();

                setTimeout(() => {

                    document
                        .querySelectorAll(".linhaRastreadorPopup")
                        .forEach(el => {

                            el.onmouseenter = () => {
                                el.style.background = "#f5f9ff";
                                el.style.transform = "translateX(4px)";
                                el.style.borderLeft = "4px solid #0a6ed1";
                            };

                            el.onmouseleave = () => {
                                el.style.background = "";
                                el.style.transform = "";
                                el.style.borderLeft = "";
                            };

                            // Captura a referência do 'this' correto do controlador
                            const oView = this;

                            el.onclick = function () {
                                // Aqui, dentro de uma function comum, 'this' seria o elemento 'el'
                                // Por isso usamos a variável 'id' obtida diretamente do elemento
                                const id = el.dataset.id;

                                if (oView._oDialogRastreadores) {
                                    oView._oDialogRastreadores.close();
                                }

                                oView.onPesquisarRastreador({
                                    getParameter: function (sNome) {
                                        return sNome === "query" ? id : "";
                                    }
                                });
                            };


                        });

                }, 200);
            },
            onButtonAjudaCoberturaGatewaysPress() {

                const gatewaysAtivos =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/gateways");

                const percentual =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/percentualGateway");

                const gatewaysPlanejados = 7;

                const oDialog = new sap.m.Dialog({
                    title: "Cobertura de Gateways",
                    contentWidth: "650px",

                    content: new sap.m.FormattedText({
                        htmlText:

                            "<strong>O que mede?</strong><br><br>" +

                            "Avalia o percentual de gateways previstos para o que estão efetivamente ativos e contribuindo para a cobertura da infraestrutura RFID.<br><br>" +

                            "<strong>Como é calculado?</strong><br><br>" +

                            "Compara a quantidade de gateways ativos identificados no ambiente com a quantidade total planejada para o.<br><br>" +

                            "<strong>" +
                            gatewaysAtivos +
                            " gateways ativos ÷ " +
                            gatewaysPlanejados +
                            " gateways planejados × 100 = " +
                            percentual +
                            "%</strong><br><br>" +

                            "<strong>Por que é importante?</strong><br><br>" +

                            "A disponibilidade dos gateways impacta diretamente a capacidade da solução de detectar movimentações e monitorar componentes em tempo real. Quanto maior a cobertura da infraestrutura, maior a confiabilidade dos indicadores de rastreamento."
                    }),

                    beginButton: new sap.m.Button({
                        text: "OK",
                        press: function () {
                            oDialog.close();
                            oDialog.destroy();
                        }
                    })
                });

                oDialog.open();

            },
            onButtonAjudaConsistenciaMovimentacaoPress() {

                const consistentes =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/consistenciasMovimentacao");

                const online =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/online");

                const percentual =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/percentualConsistenciaMovimentacao");

                const oDialog = new sap.m.Dialog({
                    title: "Consistência das Movimentações",
                    contentWidth: "650px",

                    content: new sap.m.FormattedText({
                        htmlText:

                            "<strong>O que mede?</strong><br><br>" +

                            "Avalia a aderência entre a localização operacional sistêmica e a última movimentação detectada pela infraestrutura RFID de Itabira.<br><br>" +

                            "<strong>Como é calculado?</strong><br><br>" +

                            "Considera apenas rastreadores online (última atualização nos últimos 7 dias). Um rastreador é considerado consistente quando sua localização sistêmica está compatível com a área operacional onde foi detectado.<br><br>" +

                            "<strong>" +
                            consistentes +
                            " movimentações consistentes ÷ " +
                            online +
                            " rastreadores online × 100 = " +
                            percentual +
                            "%</strong><br><br>" +

                            "<strong>Por que é importante?</strong><br><br>" +

                            "Permite identificar divergências entre a localização física dos componentes e os registros sistêmicos, aumentando a confiabilidade das informações utilizadas para gestão e rastreabilidade."
                    }),

                    beginButton: new sap.m.Button({
                        text: "OK",
                        press: function () {
                            oDialog.close();
                            oDialog.destroy();
                        }
                    })
                });

                oDialog.open();

            },
            onSugestaoInspecaoPress(oEvent) {

                const sNome =
                    oEvent.getSource().data("nome");

                const aSugestoes =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/sugestoesInspecao") || [];

                const oSugestao =
                    aSugestoes.find(
                        item => item.nome === sNome
                    );

                if (!oSugestao) {
                    return;
                }

                this.onPesquisarRastreador({
                    getParameter: function (sParametro) {

                        return sParametro === "query"
                            ? sNome
                            : "";

                    }
                });

            },
            onCardCategoriasPress: function () {

                const aDados = this._dadosFiltrados || [];

                if (!aDados.length) {

                    sap.m.MessageToast.show(
                        "Nenhum equipamento encontrado."
                    );

                    return;
                }

                const oAgrupamento = {};

                aDados.forEach(item => {

                    const sDescricao =
                        item.descEquipamento || "Não informado";

                    oAgrupamento[sDescricao] =
                        (oAgrupamento[sDescricao] || 0) + 1;

                });

                const aCategorias = Object.keys(oAgrupamento)
                    .map(sDescricao => ({
                        descricao: sDescricao,
                        quantidade: oAgrupamento[sDescricao]
                    }))
                    .sort((a, b) =>
                        a.descricao.localeCompare(
                            b.descricao,
                            "pt-BR",
                            { sensitivity: "base" }
                        )
                    );


                const oList = new sap.m.List();

                const oCategoriasAgrupadas = {};

                aCategorias.forEach(item => {

                    let sGrupo = "OUTROS";

                    const sDescricao =
                        (item.descricao || "").toUpperCase();

                    if (sDescricao.startsWith("COMANDO FINAL")) {
                        sGrupo = "COMANDO FINAL";
                    } else if (sDescricao.startsWith("CONVERSOR")) {
                        sGrupo = "CONVERSOR TORQUE";
                    } else if (sDescricao.startsWith("DIFERENCIAL")) {
                        sGrupo = "DIFERENCIAL";
                    } else if (sDescricao.startsWith("MOTOR")) {
                        sGrupo = "MOTOR";
                    } else if (
                        sDescricao.startsWith("TRANSMISSAO") ||
                        sDescricao.startsWith("TRANSMISSÃO")
                    ) {
                        sGrupo = "TRANSMISSÃO";
                    }

                    if (!oCategoriasAgrupadas[sGrupo]) {
                        oCategoriasAgrupadas[sGrupo] = [];
                    }

                    oCategoriasAgrupadas[sGrupo].push(item);

                });

                Object.keys(oCategoriasAgrupadas)
                    .sort()
                    .forEach(sGrupo => {

                        oList.addItem(
                            new sap.m.GroupHeaderListItem({
                                title: sGrupo
                            })
                        );

                        oCategoriasAgrupadas[sGrupo]
                            .sort((a, b) =>
                                a.descricao.localeCompare(
                                    b.descricao,
                                    "pt-BR",
                                    { sensitivity: "base" }
                                )
                            )
                            .forEach(item => {

                                oList.addItem(
                                    new sap.m.StandardListItem({
                                        title:
                                            item.descricao +
                                            " (" +
                                            item.quantidade +
                                            ")",
                                        icon: "sap-icon://product",
                                        type: "Navigation",
                                        press: () => {
                                            this._abrirDetalhesCategoria(
                                                item.descricao
                                            );
                                        }
                                    })
                                );

                            });

                    });

                this._oDialogCategorias = new sap.m.Dialog({

                    customHeader: new sap.m.Bar({
                        contentLeft: [
                            new sap.m.Title({
                                text: "Categorias de Equipamento"
                            })
                        ],
                        contentRight: [
                            new sap.m.Button({
                                icon: "sap-icon://decline",
                                type: "Transparent",
                                press: function () {
                                    this._oDialogCategorias.close();
                                }.bind(this)
                            }).addStyleClass("btnFecharPopup")
                        ]
                    }),

                    contentWidth: "800px",
                    contentHeight: "auto",
                    draggable: true,
                    resizable: true,
                    content: [oList],

                    buttons: [

                        new sap.m.Button({
                            text: "EXCEL",
                            press: function () {

                                const oSpreadsheet = new Spreadsheet({
                                    workbook: {
                                        columns: [
                                            {
                                                label: "Categoria",
                                                property: "descricao"
                                            },
                                            {
                                                label: "Quantidade",
                                                property: "quantidade",
                                                type: "number"
                                            }
                                        ]
                                    },
                                    dataSource: aCategorias,
                                    fileName: "Categorias_Equipamento.xlsx"
                                });

                                oSpreadsheet.build()
                                    .finally(function () {
                                        oSpreadsheet.destroy();
                                    });

                            }
                        }).addStyleClass("botaoDialogExcel"),

                        new sap.m.Button({
                            text: "OK",
                            press: function () {
                                this._oDialogCategorias.close();
                            }.bind(this)
                        }).addStyleClass("botaoDialogCinza")

                    ],

                    afterClose: function () {

                        this._oDialogCategorias.destroy();
                        this._oDialogCategorias = null;

                    }.bind(this)
                });

                this._oDialogCategorias.addStyleClass("sapUiContentPadding");
                this._oDialogCategorias.addStyleClass("dialogRastreadores");

                this._oDialogCategorias.open();

            },
            onDetalheEquipamentoPress: function (oEvent) {

                const oEquipamento =
                    oEvent.getSource()
                        .getBindingContext()
                        .getObject();

                if (this._oDialogDetalhesCategoria) {
                    this._oDialogDetalhesCategoria.close();
                }

                if (this._oDialogCategorias) {
                    this._oDialogCategorias.close();
                }

                let sPesquisa = oEquipamento.identificador;

                if (
                    oEquipamento.grupoAtual &&
                    oEquipamento.grupoAtual.startsWith("Instalado no ")
                ) {

                    sPesquisa = oEquipamento.grupoAtual.replace(
                        "Instalado no ",
                        ""
                    ).trim();

                }

                this.onPesquisarRastreador({
                    getParameter: function (sName) {
                        return sName === "query"
                            ? sPesquisa
                            : "";
                    }
                });

            },
            _abrirDetalhesCategoria: function (sCategoria) {

                if (this._oDialogCategorias) {
                    this._oDialogCategorias.close();
                }


                const aDados = (this._dadosFiltrados || [])
                    .filter(item =>
                        (item.descEquipamento || "") === sCategoria
                    )
                    .sort((a, b) =>
                        (a.localInstalacao || "").localeCompare(
                            b.localInstalacao || "",
                            "pt-BR",
                            { sensitivity: "base" }
                        )
                    );

                const oModel = new sap.ui.model.json.JSONModel({
                    equipamentos: aDados
                });

                const oTable = new sap.m.Table({
                    growing: true,
                    sticky: ["ColumnHeaders"],

                    columns: [

                        new sap.m.Column({
                            width: "auto",
                            header: new sap.m.Label({
                                text: "Status"
                            })
                        }),

                        new sap.m.Column({
                            width: "auto",
                            header: new sap.m.Label({
                                text: "Equipamento"
                            })
                        }),

                        new sap.m.Column({
                            width: "auto",
                            header: new sap.m.Label({
                                text: "Descrição"
                            })
                        }),

                        new sap.m.Column({
                            header: new sap.m.Label({
                                text: "Local Instalação"
                            })
                        })

                    ]
                });

                oTable.setModel(oModel);

                oTable.bindItems({
                    path: "/equipamentos",
                    template: new sap.m.ColumnListItem({

                        type: "Navigation",

                        press: this.onDetalheEquipamentoPress.bind(this),

                        cells: [

                            new sap.m.Text({
                                text: "{grupoAtual}"
                            }),

                            new sap.m.Text({
                                text: "{identificador}"
                            }),

                            new sap.m.Text({
                                text: "{descEquipamento}"
                            }),

                            new sap.m.Text({
                                text: "{localInstalacao}"
                            })

                        ]

                    })
                });

                this._oDialogDetalhesCategoria = new sap.m.Dialog({

                    customHeader: new sap.m.Bar({
                        contentLeft: [
                            new sap.m.Title({
                                text: sCategoria
                            })
                        ],
                        contentRight: [
                            new sap.m.Button({
                                icon: "sap-icon://decline",
                                type: "Transparent",
                                press: function () {
                                    this._oDialogDetalhesCategoria.close();
                                }.bind(this)
                            }).addStyleClass("btnFecharPopup")
                        ]
                    }),

                    contentWidth: "1200px",

                    contentHeight: "auto",

                    draggable: true,

                    resizable: true,

                    stretchOnPhone: true,

                    content: [oTable],

                    buttons: [

                        new sap.m.Button({
                            text: "EXCEL",
                            press: function () {

                                // Certifique-se de que a biblioteca 'sap/ui/export/Spreadsheet' foi importada no sap.ui.define
                                const oSpreadsheet = new Spreadsheet({
                                    workbook: {
                                        columns: [
                                            {
                                                label: "Status",
                                                property: "grupoAtual"
                                            },
                                            {
                                                label: "Equipamento",
                                                property: "identificador"
                                            },
                                            {
                                                label: "Descrição",
                                                property: "descEquipamento"
                                            },
                                            {
                                                label: "Local Instalação",
                                                property: "localInstalacao"
                                            }
                                        ]
                                    },
                                    dataSource: aDados,
                                    fileName: "Detalhes_" +
                                        sCategoria.replace(/[\\/:*?\"<>|]/g, "_") +
                                        ".xlsx"
                                });

                                oSpreadsheet.build()
                                    .finally(function () {
                                        oSpreadsheet.destroy();
                                    });

                            }.bind(this) // Adicionado bind para manter o contexto do controller
                        }).addStyleClass("botaoDialogExcel"),

                        new sap.m.Button({
                            text: "OK",
                            press: function () {
                                this._oDialogDetalhesCategoria.close();
                            }.bind(this)
                        }).addStyleClass("botaoDialogCinza")

                    ],

                    afterClose: function () {

                        this._oDialogDetalhesCategoria.destroy();
                        this._oDialogDetalhesCategoria = null;

                    }.bind(this)

                });

                // Vincula o Dialog ao ciclo de vida da View (Essencial para o evento 'press' da tabela funcionar)
                this.getView().addDependent(this._oDialogDetalhesCategoria);

                this._oDialogDetalhesCategoria.addStyleClass("sapUiContentPadding");
                this._oDialogDetalhesCategoria.addStyleClass("dialogRastreadores");
                this._oDialogDetalhesCategoria.open();

            },

            onCardEmbarcadosPress: function () {

                const aVeiculos =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/dashboardVeiculos") || [];

                const oAgrupados = {};

                aVeiculos.forEach(veiculo => {

                    const sLocal =
                        (veiculo.LOCAL_INSTALACAO || "")
                            .toUpperCase();

                    let sLocalidade = "OUTROS";

                    if (sLocal.startsWith("FEIT")) {
                        sLocalidade = "ITABIRA";
                    } else if (sLocal.startsWith("FEMN")) {
                        sLocalidade = "MARIANA";
                    } else if (sLocal.startsWith("FEBR")) {
                        sLocalidade = "BRUCUTU";
                    } else if (sLocal.startsWith("PPIC")) {
                        sLocalidade = "PICO";
                    } else if (sLocal.includes("_EMREF_EXT")) {
                        sLocalidade = "SOTREQ";
                    }

                    if (!oAgrupados[sLocalidade]) {
                        oAgrupados[sLocalidade] = [];
                    }

                    oAgrupados[sLocalidade].push(
                        veiculo.veiculo
                    );

                });

                const oList = new sap.m.List();

                Object.keys(oAgrupados)
                    .sort()
                    .forEach(sLocalidade => {

                        oList.addItem(
                            new sap.m.GroupHeaderListItem({
                                title:
                                    sLocalidade +
                                    " (" +
                                    oAgrupados[sLocalidade].length +
                                    ")"
                            })
                        );

                        oAgrupados[sLocalidade]
                            .sort()
                            .forEach(sVeiculo => {

                                oList.addItem(
                                    new sap.m.StandardListItem({
                                        title: sVeiculo,
                                        icon: "sap-icon://shipping-status",
                                        type: "Navigation",

                                        press: () => {

                                            if (this._oDialogEmbarcados) {
                                                this._oDialogEmbarcados.close();
                                            }

                                            this.onPesquisarRastreador({
                                                getParameter: function (sName) {
                                                    return sName === "query"
                                                        ? sVeiculo
                                                        : "";
                                                }
                                            });

                                        }
                                    })
                                );

                            });

                    });

                this._oDialogEmbarcados =
                    new sap.m.Dialog({
                        customHeader: new sap.m.Bar({
                            contentLeft: [
                                new sap.m.Title({
                                    text: "Veículos Embarcados"
                                })
                            ],
                            contentRight: [
                                new sap.m.Button({
                                    icon: "sap-icon://decline",
                                    type: "Transparent",
                                    press: function () {
                                        this._oDialogEmbarcados.close();
                                    }.bind(this)
                                }).addStyleClass("btnFecharPopup")
                            ]
                        }),



                        contentWidth: "auto",

                        contentHeight: "auto",

                        content: [oList],

                        buttons: [

                            new sap.m.Button({
                                text: "EXCEL",
                                press: function () {

                                    const aExportacao = [];

                                    Object.keys(oAgrupados).forEach(function (sLocalidade) {

                                        oAgrupados[sLocalidade].forEach(function (sVeiculo) {

                                            aExportacao.push({
                                                localidade: sLocalidade,
                                                veiculo: sVeiculo
                                            });

                                        });

                                    });

                                    const oSpreadsheet = new Spreadsheet({
                                        workbook: {
                                            columns: [
                                                {
                                                    label: "Localidade",
                                                    property: "localidade"
                                                },
                                                {
                                                    label: "Veículo",
                                                    property: "veiculo"
                                                }
                                            ]
                                        },
                                        dataSource: aExportacao,
                                        fileName: "Veiculos_Embarcados.xlsx"
                                    });

                                    oSpreadsheet.build()
                                        .finally(function () {
                                            oSpreadsheet.destroy();
                                        });

                                }
                            }).addStyleClass("botaoDialogExcel"),

                            new sap.m.Button({
                                text: "OK",
                                press: function () {
                                    this._oDialogEmbarcados.close();
                                }.bind(this)
                            }).addStyleClass("botaoDialogCinza")

                        ],



                        afterClose: function () {

                            this._oDialogEmbarcados.destroy();
                            this._oDialogEmbarcados = null;

                        }.bind(this)

                    });
                this._oDialogEmbarcados.addStyleClass("sapUiContentPadding");
                this._oDialogEmbarcados.addStyleClass("dialogRastreadores");

                this._oDialogEmbarcados.open();

            },
            criarPinLocal(nome, lat, lng) {

                return L.marker(
                    [lat, lng],
                    {
                        icon: L.icon({
                            iconUrl: "img/pin-google.png",
                            iconSize: [32, 32],
                            iconAnchor: [16, 32],
                            popupAnchor: [0, -32]
                        })
                    }
                ).bindTooltip(nome, {
                    permanent: true,
                    direction: "right",
                    offset: [10, 0],
                    className: "operacaoValeLabel"
                });

            },
            determinarGrupo(item) {

                let grupo =
                    item.grupoAtual ||
                    "Sem Localização";

                const descLocal =
                    (item.descLocalInstalacao || "")
                        .toUpperCase();

                if (descLocal.includes(" A REF")) {

                    grupo = "A reformar";

                } else if (descLocal.includes("REFORMADO")) {

                    grupo = "Reformado";

                } else if (descLocal.includes("EXT")) {

                    grupo = "Ref. externa";

                } else if (
                    (
                        descLocal.includes("EMREF") ||
                        descLocal.includes("REFORMA")
                    ) &&
                    !descLocal.includes("EXT")
                ) {

                    grupo = "Ref. interna";

                }

                return grupo;

            },

            onPesquisarRastreador(oEvent) {

                const termo =
                    oEvent.getParameter("query")
                        .trim();

                if (!termo) {
                    return;
                }
                const oEquipamento =
                    this._dadosFiltrados.find(
                        item =>
                            String(item.identificador || "")
                                .trim() === termo
                    );

                if (
                    oEquipamento &&
                    oEquipamento.grupoAtual &&
                    oEquipamento.grupoAtual.startsWith(
                        "Instalado no "
                    )
                ) {

                    const sVeiculo =
                        oEquipamento.grupoAtual.replace(
                            "Instalado no ",
                            ""
                        );

                    const oVeiculoMarker =
                        this._veiculoMarkers?.[
                        sVeiculo
                        ];

                    if (oVeiculoMarker) {

                        this._map.setView(
                            oVeiculoMarker.getLatLng(),
                            13
                        );

                        oVeiculoMarker.openPopup();

                        this.piscarEquipamento(
                            oVeiculoMarker
                        );

                        return;

                    }

                }
                let marker =
                    this._equipamentoMarkers?.[
                    termo
                    ];



                if (!marker) {

                    const oVeiculo =
                        this.getView()
                            .getModel("dashboard")
                            .getProperty("/dashboardVeiculos")
                            ?.find(v =>
                                (v.veiculo || "")
                                    .toUpperCase() === termo
                            );

                    if (oVeiculo && this._map) {

                        const oMarkerVeiculo =
                            this._veiculoMarkers?.[
                            oVeiculo.veiculo
                            ];

                        if (oMarkerVeiculo) {

                            this._map.setView(
                                oMarkerVeiculo.getLatLng(),
                                13
                            );

                            oMarkerVeiculo.openPopup();

                            this.piscarEquipamento(
                                oMarkerVeiculo
                            );
                        }

                        return;
                    }

                }

                if (!marker) {

                    sap.m.MessageToast.show(
                        "Possível inconsistência. Provável necessidade de movimentação do componente no SAP."
                    );

                    return;
                }

                this._map.setView(
                    marker.getLatLng(),
                    13
                );

                marker.openPopup();

                this.piscarEquipamento(marker);


            },
            onCardGatewaysPress() {

                let html = `
                            < div
                        style = "
                        max - height: 650px;
                        overflow - y: auto;
                        font - size: 12px;
                        "
                            >
                            `;

                Object.entries(this._gatewayInfo || {})
                    .forEach(([gatewayId, gateway]) => {

                        html += `
                            < div
                        class="linhaRastreadorPopup"
                        data - gateway="${gatewayId}"
                        style = "
                        padding: 8px;
                        border - bottom: 1px solid #e5e7eb;
                        margin - bottom: 4px;
                        border - radius: 8px;
                        cursor: pointer;
                        transition:all .15s ease;
                        "
                            >

                    <div>
                        <b>${gateway.identificador || gatewayId}</b>
                    </div>

                    <div>
                        Gateway ID: ${gatewayId}
                    </div>

                    <div style="
                        color:#2563eb;
                        font-weight:bold;
                    ">
                        ${gateway.localidade || ""}
                    </div>

                    <div style="
                        color:#64748b;
                        font-size:12px;
                    ">
                        ${gateway.condicao || ""}
                    </div>

                </div >
                            `;

                    });

                html += "</div>";

                const oDialog = new sap.m.Dialog({

                    title: `Gateways(${Object.keys(this._gatewayInfo || {}).length})`,

                    contentWidth: "900px",
                    contentHeight: "700px",

                    content: new sap.ui.core.HTML({
                        content: html
                    }),

                    beginButton: new sap.m.Button({
                        text: "Fechar",
                        press: function () {
                            oDialog.close();
                            oDialog.destroy();
                        }
                    })

                });

                oDialog.attachAfterOpen(() => {

                    document
                        .querySelectorAll(".linhaRastreadorPopup")
                        .forEach(el => {

                            el.onclick = () => {

                                const gatewayId =
                                    el.dataset.gateway;

                                const marker =
                                    this._gatewayMarkers?.[gatewayId];

                                if (!marker) {
                                    return;
                                }

                                oDialog.close();
                                oDialog.destroy();

                                this._map.setView(
                                    marker.getLatLng(),
                                    13
                                );

                                marker.openPopup();

                                this.piscarGateway(marker);

                            };

                        });

                });

                oDialog.open();

            },
            onCardDisponibilidadePress() {

                this.onButtonAjudaDisponibilidadeMonitoramentoPress();

            },

            onCardConsistenciaPress() {

                this.onButtonAjudaConsistenciaMovimentacaoPress();

            },

            onCardEfetividadePress() {
                this.onButtonAjudaIndiceEfetividadePress();
            },




            onCardVeiculoPress(sVeiculo) {

                const oEquipamento =
                    this._dadosFiltrados.find(
                        item =>
                            item.grupoAtual ===
                            `Instalado no ${sVeiculo} `
                    );

                if (!oEquipamento) {

                    sap.m.MessageToast.show(
                        "Nenhum equipamento encontrado para " +
                        sVeiculo
                    );

                    return;
                }

                const marker =
                    this._equipamentoMarkers?.[
                    oEquipamento.identificador
                    ];

                if (!marker) {

                    sap.m.MessageToast.show(
                        "Marcador não encontrado para " +
                        sVeiculo
                    );

                    return;
                }

                this._map.setView(
                    marker.getLatLng(),
                    13
                );

                marker.openPopup();

                this.piscarEquipamento(marker);

            },
            piscarEquipamento(marker) {

                const elemento = marker.getElement();

                if (!elemento) {
                    return;
                }

                let contador = 0;

                const intervalo = setInterval(() => {

                    elemento.style.opacity =
                        elemento.style.opacity === "0.1"
                            ? "1"
                            : "0.1";

                    contador++;

                    if (contador >= 12) {

                        clearInterval(intervalo);

                        elemento.style.opacity = "1";

                    }

                }, 250);

            },
            normalizarGrupo(texto) {

                texto = (texto || "").toUpperCase();

                if (texto.startsWith("CONVERSOR")) {
                    return "CONVERSOR";
                }

                if (texto.startsWith("MOTOR")) {
                    return "MOTOR";
                }

                if (texto.startsWith("COMANDO FINAL")) {
                    return "COMANDO";
                }

                if (texto.startsWith("TRANSMISSAO")) {
                    return "TRANSMISSAO";
                }

                if (texto.startsWith("DIFERENCIAL")) {
                    return "DIFERENCIAL";
                }

                return texto;
            },
            onExportarExcel() {

                const dados = (this._dadosFiltrados || []).map(item => ({

                    identificador:
                        item.identificador || "",

                    descEquipamento:
                        item.descEquipamento || "",

                    grupoAtual:
                        item.grupoAtual || "",

                    localInstalacao:
                        item.localInstalacao || "",

                    descLocalInstalacao:
                        item.descLocalInstalacao || "",

                    gateway:
                        item.gateway || "",

                    ultimaPosicao:
                        item.ultimaPosicao || "",

                    latitude:
                        item.latitude || "",

                    longitude:
                        item.longitude || ""

                }));

                const oSpreadsheet = new Spreadsheet({

                    workbook: {

                        columns: [

                            {
                                label: "Identificador",
                                property: "identificador"
                            },

                            {
                                label: "Descrição Equipamento",
                                property: "descEquipamento"
                            },

                            {
                                label: "Grupo Atual",
                                property: "grupoAtual"
                            },

                            {
                                label: "Local Instalação",
                                property: "localInstalacao"
                            },

                            {
                                label: "Descrição Local",
                                property: "descLocalInstalacao"
                            },

                            {
                                label: "Gateway",
                                property: "gateway"
                            },

                            {
                                label: "Última Atualização",
                                property: "ultimaPosicao"
                            },

                            {
                                label: "Latitude",
                                property: "latitude"
                            },

                            {
                                label: "Longitude",
                                property: "longitude"
                            }

                        ]

                    },

                    dataSource: dados,

                    fileName: "Rastreamento_RFID.xlsx"

                });

                oSpreadsheet.build()
                    .then(() => {
                        oSpreadsheet.destroy();
                    });

            },
            onExportarResumoGrupoAtual() {

                fetch("http://10.44.32.193:4000/StatusComponentes")
                    .then(response => response.json())
                    .then(dados => {

                        const dadosFiltrados = dados.filter(item => {

                            const id =
                                String(item.equipamento || "")
                                    .trim();

                            if (
                                (item.status || "")
                                    .trim()
                                    .toUpperCase() === "NÃO DEFINIDO"
                            ) {
                                return false;
                            }

                            if (
                                id === "11039948" ||
                                id === "11108739"
                            ) {
                                return false;
                            }

                            return true;

                        });

                        const oSpreadsheet = new Spreadsheet({

                            workbook: {

                                columns: [

                                    {
                                        label: "Status",
                                        property: "status"
                                    },

                                    {
                                        label: "Equipamento",
                                        property: "equipamento"
                                    },

                                    {
                                        label: "Descrição",
                                        property: "descricao"
                                    },

                                    {
                                        label: "Local de Instalação",
                                        property: "localInstalacao"
                                    }

                                ]

                            },

                            dataSource: dadosFiltrados,

                            fileName: "Status_Componentes.xlsx"

                        });

                        oSpreadsheet.build()
                            .then(() => {
                                oSpreadsheet.destroy();
                            });

                    })
                    .catch(() => {

                        MessageBox.error(
                            "Erro ao gerar detalhamento."
                        );

                    });

            },
            onQuantidadeObjectListItemPress(oEvent) {

                const grupo =
                    oEvent.getSource()
                        .getBindingContext("dashboard")
                        .getObject()
                        .grupo;

                const bounds = [];

                this._dadosFiltrados.forEach(item => {

                    let localizacao =
                        this.determinarGrupo(item);

                    if (localizacao.startsWith("Instalado no ")) {
                        localizacao = "Instalados";
                    }

                    if (localizacao === grupo) {

                        const lat = parseFloat(item.latitude);
                        const lng = parseFloat(item.longitude);

                        if (!isNaN(lat) && !isNaN(lng)) {
                            bounds.push([lat, lng]);
                        }

                    }

                });

                if (bounds.length > 0 && this._map) {

                    this._grupoSelecionado = grupo;

                    this._map.fitBounds(bounds, {
                        padding: [50, 50]
                    });

                }

            },
            gerarResumoEquipamentos(dados) {

                const resumo = {};

                dados.forEach(item => {

                    const desc =
                        (item.descEquipamento || "")
                            .toUpperCase();

                    let familia = "OUTROS";

                    if (desc.startsWith("COMANDO FINAL")) {
                        familia = "COMANDO FINAL";
                    } else if (desc.startsWith("TRANSMISSAO")) {
                        familia = "TRANSMISSAO";
                    } else if (desc.startsWith("CONVERSOR TORQUE")) {
                        familia = "CONVERSOR TORQUE";
                    } else if (desc.startsWith("DIFERENCIAL")) {
                        familia = "DIFERENCIAL";
                    } else if (desc.startsWith("MOTOR COMBUSTAO")) {
                        familia = "MOTOR COMBUSTAO";
                    }

                    if (!resumo[familia]) {

                        resumo[familia] = {
                            familia,
                            total: 0,
                            instalados: 0,
                            reformaInterna: 0,
                            reformaExterna: 0,
                            reformados: 0,
                            aReformar: 0
                        };

                    }

                    resumo[familia].total++;

                    const grupo =
                        this.determinarGrupo(item);

                    if (
                        item.grupoAtual &&
                        item.grupoAtual.startsWith("Instalado no ")
                    ) {

                        resumo[familia].instalados++;

                    } else if (grupo === "Ref. interna") {

                        resumo[familia].reformaInterna++;

                    } else if (grupo === "Ref. externa") {

                        resumo[familia].reformaExterna++;

                    } else if (grupo === "Reformado") {

                        resumo[familia].reformados++;

                    } else if (grupo === "A reformar") {

                        resumo[familia].aReformar++;

                    }

                });

                const resultado = Object.values(resumo)
                    .sort((a, b) =>
                        a.familia.localeCompare(
                            b.familia,
                            "pt-BR"
                        )
                    );

                resultado.push({

                    familia: "TOTAL",

                    total: resultado.reduce(
                        (s, x) => s + x.total, 0
                    ),

                    instalados: resultado.reduce(
                        (s, x) => s + x.instalados, 0
                    ),

                    reformaInterna: resultado.reduce(
                        (s, x) => s + x.reformaInterna, 0
                    ),

                    reformaExterna: resultado.reduce(
                        (s, x) => s + x.reformaExterna, 0
                    ),

                    reformados: resultado.reduce(
                        (s, x) => s + x.reformados, 0
                    ),

                    aReformar: resultado.reduce(
                        (s, x) => s + x.aReformar, 0
                    )

                });
                const totalGeral = resultado.reduce(
                    (s, x) => s + x.total,
                    0
                );

                resultado.forEach(item => {

                    item.percentual =
                        totalGeral > 0
                            ? (
                                (item.total / totalGeral) * 100
                            ).toFixed(1) + "%"
                            : "0%";

                });
                return resultado;

            },
            gerarResumoTipoStatus(dados) {

                const resumo = {};

                dados.forEach(item => {

                    const tipo =
                        item.tipo || "OUTROS";

                    if (!resumo[tipo]) {

                        resumo[tipo] = {

                            tipo,

                            instalado: 0,

                            reformaInterna: 0,

                            reformaExterna: 0,

                            reformado: 0,

                            aReformar: 0

                        };

                    }

                    const status =
                        (item.status || "").toUpperCase();

                    if (status.includes("INSTALADO")) {

                        resumo[tipo].instalado++;

                    } else if (
                        status.includes("REFORMA INTERNA")
                    ) {

                        resumo[tipo].reformaInterna++;

                    } else if (
                        status.includes("REFORMA EXTERNA")
                    ) {

                        resumo[tipo].reformaExterna++;

                    } else if (
                        status.includes("REFORMADO")
                    ) {

                        resumo[tipo].reformado++;

                    } else if (
                        status.includes("A REFORMAR")
                    ) {

                        resumo[tipo].aReformar++;

                    }

                });

                return Object.values(resumo);

            },

            onTabSelecionada(oEvent) {

                const oItem =
                    oEvent.getParameter("item");

                if (
                    oItem &&
                    oItem.getKey() === "atualizacaoManual"
                ) {

                    sap.m.MessageBox.confirm(

                        "Deseja iniciar a atualização manual das localizações?",

                        {

                            title: "Confirmação",

                            actions: [
                                sap.m.MessageBox.Action.OK,
                                sap.m.MessageBox.Action.CANCEL
                            ],

                            onClose: async (sAction) => {

                                if (
                                    sAction !==
                                    sap.m.MessageBox.Action.OK
                                ) {
                                    return;
                                }

                                const oBusyDialog =
                                    new BusyDialog({

                                        title: "Atualização Manual",

                                        text:
                                            "Atualizando dados, aguarde..."

                                    });

                                oBusyDialog.open();

                                try {

                                    const response =
                                        await fetch(
                                            "http://10.44.32.193:4000/LocalizacaoAtual/processar"
                                        );

                                    if (!response.ok) {

                                        throw new Error(
                                            `Erro ${response.status} `
                                        );

                                    }

                                    sap.m.MessageToast.show(
                                        "Atualização concluída."
                                    );

                                    await this.carregarDashboard();

                                } catch (e) {

                                    sap.m.MessageBox.error(
                                        e.message ||
                                        "Erro ao processar atualização."
                                    );

                                } finally {

                                    oBusyDialog.close();

                                }

                            }

                        }

                    );

                    return;

                }

                if (
                    oItem &&
                    oItem.getKey() === "geo"
                ) {

                    this._busyDialog.open();

                    setTimeout(() => {

                        if (this._map) {

                            this._map.remove();
                            this._map = null;

                        }

                        this.carregarDashboard();

                    }, 500);

                }

            },



            gerarResumoFrotas(dados) {

                const resumo = {};

                dados.forEach(item => {

                    if (!item.fornecedor || !item.fornecedor.trim()) {
                        return;
                    }

                    const chave =
                        `${item.fornecedor}| ${item.frota} `;

                    if (!resumo[chave]) {

                        resumo[chave] = {

                            fornecedor: item.fornecedor,

                            frota: item.frota,

                            imagem: "img/componente_peq.png",

                            comandoFinal: 0,

                            transmissao: 0,

                            conversorTorque: 0,

                            diferencial: 0,

                            motor: 0,

                            total: 0

                        };

                    }

                    resumo[chave].total++;

                    switch (item.tipo) {

                        case "COMANDO FINAL":
                            resumo[chave].comandoFinal++;
                            break;

                        case "TRANSMISSAO":
                            resumo[chave].transmissao++;
                            break;

                        case "CONVERSOR DE TORQUE":
                            resumo[chave].conversorTorque++;
                            break;

                        case "DIFERENCIAL":
                            resumo[chave].diferencial++;
                            break;

                        case "MOTOR":
                            resumo[chave].motor++;
                            break;

                    }

                });
                const resultado = Object.values(resumo)
                    .sort((a, b) =>
                        a.frota.localeCompare(b.frota)
                    );

                resultado.push({

                    imagem: "",

                    fornecedor: "TOTAL",

                    frota: "",

                    comandoFinal: resultado.reduce(
                        (s, x) => s + x.comandoFinal,
                        0
                    ),

                    transmissao: resultado.reduce(
                        (s, x) => s + x.transmissao,
                        0
                    ),

                    conversorTorque: resultado.reduce(
                        (s, x) => s + x.conversorTorque,
                        0
                    ),

                    diferencial: resultado.reduce(
                        (s, x) => s + x.diferencial,
                        0
                    ),

                    motor: resultado.reduce(
                        (s, x) => s + x.motor,
                        0
                    ),

                    total: resultado.reduce(
                        (s, x) => s + x.total,
                        0
                    )

                });

                return resultado;
                return Object.values(resumo)
                    .sort((a, b) =>
                        a.frota.localeCompare(b.frota)
                    );

            },
            gerarResumoGrupoAtual(dados) {

                const grupos = {};

                dados.forEach(item => {

                    let grupo =
                        this.determinarGrupo(item);

                    if (
                        grupo &&
                        grupo.startsWith("Instalado no ")
                    ) {
                        grupo = "Instalados";
                    }

                    if (
                        grupo ===
                        "Tags Digitais desatualizadas"
                    ) {
                        grupo = "Fora de zona";
                    }

                    grupos[grupo] =
                        (grupos[grupo] || 0) + 1;

                });

                const resultado = [];

                Object.keys(grupos).forEach(grupo => {

                    resultado.push({

                        grupo,

                        quantidade: grupos[grupo]

                    });

                });

                resultado.sort((a, b) =>
                    (a.grupo || "").localeCompare(
                        b.grupo || "",
                        "pt-BR",
                        { sensitivity: "base" }
                    )
                );

                return resultado;

            },
            gerarAnaliseInstaladosDesatualizados(dados) {

                const agora = new Date();
                const limiteOnline = new Date(
                    agora.getTime() - (7 * 24 * 60 * 60 * 1000)
                );
                const resultado = [];

                dados.forEach(item => {

                    if (
                        !item.grupoAtual ||
                        !item.grupoAtual.startsWith("Instalado no ")
                    ) {
                        return;
                    }

                    if (!item.ultimaPosicao) {
                        return;
                    }

                    const dataPosicao =
                        this.converterDataBr(
                            item.ultimaPosicao
                        );


                    if (dataPosicao >= limiteOnline) {
                        return;
                    }

                    const veiculo =
                        item.grupoAtual.replace(
                            "Instalado no ",
                            ""
                        );

                    const equipamentosMesmoVeiculo =
                        dados.filter(x =>
                            x.grupoAtual ===
                            `Instalado no ${veiculo} `
                        );

                    let dataMaisRecente = null;

                    let equipamentoMaisRecente = "";

                    let gatewayMaisRecente = "";

                    equipamentosMesmoVeiculo.forEach(eq => {

                        if (!eq.ultimaPosicao) {
                            return;
                        }

                        const data =
                            this.converterDataBr(
                                eq.ultimaPosicao
                            );

                        if (
                            !dataMaisRecente ||
                            data > dataMaisRecente
                        ) {

                            dataMaisRecente = data;

                            equipamentoMaisRecente =
                                eq.descEquipamento || "";

                            gatewayMaisRecente =
                                eq.gateway || "";

                        }

                    });

                    const gapDias =
                        dataMaisRecente
                            ? Math.floor(
                                (dataMaisRecente - dataPosicao) /
                                (1000 * 60 * 60 * 24)
                            )
                            : 0;
                    const diasSemAtualizacao =
                        Math.floor(
                            (agora - dataPosicao) /
                            (1000 * 60 * 60 * 24)
                        );

                    const existeAtualizacaoVeiculo =
                        dataMaisRecente !== null;

                    let conclusao = "";

                    if (!existeAtualizacaoVeiculo) {

                        conclusao =
                            "Sem evidência suficiente";

                    } else if (gapDias <= 2) {

                        conclusao =
                            "Baixa criticidade";

                    } else if (gapDias <= 7) {

                        conclusao =
                            "Possível falha individual";

                    } else {

                        conclusao =
                            "Forte evidência de falha individual";

                    }
                    let motivoConclusao = "";

                    if (!existeAtualizacaoVeiculo) {

                        motivoConclusao =
                            "Não foi encontrada atualização de outro rastreador do mesmo veículo que permitisse comparação.";

                    } else {

                        motivoConclusao =
                            `O equipamento analisado apresentou sua última atualização em ${item.ultimaPosicao}. `
                            + `No mesmo veículo(${veiculo}), a atualização mais recente identificada ocorreu em `
                            + `${dataMaisRecente.toLocaleString("pt-BR")} `
                            + `através do equipamento "${equipamentoMaisRecente}". `
                            + `Foi identificado um GAP de ${gapDias} dia(s) entre os registros, `
                            + `diferença utilizada como base para a classificação "${conclusao}".`;

                    }
                    const racional =
                        diasSemAtualizacao > 3
                            ? motivoConclusao
                            : "";
                    resultado.push({

                        veiculo,

                        identificador:
                            item.identificador,

                        equipamento:
                            item.descEquipamento,

                        gateway:
                            item.gateway,

                        ultimaAtualizacao:
                            item.ultimaPosicao,

                        diasSemAtualizacao,

                        quantidadeEquipamentosVeiculo:
                            equipamentosMesmoVeiculo.length,

                        ultimaAtualizacaoVeiculo:
                            dataMaisRecente
                                ? dataMaisRecente.toLocaleString("pt-BR")
                                : "",

                        equipamentoMaisRecente,

                        gatewayMaisRecente,

                        gapDias:
                            diasSemAtualizacao > 3
                                ? gapDias
                                : "",

                        existeAtualizacaoVeiculo:
                            existeAtualizacaoVeiculo
                                ? "Sim"
                                : "Não",

                        conclusao,

                        motivoConclusao: racional

                    });

                });

                resultado.sort(
                    (a, b) => b.gapDias - a.gapDias
                );

                return resultado;
            },
            gerarDetalhesTagsDesatualizadas(dados) {

                const agora = new Date();

                const limiteOnline = new Date(
                    agora.getTime() - (7 * 24 * 60 * 60 * 1000)
                );

                const resultado = [];

                dados.forEach(item => {

                    if (
                        item.grupoAtual &&
                        item.grupoAtual.startsWith("Instalado no ")
                    ) {
                        return;
                    }

                    if (!item.ultimaPosicao) {
                        return;
                    }

                    const dataPosicao =
                        this.converterDataBr(
                            item.ultimaPosicao
                        );

                    if (dataPosicao < limiteOnline) {

                        const dias =
                            Math.floor(
                                (agora - dataPosicao) /
                                (1000 * 60 * 60 * 24)
                            );

                        const grupoAtual =
                            this.determinarGrupo(item);

                        const local =
                            (item.localInstalacao || "")
                                .toUpperCase();

                        let deducao = "";

                        if (local.includes("_EMREF_EXT")) {

                            deducao =
                                "Equipamento vinculado à reforma externa em Vespasiano. A ausência de comunicação pode ser compatível com a localização operacional registrada.";

                        } else if (local.startsWith("FEBR")) {

                            deducao =
                                "Equipamento vinculado à Mina de Brucutu. A ausência de comunicação pode ser explicada pela indisponibilidade de cobertura da infraestrutura RFID de Itabira.";

                        } else if (local.startsWith("PPIC")) {

                            deducao =
                                "Equipamento vinculado à Mina do Pico. A ausência de comunicação pode ser compatível com a localização operacional registrada.";

                        } else if (!local.includes("FEIT")) {

                            deducao =
                                "Equipamento localizado fora das áreas atendidas pela infraestrutura RFID de Itabira. A ausência de comunicação pode ser compatível com a localização registrada.";

                        } else {

                            deducao =
                                "A última comunicação ocorreu em área com potencial cobertura dos gateways de Itabira. A ausência de novas comunicações pode indicar falha do rastreador, perda de alimentação ou movimentação não registrada.";

                        }

                        resultado.push({

                            identificador:
                                item.identificador,

                            equipamento:
                                item.descEquipamento,

                            localInstalacao:
                                item.localInstalacao,

                            grupoAtual:
                                grupoAtual,

                            ultimaPosicao:
                                item.ultimaPosicao,

                            diasSemAtualizacao:
                                dias,

                            ultimoLocalConhecido:
                                `${item.localInstalacao || "Sem local"} `
                                + (item.gateway
                                    ? ` | Gateway: ${item.gateway} `
                                    : ""),

                            deducao:
                                deducao

                        });

                    }

                });

                resultado.sort((a, b) =>
                    a.grupoAtual.localeCompare(
                        b.grupoAtual,
                        "pt-BR",
                        { sensitivity: "base" }
                    )
                );

                return resultado;

            },


            gerarResumoVeiculo(veiculoId, dados) {

                const resumo = {};

                dados.forEach(item => {

                    if (
                        item.grupoAtual !==
                        `Instalado no ${veiculoId} `
                    ) {
                        return;
                    }

                    const desc =
                        (item.descEquipamento || "")
                            .toUpperCase();

                    let familia = "OUTROS";

                    if (desc.startsWith("COMANDO FINAL")) {
                        familia = "COMANDO FINAL";
                    } else if (desc.startsWith("TRANSMISSAO")) {
                        familia = "TRANSMISSAO";
                    } else if (desc.startsWith("CONVERSOR TORQUE")) {
                        familia = "CONVERSOR TORQUE";
                    } else if (desc.startsWith("DIFERENCIAL")) {
                        familia = "DIFERENCIAL";
                    } else if (desc.startsWith("MOTOR COMBUSTAO")) {
                        familia = "MOTOR COMBUSTAO";
                    }

                    resumo[familia] =
                        (resumo[familia] || 0) + 1;

                });

                return resumo;

            },
            centralizarPopup(marker) {

                const posicao = marker.getLatLng();

                const pontoTela =
                    this._map.latLngToContainerPoint(
                        posicao
                    );

                const novoPontoTela = L.point(
                    pontoTela.x,
                    pontoTela.y - 180
                );

                const novoCentro =
                    this._map.containerPointToLatLng(
                        novoPontoTela
                    );

                this._map.panTo(
                    novoCentro,
                    {
                        animate: true
                    }
                );

            },
            criarMarcadorMina(
                texto,
                lat,
                lng
            ) {

                return L.marker(
                    [lat, lng],
                    {
                        icon: L.divIcon({
                            className: "",
                            html: `
        < div style = "
    display: flex;
    align - items: center;
    white - space: nowrap;
    ">

        < div style = "
    width: 18px;
    height: 18px;
    background:#95a5a6;
    border - radius: 50 %;
    border: 3px solid white;
    box - shadow: 0 0 6px rgba(0, 0, 0, .5);
    ">
                                </div >

        <span style="
                                    margin-left:6px;
                                    color:white;
                                    font-weight:bold;
                                    font-size:12px;
                                    text-shadow:
                                        2px 2px 4px black;
                                ">
            ${texto}
        </span>

                            </div >
        `,
                            iconSize: [220, 24],
                            iconAnchor: [9, 9]
                        })
                    }
                );

            },
            criarLabel(
                texto,
                lat,
                lng,
                classe
            ) {

                return L.marker(
                    [lat, lng],
                    {
                        opacity: 0
                    }
                ).bindTooltip(
                    texto,
                    {
                        permanent: true,
                        direction: "center",
                        className: classe
                    }
                );

            },
            atualizarLabels() {

                if (!this._layerLabels) {
                    return;
                }

                this._layerLabels.clearLayers();

                const zoom = this._map.getZoom();

                // Cidade
                // Cidade
                if (zoom <= 13) {

                    this.criarLabel(
                        "ITABIRA",
                        -19.605478,
                        -43.239840,
                        "cityLabel"
                    ).addTo(this._layerLabels);

                    this.criarLabel(
                        "JOÃO MONLEVADE",
                        -19.812300,
                        -43.173500,
                        "cityLabel"
                    ).addTo(this._layerLabels);

                    this.criarLabel(
                        "SOTREQ",
                        -19.708891,
                        -43.908532,
                        "cityLabel"
                    ).addTo(this._layerLabels);

                    this.criarLabel(
                        "ITABIRITO",
                        -20.209063,
                        -43.862584,
                        "cityLabel"
                    ).addTo(this._layerLabels);


                    this.criarLabel(
                        "MARIANA",
                        -20.376120,
                        -43.416479,
                        "cityLabel"
                    ).addTo(this._layerLabels);

                }


                if (zoom >= 14) {

                    [
                        ["CENTRO", -19.624, -43.226],
                        ["PARÁ", -19.620, -43.233],
                        ["BELA VISTA", -19.618, -43.212],
                        ["NOVA VISTA", -19.620, -43.202],
                        ["SÃO PEDRO", -19.624, -43.218],
                        ["JUCA ROSA", -19.635, -43.213],
                        ["COLINA DA PRAIA", -19.645, -43.205],
                        ["PEDREIRA", -19.642, -43.245],
                        ["MACHADO", -19.665, -43.240],
                        ["JOÃO XXIII", -19.678, -43.233],
                        ["VILA BETHÂNIA", -19.678, -43.218],
                        ["GABIROBA", -19.683, -43.185],
                        ["FÊNIX", -19.695, -43.242],
                        ["VALE DO SOL", -19.655, -43.165]
                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "bairroLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                if (zoom >= 14) {

                    [
                        ["CENTRO", -19.6918, -43.9230],
                        ["CAIEIRAS", -19.7005, -43.9278],
                        ["SANTA CLARA", -19.7115, -43.9180],
                        ["MORRO ALTO", -19.7350, -43.9070],
                        ["NOVA PAMPULHA", -19.6985, -43.9058],
                        ["CELEVIA", -19.7210, -43.9310],
                        ["PARQUE JARDIM ALTEROSA", -19.7200, -43.8960],
                        ["SERRA DOURADA", -19.7420, -43.9190],
                        ["PARQUE JARDIM ITAÚ", -19.7310, -43.8990]
                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "bairroLabel"
                            ).addTo(this._layerLabels);

                        });

                }


                if (zoom >= 13) {

                    this.criarLabel(
                        "SÃO GONÇALO",
                        -19.8220,
                        -43.3660,
                        "cityLabel"
                    ).addTo(this._layerLabels);

                }
                if (zoom >= 14) {

                    [
                        ["ROSÁRIO", -20.3875, -43.4130],
                        ["SANTO ANTÔNIO", -20.3815, -43.4230],
                        ["BARRO PRETO", -20.3780, -43.4060],
                        ["CABEÇAS", -20.3720, -43.4120],
                        ["CHÁCARA", -20.3710, -43.4250],
                        ["COLINA", -20.3680, -43.4190],
                        ["PASSAGEM DE MARIANA", -20.3770, -43.4580],
                        ["BANDEIRANTES", -20.3920, -43.4210],
                        ["SÃO PEDRO", -20.3850, -43.4320],
                        ["SANTANA", -20.3810, -43.4170],
                        ["MORRO SANTANA", -20.3890, -43.4140],
                        ["VILA MAQUINÉ", -20.3740, -43.4050]
                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "bairroLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                if (zoom >= 13) {

                    [

                        ["MINA CAUÊ", -19.599252, -43.218690],

                        ["MINA CONCEIÇÃO", -19.657580, -43.269398],

                        ["MINA PERIQUITO", -19.632715, -43.254261],


                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "operacaoValeLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                if (zoom >= 13) {

                    [
                        ["MINA DE BRUCUTU", -19.870131, -43.398402],
                        ["MINA DO PICO", -20.217185, -43.864846],
                        ["MINA DE ALEGRIA", -20.172795, -43.490555],
                        ["MINA FAZENDÃO", -20.145046, -43.419664]

                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "operacaoValeLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                // if (zoom >= 14 && zoom < 16) {

                //     [

                //         ["OFICINA CENTRAL", -19.601106, -43.214199],

                //         ["POSTO", -19.632648, -43.242334]
                //     ]
                //         .forEach(item => {

                //             this.criarLabel(
                //                 item[0],
                //                 item[1],
                //                 item[2],
                //                 "gatewayLabel"
                //             ).addTo(this._layerLabels);

                //         });

                // }
                if (zoom >= 14) {

                    [
                        ["SOTREQ", -19.707404, -43.900727]


                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "operacaoValeLabel"
                            ).addTo(this._layerLabels);

                        });

                }

                // if (zoom >= 16) {

                //     [

                //         ["ÁREA 23", -19.604498, -43.211828],

                //         ["ÁREA 27", -19.601748, -43.209649],

                //         ["OFICINA CENTRAL", -19.601106, -43.214199],

                //         ["PORTARIA PRINCIPAL", -19.604328, -43.216655],

                //         ["PORTARIA VALER", -19.604723, -43.214709],

                //         ["POSTO PERIQUITO", -19.632648, -43.242334]

                //     ]
                //         .forEach(item => {

                //             this.criarLabel(
                //                 item[0],
                //                 item[1],
                //                 item[2],
                //                 "gatewayLabel"
                //             ).addTo(this._layerLabels);

                //         });

                // }
                // if (zoom >= 17) {

                //     [


                //         ["OFICINA DE LUBRIFICAÇÃO", -19.601286, -43.215671],


                //     ]
                //         .forEach(item => {

                //             this.criarLabel(
                //                 item[0],
                //                 item[1],
                //                 item[2],
                //                 "gatewayLabel"
                //             ).addTo(this._layerLabels);

                //         });

                // }
            },
            gerarGraficoTipoStatus(dados) {

                const resumo = {};

                dados.forEach(item => {

                    let tipo =
                        (item.descEquipamento || "")
                            .toUpperCase()
                            .trim()
                            .split(" ")[0];

                    if (!tipo || tipo === "OUTROS") {
                        return;
                    }

                    let status =
                        this.determinarGrupo(item);

                    if (
                        status &&
                        status.startsWith("Instalado no ")
                    ) {
                        status = "Instalados";
                    }

                    if (status === "Ref. interna") {
                        status = "Ref. Int.";
                    }

                    if (status === "Ref. externa") {
                        status = "Ref. Ext.";
                    }

                    if (status === "Reformado") {
                        status = "Reformados";
                    }

                    if (status === "A reformar") {
                        status = "Reformar";
                    }

                    const chave = `${tipo}|${status}`;

                    resumo[chave] =
                        (resumo[chave] || 0) + 1;

                });

                return Object.keys(resumo).map(chave => {

                    const partes =
                        chave.split("|");

                    return {

                        tipo: partes[0],

                        status: partes[1],

                        quantidade: resumo[chave]

                    };

                });

            },
            async onExportarDetalhamento() {

                const oBusyDialog = new sap.m.BusyDialog({
                    title: "Exportando",
                    text: "Gerando detalhamento..."
                });

                oBusyDialog.open();

                try {

                    const response = await fetch(
                        "http://10.44.32.193:4000/ConferenciaComponentesDetalhado/listar"
                    );

                    if (!response.ok) {

                        sap.m.MessageBox.error(
                            `Erro ${response.status} `
                        );

                        return;
                    }

                    const dados = await response.json();

                    const oSpreadsheet = new Spreadsheet({

                        workbook: {

                            columns: [

                                {
                                    label: "Tag Veículo",
                                    property: "tagVeiculo"
                                },

                                {
                                    label: "Tipo",
                                    property: "tipo"
                                },

                                {
                                    label: "Equipamento SAP",
                                    property: "equipamentoSap"
                                },

                                {
                                    label: "Categoria",
                                    property: "categoria"
                                }

                            ]

                        },

                        dataSource: dados,

                        fileName:
                            "Detalhamento_Componentes_Embarcados.xlsx"

                    });

                    await oSpreadsheet.build();

                    oSpreadsheet.destroy();

                } catch (err) {

                    sap.m.MessageBox.error(
                        err.message || "Erro ao gerar relatório"
                    );

                } finally {

                    oBusyDialog.close();

                }

                try {

                    const response = await fetch(
                        "http://10.44.32.193:4000/ConferenciaComponentesDetalhado/listar"
                    );

                    if (!response.ok) {

                        sap.m.MessageBox.error(
                            `Erro ${response.status} `
                        );

                        return;
                    }

                    const dados = await response.json();

                    const oSpreadsheet = new Spreadsheet({

                        workbook: {

                            columns: [

                                {
                                    label: "Tag Veículo",
                                    property: "tagVeiculo"
                                },

                                {
                                    label: "Tipo",
                                    property: "tipo"
                                },

                                {
                                    label: "Equipamento SAP",
                                    property: "equipamentoSap"
                                },

                                {
                                    label: "Categoria",
                                    property: "categoria"
                                }

                            ]

                        },

                        dataSource: dados,

                        fileName:
                            "Detalhamento_Componentes_Embarcados.xlsx"

                    });

                    await oSpreadsheet.build();

                    oSpreadsheet.destroy();

                } catch (err) {

                    sap.m.MessageBox.error(
                        err.message || "Erro ao gerar relatório"
                    );

                }
            },
            onSelecionarVeiculo(oEvent) {

                const oVeiculo =
                    oEvent.getSource()
                        .getBindingContext("dashboard")
                        .getObject();

                const nLat =
                    parseFloat(oVeiculo.latitude);

                const nLng =
                    parseFloat(oVeiculo.longitude);

                if (
                    isNaN(nLat) ||
                    isNaN(nLng) ||
                    !this._map
                ) {
                    return;
                }

                this._map.setView(
                    [nLat, nLng],
                    13
                );

            },

            onExportarConferenciaExcel() {

                const dados =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/dashboardVeiculos");

                const oSpreadsheet = new Spreadsheet({

                    workbook: {

                        columns: [

                            {
                                label: "Veículo",
                                property: "veiculo"
                            },

                            {
                                label: "Status",
                                property: "status"
                            },

                            {
                                label: "Conferência",
                                property: "conferencia"
                            }

                        ]

                    },

                    dataSource: dados,

                    fileName:
                        "Conferencia_Componentes_Embarcados.xlsx"

                });

                oSpreadsheet.build()
                    .finally(() => {
                        oSpreadsheet.destroy();
                    });

            },

            async carregarDashboard() {
                this.byId("idDashboardPage").setBusy(true);


                const response = await fetch(
                    "http://10.44.32.193:4004/odata/v4/smart-pcm/Rastreio"
                );
                const json = await response.json();
                const dadosFiltrados = (json.value || []).filter(item => {

                    if (
                        item.grupoAtual ===
                        "Tags Digitais Não Habilitadas"
                    ) {
                        return false;
                    }

                    if (
                        String(item.identificador) ===
                        "11039948"
                    ) {
                        return false;
                    }

                    return true;

                });
                const responseEstrutura =
                    await fetch(
                        "http://10.44.32.193:4000/EquipamentosEstrutura"
                    );

                const equipamentosEstrutura =
                    await responseEstrutura.json();


                const resumoFrotas =
                    this.gerarResumoFrotas(
                        equipamentosEstrutura.filter(
                            item => item.equipamento !== "11039948"
                        )
                    );
                const responseGateway = await fetch(
                    "http://10.44.32.193:4000/Gateway"
                );

                const gateways = await responseGateway.json();
                const responseZonas = await fetch(
                    "http://10.44.32.193:4000/Zonas"
                );

                const zonas = await responseZonas.json();
                // sap.m.MessageToast.show(
                //     "Passou aqui 1"
                // );

                const mapaGatewayDescricao = {};

                gateways.forEach(gw => {

                    mapaGatewayDescricao[
                        gw.gatewayId
                    ] = gw.identificador;

                });

                if (!gateways.length) {

                    sap.m.MessageToast.show(
                        "Nenhum gateway retornado"
                    );

                }
                const responseValorGerado =
                    await fetch(
                        "http://10.44.32.193:4000/ValorGerado"
                    );

                const valorGerado =
                    await responseValorGerado.json();

                const responseValorGeradoSemanal =
                    await fetch(
                        "http://10.44.32.193:4000/ValorGeradoSemanal"
                    );

                const valorGeradoSemanal =
                    await responseValorGeradoSemanal.json();
                let veiculos = [];

                try {

                    const responseVeiculos = await fetch(
                        "http://10.44.32.193:4000/Veiculo"
                    );

                    veiculos = await responseVeiculos.json();

                } catch (e) {

                    sap.m.MessageBox.error(
                        e.toString()
                    );
                }




                this._dadosFiltrados = dadosFiltrados;
                const gatewaysSet = new Set();
                const gruposMap = {};

                const agora = new Date();

                const limiteOnline = new Date(
                    agora.getTime() - (7 * 24 * 60 * 60 * 1000)
                );
                let indisponiveisEfetividade = 0;
                let online = 0;
                let offline = 0;
                let offlineInstalados = 0;
                let offlineForaItabira = 0;
                let offlineFeitDesatualizados = 0;

                const falhasMovimentacao = [];

                dadosFiltrados.forEach(item => {

                    let localizacao =
                        this.determinarGrupo(item);

                    if (localizacao.startsWith("Instalado no ")) {
                        localizacao = "Instalados";
                    }

                    gruposMap[localizacao] =
                        (gruposMap[localizacao] || 0) + 1;

                    if (!item.ultimaPosicao) {

                        offline++;

                        if (
                            item.grupoAtual &&
                            item.grupoAtual.startsWith("Instalado no ")
                        ) {
                            offlineInstalados++;
                        }

                        const local =
                            (item.localInstalacao || "")
                                .toUpperCase();
                        const instalado =
                            item.grupoAtual &&
                            item.grupoAtual.startsWith("Instalado no ");

                        const emFeit =
                            local.startsWith("FEIT");
                        if (
                            !local.startsWith("FEIT") &&
                            (
                                !item.grupoAtual ||
                                !item.grupoAtual.startsWith("Instalado no ")
                            )
                        ) {

                            offlineForaItabira++;

                            // sap.m.MessageBox.information(
                            //     "Local fora de FEIT:\n" +
                            //     local
                            // );

                        }
                        return;

                    }

                    const dataPosicao =
                        this.converterDataBr(
                            item.ultimaPosicao
                        );

                    if (
                        !dataPosicao ||
                        isNaN(dataPosicao.getTime())
                    ) {

                        offline++;

                        if (
                            item.grupoAtual &&
                            item.grupoAtual.startsWith("Instalado no ")
                        ) {
                            offlineInstalados++;
                        }

                        const local =
                            (item.localInstalacao || "")
                                .toUpperCase();

                        if (
                            !local.startsWith("FEIT") &&
                            (
                                !item.grupoAtual ||
                                !item.grupoAtual.startsWith("Instalado no ")
                            )
                        ) {
                            offlineForaItabira++;
                        }

                        return;

                    }


                    if (dataPosicao >= limiteOnline) {

                        online++;

                        if (item.gateway) {
                            gatewaysSet.add(item.gateway);
                        }


                        const local =
                            (item.localInstalacao || "")
                                .toUpperCase();

                        if (
                            item.gateway &&
                            !local.startsWith("FEIT")
                        ) {

                            falhasMovimentacao.push({

                                identificador:
                                    item.identificador,

                                localInstalacao:
                                    item.localInstalacao,

                                equipamento:
                                    item.descEquipamento,

                                gateway:
                                    item.gateway,

                                ultimaPosicao:
                                    item.ultimaPosicao

                            });

                        }

                    } else {

                        const instalado =
                            item.grupoAtual &&
                            item.grupoAtual.startsWith("Instalado no ");

                        const local =
                            (item.localInstalacao || "")
                                .toUpperCase();

                        const emFeit =
                            local.startsWith("FEIT");

                        if (!instalado && emFeit) {

                            offline++;
                            offlineFeitDesatualizados++;

                        }

                    }

                });

                const totalFalhasMovimentacao =
                    falhasMovimentacao.length;

                const percentualFalhasMovimentacao =
                    online > 0
                        ? (
                            totalFalhasMovimentacao /
                            online
                        ) * 100
                        : 0;
                const percentualConsistenciaMovimentacao =
                    online > 0
                        ? (
                            ((online - totalFalhasMovimentacao) / online) * 100
                        )
                        : 100;
                const gruposNormais = [];
                const gruposEspeciais = [];

                Object.keys(gruposMap).forEach(grupo => {

                    const item = {
                        grupo,
                        quantidade: gruposMap[grupo]
                    };

                    if (
                        grupo === "Fora de zona"
                    ) {
                        gruposEspeciais.push(item);
                    } else {
                        gruposNormais.push(item);
                    }

                });

                gruposNormais.sort((a, b) =>
                    a.grupo.localeCompare(
                        b.grupo,
                        "pt-BR",
                        { sensitivity: "base" }
                    )
                );

                const grupos = [
                    ...gruposNormais,
                    ...gruposEspeciais
                ];

                const ultimasLeituras = [...dadosFiltrados]
                    .sort(
                        (a, b) =>
                            this.converterDataBr(b.ultimaPosicao) -
                            this.converterDataBr(a.ultimaPosicao)
                    )
                    .slice(0, 10);
                const resumoEquipamentos =
                    this.gerarResumoEquipamentos(
                        dadosFiltrados
                    );

                const resumoGrupoAtual =
                    this.gerarResumoGrupoAtual(
                        dadosFiltrados
                    );

                const gruposFinais = [
                    {
                        grupo: "Instalados",
                        quantidade: 0,
                        percentual: 0
                    },
                    {
                        grupo: "A reformar",
                        quantidade: 0,
                        percentual: 0
                    },
                    {
                        grupo: "Reformado",
                        quantidade: 0,
                        percentual: 0
                    },
                    {
                        grupo: "Ref. interna",
                        quantidade: 0,
                        percentual: 0
                    },
                    {
                        grupo: "Ref. externa",
                        quantidade: 0,
                        percentual: 0
                    }
                ];

                resumoGrupoAtual.forEach(item => {

                    const indice =
                        gruposFinais.findIndex(
                            g => g.grupo === item.grupo
                        );

                    if (indice >= 0) {

                        gruposFinais[indice] = {
                            grupo: item.grupo,
                            quantidade: item.quantidade || 0,
                            percentual: item.percentual || 0
                        };

                    }

                });

                resumoGrupoAtual.length = 0;

                gruposFinais.forEach(item => {
                    resumoGrupoAtual.push(item);
                });




                const distribuicaoImplantacao =
                    this.gerarDistribuicaoImplantacao(
                        dadosFiltrados
                    );

                const distribuicaoMinas =
                    this.gerarDistribuicaoMinas(
                        dadosFiltrados
                    );


                const detalhesTagsDesatualizadas =
                    this.gerarDetalhesTagsDesatualizadas(
                        dadosFiltrados
                    );

                const analiseInstaladosDesatualizados =
                    this.gerarAnaliseInstaladosDesatualizados(
                        dadosFiltrados
                    );

                const sugestoesInspecao = dadosFiltrados
                    .map(item => {

                        let diasSemAtualizacao = 9999;

                        if (item.ultimaPosicao) {

                            const dataPosicao =
                                this.converterDataBr(
                                    item.ultimaPosicao
                                );

                            diasSemAtualizacao = Math.floor(
                                (agora - dataPosicao) /
                                (1000 * 60 * 60 * 24)
                            );
                        }

                        const instalado =
                            item.grupoAtual &&
                            item.grupoAtual.startsWith(
                                "Instalado no "
                            );

                        return {
                            nome: instalado
                                ? item.grupoAtual.replace(
                                    "Instalado no ",
                                    ""
                                )
                                : item.identificador,

                            tipo: instalado
                                ? "VEICULO"
                                : "EQUIPAMENTO",

                            icone: instalado
                                ? "sap-icon://shipping-status"
                                : "sap-icon://wrench",

                            equipamento:
                                item.descEquipamento,

                            diasSemAtualizacao,

                            instalado
                        };
                    })
                    .sort(
                        (a, b) =>
                            (a.nome || "").localeCompare(
                                b.nome || "",
                                "pt-BR",
                                { sensitivity: "base" }
                            )
                    )
                    .slice(0, 8);
                const mapaVeiculosDashboard = {};

                veiculos.forEach(v => {

                    const existente =
                        mapaVeiculosDashboard[v.Veiculo];

                    if (
                        !existente ||
                        new Date(v.DataAtualizacao) >
                        new Date(existente.DataAtualizacao)
                    ) {

                        mapaVeiculosDashboard[v.Veiculo] = v;

                    }

                });

                const veiculosUnicosDashboard =
                    Object.values(
                        mapaVeiculosDashboard
                    );

                const dashboardVeiculos = [];


                for (const veiculo of veiculosUnicosDashboard) {

                    const equipamentosVeiculo = dadosFiltrados.filter(
                        item =>
                            item.grupoAtual ===
                            `Instalado no ${veiculo.Veiculo} `
                    );
                    const responseEsperados = await fetch(
                        `http://10.44.32.193:4000/equipamentos/local/${encodeURIComponent(
                            veiculo.Veiculo
                        )}`
                    );

                    const gruposEsperados = await responseEsperados.json();

                    const conferencia = [];

                    let divergente = false;
                    Object.entries(gruposEsperados).forEach(
                        ([grupoEsperado, quantidadeEsperada]) => {

                            const instalado = equipamentosVeiculo.filter(
                                item =>
                                    this.normalizarGrupo(
                                        item.descEquipamento
                                    ) === grupoEsperado
                            ).length;

                            if (instalado !== quantidadeEsperada) {
                                divergente = true;
                            }

                            conferencia.push({

                                tipo: grupoEsperado,

                                rastreadoresInstalados: instalado,

                                cadastradosSap: quantidadeEsperada,

                                aderenciaSap:
                                    quantidadeEsperada > 0
                                        ? Math.round(
                                            (instalado / quantidadeEsperada) * 100
                                        )
                                        : 0

                            });

                        }
                    );

                    dashboardVeiculos.push({
                        veiculo: veiculo.Veiculo,
                        imagem: "img/793D.png",
                        latitude: veiculo.Latitude,
                        longitude: veiculo.Longitude,
                        conferencia,
                        status: divergente ? "Divergente" : "Conforme",
                        state: divergente ? "Error" : "Success"
                    });

                } // Fechamento do laço (for/forEach) anterior

                const totalEmbarcados = dashboardVeiculos.length;
                const graficoTipoStatus = this.gerarGraficoTipoStatus(dadosFiltrados);

                const resumoTipoStatus = this.gerarResumoTipoStatus(graficoTipoStatus);

                const totalStatusTipo = Object.keys(
                    graficoTipoStatus.reduce((acc, item) => {
                        acc[item.status] = true;
                        return acc;
                    }, {})
                ).length;
                // sap.m.MessageBox.information(
                //     JSON.stringify(
                //         resumoFrotas.slice(0, 5),
                //         null,
                //         2
                //     )
                // );   
                const responseReformados =
                    await fetch(
                        "http://10.44.32.193:4000/ReformadosDescLocal/listar"
                    );

                const reformadosPorOficina =
                    await responseReformados.json();
                reformadosPorOficina.forEach(item => {

                    item.descLocalInstalacao =
                        (item.descLocalInstalacao || "")
                            .trim()
                            .split(/\s+/)
                            .slice(-2)
                            .join(" ");

                });
                // const reformadosPorLocal =
                //     await responseReformados.json();

                const responseLocalizacao =
                    await fetch(
                        "http://10.44.32.193:4000/LocalizacaoAtual"
                    );

                const localizacaoAtual =
                    await responseLocalizacao.json();

                /*
                * AQUI
                */
                const instalados =
                    localizacaoAtual.filter(
                        item => item.nota !== null
                    ).length;

                const totalRastreadores = 50;

                const faltantes =
                    totalRastreadores - instalados;

                const percentualInstalado =
                    (
                        (instalados / totalRastreadores) * 100
                    ).toFixed(1);

                const graficoInstalacao = [
                    {
                        status: "Instalados",
                        quantidade: instalados
                    },
                    {
                        status: "Pendentes",
                        quantidade: faltantes
                    }
                ];

                // sap.m.MessageBox.information(
                //     JSON.stringify(
                //         graficoInstalacao,
                //         null,
                //         2
                //     )
                const totalEquipamentos = dadosFiltrados.length;



                const percentualOnline =
                    totalEquipamentos > 0
                        ? ((online / totalEquipamentos) * 100).toFixed(1)
                        : "0.0";

                const percentualOffline =
                    totalEquipamentos > 0
                        ? ((offline / totalEquipamentos) * 100).toFixed(1)
                        : "0.0";
                const percentualEquipamentos =
                    ((totalEquipamentos / 50) * 100).toFixed(1);
                const percentualGateway =
                    ((gateways.length / 7) * 100).toFixed(1);

                const oportunidadesMelhoria = [];


                if (Number(valorGerado.disponibilidadeMonitoramento) < 100) {

                    oportunidadesMelhoria.push({
                        tipo: "disponibilidade",
                        texto:
                            "Inspecionar componentes com localização desatualizada para elevar a disponibilidade de monitoramento.",
                        state: "Warning"
                    });

                }

                if (Number(percentualGateway) < 100) {

                    oportunidadesMelhoria.push({
                        tipo: "gateway",
                        texto:
                            "Concluir a implantação dos gateways remanescentes para ampliar a cobertura RFID.",
                        state: "Warning"
                    });

                }

                if (Number(percentualConsistenciaMovimentacao) < 100) {

                    oportunidadesMelhoria.push({
                        tipo: "consistencia",
                        texto:
                            "Corrigir divergências entre localização SAP e posição detectada para aumentar a consistência operacional.",
                        state: "Warning"
                    });

                }

                if (oportunidadesMelhoria.length === 0) {

                    oportunidadesMelhoria.push({
                        texto:
                            "Todas as metas operacionais do foram atingidas.",
                        state: "Success"
                    });

                }
                grupos.forEach(item => {

                    item.percentual =
                        (
                            item.quantidade /
                            totalEquipamentos * 100
                        ).toFixed(1);

                });
                this.getView()
                let oDashboardModel =
                    this.getView().getModel("dashboard");

                if (!oDashboardModel) {

                    oDashboardModel =
                        new JSONModel({});

                    this.getView().setModel(
                        oDashboardModel,
                        "dashboard"
                    );

                }
                const localidades = new Set();

                dadosFiltrados.forEach(item => {

                    const codigo = (
                        item.localInstalacao || ""
                    ).toUpperCase().substring(0, 4);

                    switch (codigo) {

                        case "FEIT":
                            localidades.add("ITABIRA");
                            break;

                        case "FEBR":
                            localidades.add("BRUCUTU");
                            break;

                        case "FEMN":
                            localidades.add("MARIANA");
                            break;

                        case "PPIC":
                            localidades.add("PICO");
                            break;

                        default:
                            if (codigo) {
                                localidades.add(codigo);
                            }
                            break;
                    }
                });
                const categorias = new Set();

                dadosFiltrados.forEach(item => {

                    const descricao =
                        (item.descEquipamento || "")
                            .toUpperCase();

                    if (descricao.includes("COMANDO FINAL")) {
                        categorias.add("COMANDO FINAL");
                    }
                    else if (descricao.includes("CONVERSOR")) {
                        categorias.add("CONVERSOR DE TORQUE");
                    }
                    else if (descricao.includes("TRANSMIS")) {
                        categorias.add("TRANSMISSÃO");
                    }
                    else if (descricao.includes("DIFERENCIAL")) {
                        categorias.add("DIFERENCIAL");
                    }
                    else if (descricao.includes("MOTOR")) {
                        categorias.add("MOTOR");
                    }

                });

                const totalCategoriasEquipamento =
                    categorias.size;

                const totalLocalidades =
                    localidades.size;

                oDashboardModel.setData({

                    totalStatusTipo,

                    totalEmbarcados,

                    totalCategoriasEquipamento,

                    totalLocalidades,

                    totalEquipamentos,

                    percentualEquipamentos,

                    online,

                    offline,

                    offlineInstalados,

                    offlineForaItabira,

                    offlineFeitDesatualizados,

                    percentualOnline,

                    percentualOffline,

                    gateways: gateways.length,

                    percentualGateway,

                    grupos,

                    ultimasLeituras,

                    resumoEquipamentos,

                    resumoGrupoAtual,

                    detalhesTagsDesatualizadas,

                    analiseInstaladosDesatualizados,

                    sugestoesInspecao,

                    dashboardVeiculos,

                    resumoFrotas,

                    resumoTipoStatus,

                    graficoTipoStatus,

                    reformadosPorOficina,

                    graficoInstalacao,

                    instalados,

                    faltantes,

                    percentualInstalado,

                    tempoLocalizacao:
                        valorGerado.tempoLocalizacao,

                    rastreabilidadeValorGerado:
                        valorGerado.rastreabilidade,

                    disponibilidadeMonitoramento:
                        valorGerado.disponibilidadeMonitoramento,

                    componentesDisponiveis:
                        valorGerado.componentesDisponiveis,

                    coberturaValorGerado:
                        valorGerado.cobertura,

                    componentesMovimentados:
                        valorGerado.componentesMovimentados,

                    percentualMovimentados:
                        valorGerado.percentualMovimentados,

                    totalMovimentacoes:
                        valorGerado.totalMovimentacoes,

                    totalComponentesValorGerado:
                        valorGerado.totalComponentes,

                    indiceEfetividade:
                        Math.round(parseFloat(valorGerado.indiceEfetividade) || 0),

                    classificacaoEfetividade:
                        valorGerado.classificacao,

                    valorGeradoSemanal:
                        valorGeradoSemanal,

                    falhasMovimentacao:
                        totalFalhasMovimentacao,

                    consistenciasMovimentacao:
                        online - totalFalhasMovimentacao,

                    percentualConsistenciaMovimentacao:
                        percentualConsistenciaMovimentacao.toFixed(1),

                    detalhesFalhasMovimentacao:
                        falhasMovimentacao,

                    oportunidadesMelhoria:
                        oportunidadesMelhoria,

                    distribuicaoImplantacao:
                        distribuicaoImplantacao,
                    distribuicaoMinas:
                        distribuicaoMinas

                });

                const oVizFrame =
                    this.byId("idTipoStatusVizFrame");

                this.byId("idTipoStatusNovoVizFrame");
                if (oVizFrame) {

                    oVizFrame.destroyFeeds();

                    if (oVizFrame.getDataset()) {
                        oVizFrame.destroyDataset();
                    }

                    const oDataset =
                        new sap.viz.ui5.data.FlattenedDataset({

                            dimensions: [

                                {
                                    name: "Tipo",
                                    value: "{dashboard>tipo}"
                                },

                                {
                                    name: "Status",
                                    value: "{dashboard>status}"
                                }

                            ],

                            measures: [

                                {
                                    name: "Quantidade",
                                    value: "{dashboard>quantidade}"
                                }

                            ],

                            data: {
                                path: "dashboard>/graficoTipoStatus"
                            }

                        });

                    oVizFrame.setDataset(oDataset);

                    oVizFrame.setModel(
                        this.getView().getModel("dashboard"),
                        "dashboard"
                    );

                    oVizFrame.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "valueAxis",
                            type: "Measure",
                            values: ["Quantidade"]
                        })
                    );

                    oVizFrame.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "categoryAxis",
                            type: "Dimension",
                            values: ["Tipo"]
                        })
                    );

                    oVizFrame.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "color",
                            type: "Dimension",
                            values: ["Status"]
                        })
                    );
                    oVizFrame.setVizProperties({

                        plotArea: {

                            colorPalette: [

                                "#0A6ED1", // Reform.
                                "#546E7A", // Inst.
                                "#7CB342", // Ref. Int.
                                "#D81B60"  // Reformar

                            ],

                            dataLabel: {
                                visible: false
                            }

                        },

                        categoryAxis: {
                            title: {
                                visible: false
                            },
                            categoryAxis: {
                                title: {
                                    visible: false
                                },
                                label: {
                                    angle: 45,
                                    style: {
                                        fontSize: "9px"
                                    }
                                }
                            },

                        },

                        valueAxis: {
                            title: {
                                visible: false
                            },
                            label: {
                                visible: false
                            },
                            axisLine: {
                                visible: false
                            },
                            gridline: {
                                visible: false
                            }
                        },



                        legend: {
                            visible: true,
                            title: {
                                visible: false
                            }
                        },

                        title: {
                            visible: false
                        }

                    });

                }
                const oVizFrameMinas =
                    this.byId("idDistribuicaoMinasVizFrame");

                if (oVizFrameMinas) {

                    oVizFrameMinas.destroyFeeds();

                    if (oVizFrameMinas.getDataset()) {
                        oVizFrameMinas.destroyDataset();
                    }

                    oVizFrameMinas.setDataset(
                        new sap.viz.ui5.data.FlattenedDataset({

                            dimensions: [{
                                name: "Mina",
                                value: "{dashboard>mina}"
                            }],

                            measures: [{
                                name: "Quantidade",
                                value: "{dashboard>quantidade}"
                            }],

                            data: {
                                path: "dashboard>/distribuicaoMinas"
                            }

                        })
                    );

                    oVizFrameMinas.setModel(
                        this.getView().getModel("dashboard"),
                        "dashboard"
                    );

                    oVizFrameMinas.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "categoryAxis",
                            type: "Dimension",
                            values: ["Mina"]
                        })
                    );

                    oVizFrameMinas.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "valueAxis",
                            type: "Measure",
                            values: ["Quantidade"]
                        })
                    );

                    oVizFrameMinas.setVizProperties({

                        title: {
                            visible: false
                        },

                        legend: {
                            visible: false
                        },

                        categoryAxis: {
                            title: {
                                visible: false
                            },

                            label: {
                                style: {
                                    fontSize: "14px",
                                    fontWeight: "bold"
                                }
                            }
                        },

                        valueAxis: {
                            title: {
                                visible: false
                            }
                        },

                        plotArea: {

                            dataPointStyle: {
                                rules: [
                                    {
                                        dataContext: { Mina: "ITABIRA" },
                                        properties: {
                                            color: "#0A6ED1"
                                        }
                                    },
                                    {
                                        dataContext: { Mina: "BRUCUTU" },
                                        properties: {
                                            color: "#107E3E"
                                        }
                                    },
                                    {
                                        dataContext: { Mina: "PICO" },
                                        properties: {
                                            color: "#D81B60"
                                        }
                                    },
                                    {
                                        dataContext: { Mina: "SOTREQ" },
                                        properties: {
                                            color: "#546E7A"
                                        }
                                    }
                                ]
                            },

                            dataLabel: {
                                visible: true
                            }

                        }


                    });
                }
                const oVizFrameReformados =
                    this.byId("idReformadosOficinaVizFrame");

                if (oVizFrameReformados) {

                    oVizFrameReformados.destroyFeeds();

                    if (oVizFrameReformados.getDataset()) {
                        oVizFrameReformados.destroyDataset();
                    }

                    const oDatasetReformados =
                        new sap.viz.ui5.data.FlattenedDataset({

                            dimensions: [

                                {
                                    name: "Descrição do local",
                                    value: "{dashboard>descLocalInstalacao}"
                                },

                                {
                                    name: "Tipo",
                                    value: "{dashboard>tipo}"
                                }

                            ],

                            measures: [

                                {
                                    name: "Quantidade",
                                    value: "{dashboard>quantidade}"
                                }

                            ],

                            data: {
                                path: "dashboard>/reformadosPorOficina"
                            }


                        });

                    oVizFrameReformados.setDataset(
                        oDatasetReformados
                    );

                    oVizFrameReformados.setModel(
                        this.getView().getModel("dashboard"),
                        "dashboard"
                    );
                    oVizFrameReformados.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "valueAxis",
                            type: "Measure",
                            values: ["Quantidade"]
                        })
                    );

                    oVizFrameReformados.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "categoryAxis",
                            type: "Dimension",
                            values: ["Descrição do local"]
                        })
                    );

                    oVizFrameReformados.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "color",
                            type: "Dimension",
                            values: ["Tipo"]
                        })
                    );

                    oVizFrameReformados.setVizProperties({

                        plotArea: {

                            colorPalette: [

                                "#0A6ED1", // Comando Final
                                "#546E7A", // Conversor de Torque
                                "#107E3E", // Transmissão
                                "#D81B60", // Diferencial
                                "#7E57C2"  // Motor

                            ],

                            dataLabel: {
                                visible: false
                            },

                            dataPointSize: {
                                max: 5
                            }

                        },

                        valueAxis: {
                            visible: false
                        },
                        categoryAxis: {
                            title: {
                                visible: false
                            }
                        },
                        valueAxis2: {
                            visible: false
                        },

                        title: {
                            visible: false
                        }

                    });
                }
                const oVizFrameInstalacao =
                    this.byId("idInstalacaoVizFrame");
                if (oVizFrameInstalacao) {

                    oVizFrameInstalacao.destroyFeeds();

                    if (oVizFrameInstalacao.getDataset()) {
                        oVizFrameInstalacao.destroyDataset();
                    }

                    const oDatasetInstalacao =
                        new sap.viz.ui5.data.FlattenedDataset({

                            dimensions: [
                                {
                                    name: "Status",
                                    value: "{dashboard>status}"
                                }
                            ],

                            measures: [
                                {
                                    name: "Quantidade",
                                    value: "{dashboard>quantidade}"
                                }
                            ],

                            data: {
                                path: "dashboard>/graficoInstalacao"
                            }

                        });

                    oVizFrameInstalacao.setDataset(
                        oDatasetInstalacao
                    );

                    oVizFrameInstalacao.setModel(
                        this.getView().getModel("dashboard"),
                        "dashboard"
                    );

                    oVizFrameInstalacao.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "size",
                            type: "Measure",
                            values: ["Quantidade"]
                        })
                    );

                    oVizFrameInstalacao.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "color",
                            type: "Dimension",
                            values: ["Status"]
                        })
                    );

                    oVizFrameInstalacao.setVizProperties({

                        title: {
                            visible: true,
                            text:
                                `Instalados: ${instalados}/50 (${percentualInstalado}%)`
                        },

                        legend: {
                            visible: true
                        },

                        plotArea: {
                            dataLabel: {
                                visible: true
                            }
                        }

                    });
                }

                this.byId("htmlMapa").setContent(`
                    <div
                        id="mapaEquipamentos"
                        style="
                            width:100%;
                            height:calc(100vh - 320px);
                            min-height:750px;
                        ">
                    </div>
                `);
                sap.ui.getCore().applyChanges();


                setTimeout(async () => {

                    let dadosMapa = dadosFiltrados;

                    if (this._grupoSelecionado) {

                        dadosMapa = dadosFiltrados.filter(item => {

                            let localizacao =
                                this.determinarGrupo(item);

                            if (
                                localizacao ===
                                "Tags Digitais desatualizadas"
                            ) {
                                localizacao = "Fora de zona";
                            }

                            if (localizacao.startsWith("Instalado no ")) {
                                localizacao = "Instalados";
                            }

                            return localizacao === this._grupoSelecionado;

                        });

                    }

                    this._dadosMapa = dadosMapa;

                    const equipamentos = dadosMapa.filter(item => {

                        if (
                            item.grupoAtual === "Tags Digitais Não Habilitadas"
                        ) {
                            return false;
                        }

                        if (
                            item.grupoAtual &&
                            item.grupoAtual.startsWith("Instalado no ")
                        ) {

                            const local =
                                (item.localInstalacao || "")
                                    .toUpperCase();

                            if (!local.startsWith("FEMN")) {
                                return false;
                            }

                        }

                        const local =
                            (item.localInstalacao || "")
                                .toUpperCase();

                        if (local.startsWith("FEMN")) {
                            return true;
                        }

                        const lat = parseFloat(item.latitude);
                        const lng = parseFloat(item.longitude);

                        return (
                            !isNaN(lat) &&
                            !isNaN(lng) &&
                            lat >= -21 &&
                            lat <= -18 &&
                            lng >= -45 &&
                            lng <= -42
                        );

                    });

                    if (this._map) {
                        this._map.remove();
                        this._map = null;
                    }

                    const osm = L.tileLayer(
                        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        {
                            attribution: "&copy; OpenStreetMap"
                        }
                    );

                    const satelite = L.tileLayer(
                        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                        {
                            attribution: "Tiles © Esri"
                        }
                    );


                    this._map = L.map("mapaEquipamentos", {
                        center: [-19.641510, -43.226143],
                        zoom: 12,
                        layers: [satelite]
                    });


                    setTimeout(() => {
                        this._map.invalidateSize(true);
                    }, 500);

                    this._poligonosZonas = [];

                    zonas.forEach(zona => {

                        try {

                            const pontos = JSON.parse(zona.pontos);

                            const poligono = L.polygon(
                                pontos.map(p => [p.lat, p.lon]),
                                {
                                    color: "#FFFFFF",
                                    weight: 3,
                                    opacity: 0.7,
                                    fillColor: "#FFFFFF",
                                    fillOpacity: 0.04,
                                    lineJoin: "round"
                                }
                            )
                                .bindTooltip(
                                    zona.nome.toUpperCase(),
                                    {
                                        permanent: false,
                                        direction: "center",
                                        className: "gatewayLabel"
                                    }
                                )
                                .addTo(this._map);

                            poligono.closeTooltip();

                            this._poligonosZonas.push(
                                poligono
                            );

                        } catch (e) {

                        }

                    });

                    this._map.on("click", (e) => {

                        if (!this._modoCoordenadas) {
                            return;
                        }

                        const latitude =
                            e.latlng.lat.toFixed(6);

                        const longitude =
                            e.latlng.lng.toFixed(6);

                        const coordenada =
                            `${latitude}, ${longitude}`;

                        navigator.clipboard.writeText(coordenada)
                            .then(() => {

                                sap.m.MessageToast.show(
                                    `Coordenada copiada: ${coordenada}`
                                );

                            })
                            .catch(() => {

                                sap.m.MessageToast.show(
                                    coordenada
                                );

                            });

                    }); this._layerLabels =
                        L.layerGroup().addTo(this._map);

                    this.atualizarLabels();

                    /* Destaca a busca uma única vez após carregar o mapa */
                    this._map.whenReady(() => {

                        const oSearch =
                            this.byId("idPesquisaRastreador");

                        if (oSearch) {

                            oSearch.removeStyleClass(
                                "pesquisaDestacada"
                            );

                            setTimeout(() => {

                                oSearch.addStyleClass(
                                    "pesquisaDestacada"
                                );

                            }, 100);

                            setTimeout(() => {

                                oSearch.removeStyleClass(
                                    "pesquisaDestacada"
                                );

                            }, 20000);

                        }

                    });

                    this._map.on("zoomend", () => {

                        this.atualizarLabels();

                        const zoom =
                            this._map.getZoom();

                        if (zoom >= 17) {

                            this._poligonosZonas.forEach(p => {
                                p.openTooltip();
                            });

                        } else {

                            this._poligonosZonas.forEach(p => {
                                p.closeTooltip();
                            });

                        }

                    });




                    // CONTROLE DE CAMADAS
                    L.control.layers(
                        {
                            "Mapa": osm,
                            "Satélite": satelite
                        },
                        {},
                        {
                            collapsed: false
                        }
                    ).addTo(this._map);
                    botaoCoordenadas.onAdd = () => {

                        const div = L.DomUtil.create("div");

                        L.DomEvent.disableClickPropagation(div);
                        L.DomEvent.disableScrollPropagation(div);

                        const oButton = new sap.m.Button({
                            text: "📍 Coord",
                            press: () => {

                                this._modoCoordenadas =
                                    !this._modoCoordenadas;

                                sap.m.MessageToast.show(
                                    this._modoCoordenadas
                                        ? "Modo coordenadas ativado"
                                        : "Modo coordenadas desativado"
                                );
                            }
                        });

                        oButton.placeAt(div);

                        return div;
                    };

                    setTimeout((a) => {

                        const controleLayers =
                            document.querySelector(".leaflet-control-layers");

                        if (controleLayers) {

                            controleLayers.style.width = "140px";

                            controleLayers.style.fontSize = "12px";

                            const labels =
                                controleLayers.querySelectorAll("label");

                            labels.forEach(label => {
                                label.style.fontSize = "12px";
                                label.style.lineHeight = "12px";
                            });
                        }

                    }, 100);
                    // LEGENDA
                    const legenda = L.control({
                        position: "topright"
                    });

                    legenda.onAdd = function () {

                        const div = L.DomUtil.create("div", "mapLegend");

                        div.style.background = "white";
                        div.style.padding = "6px 8px";
                        div.style.borderRadius = "6px";
                        div.style.boxShadow = "0 1px 6px rgba(0,0,0,.4)";
                        div.style.fontSize = "12px";
                        div.style.lineHeight = "14px";
                        div.style.width = "140px";
                        div.style.color = "#333";
                        div.style.marginTop = "6px";
                        div.style.textAlign = "left";
                        div.innerHTML =

                            "<div style='" +
                            "font-weight:bold;" +
                            "margin-bottom:4px;" +
                            "text-align:center;" +
                            "border-bottom:1px solid #ddd;" +
                            "'>" +
                            "Status" +
                            "</div>" +

                            "<span style='display:inline-block;" +
                            "width:6px;" +
                            "height:6px;" +
                            "border:2px solid white;" +
                            "background:#2ecc71;" +

                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(46,204,113,0.25),0 0 10px rgba(46,204,113,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Online<br>" +

                            "<span style='display:inline-block;" +
                            "width:6px;" +
                            "height:6px;" +
                            "border:2px solid white;" +
                            "background:#f1c40f;" +

                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(241,196,15,0.25),0 0 10px rgba(241,196,15,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Offline<br>" +

                            "<span style='display:inline-block;" +
                            "width:6px;" +
                            "height:6px;" +
                            "border:2px solid white;" +
                            "background:#3498db;" +

                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(52,152,219,0.25),0 0 10px rgba(52,152,219,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Gateway<br>" +

                            "<span style='display:inline-block;" +
                            "width:18px;" +
                            "height:3px;" +
                            "background:#666;" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Zona<br>" +
                            "<span style='display:inline-block;" +
                            "width:6px;" +
                            "height:6px;" +
                            "border:2px solid white;" +
                            "background:#9B6DFF;" +

                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(155,109,255,0.25),0 0 10px rgba(155,109,255,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Instalados";

                        return div;
                    };

                    legenda.addTo(this._map);
                    // cidades.addTo(this._map);

                    this._layerOnline = L.layerGroup();
                    this._layerOffline = L.layerGroup();
                    this._layerGateway = L.layerGroup();
                    this._layerInstalados = L.layerGroup();
                    const markers = L.layerGroup();
                    const gatewaysLayer = L.layerGroup();
                    const bounds = [];
                    this._gatewayMarkers = {};
                    this._gatewayInfo = {};
                    this._equipamentoMarkers = {};

                    this._modoMedicao = false;
                    this._modoCoordenadas = false;

                    this._pontosMedicao = [];
                    this._linhaMedicao = null;


                    equipamentos.forEach(item => {
                        if (
                            item.grupoAtual &&
                            item.grupoAtual.startsWith("Instalado no ")
                        ) {
                            return;
                        }

                        const descricaoGateway =
                            mapaGatewayDescricao[item.gateway];
                        let lat = parseFloat(item.latitude);
                        let lng = parseFloat(item.longitude);
                        const localInstalacao =
                            (item.localInstalacao || "")
                                .toUpperCase();

                        const descricaoEquipamentoMapa =
                            (item.descEquipamento || "")
                                .toUpperCase();

                        if (
                            localInstalacao.includes("_EMREF_EXT")
                        ) {

                            lat = -19.707443;
                            lng = -43.900855;

                        }
                        if (
                            localInstalacao.startsWith("FEMN")
                        ) {

                            // Mariana
                            lat = -20.3776;
                            lng = -43.4168;

                        }
                        else if (
                            localInstalacao.startsWith("FEBR")
                        ) {

                            // Mina de Brucutu
                            lat = -19.871612;
                            lng = -43.392883;

                        }
                        if (
                            localInstalacao.startsWith("FEBR")
                        ) {

                            // Mina de Brucutu
                            lat = -19.871612;
                            lng = -43.392883;

                        }
                        if (
                            localInstalacao.startsWith("FEBR")
                        ) {

                            // Mina de Brucutu
                            lat = -19.871612;
                            lng = -43.392883;

                        }
                        else if (
                            localInstalacao.startsWith("PPIC")
                        ) {

                            // Mina do Pico
                            lat = -20.220578;
                            lng = -43.871146;

                        }
                        else if (
                            localInstalacao.includes(
                                "FEIT-LES-MVC-AMACC-MINA-REFO"
                            )
                        ) {

                            const ehMotorOuComandoFinal =
                                descricaoEquipamentoMapa.includes("MOTOR") ||
                                descricaoEquipamentoMapa.includes("COMANDO FINAL");

                            if (ehMotorOuComandoFinal) {

                                // Área 23
                                lat = -19.604498;
                                lng = -43.211828;

                            } else {

                                // Área 27
                                lat = -19.601748;
                                lng = -43.209649;

                            }

                        }
                        else if (
                            localInstalacao.includes(
                                "FEIT-LES-MVC-AMACC-MINA-REFO"
                            )
                        ) {

                            const ehMotorOuComandoFinal =
                                descricaoEquipamentoMapa.includes("MOTOR") ||
                                descricaoEquipamentoMapa.includes("COMANDO FINAL");

                            if (ehMotorOuComandoFinal) {

                                // Área 23
                                lat = -19.604498;
                                lng = -43.211828;

                            } else {

                                // Área 27
                                lat = -19.601748;
                                lng = -43.209649;

                            }

                        }
                        const dataPosicao =
                            this.converterDataBr(item.ultimaPosicao);

                        const online =
                            dataPosicao >= limiteOnline;

                        const cor =
                            online
                                ? "#2ecc71"
                                : "#f1c40f";
                        const sombra =
                            online
                                ? "rgba(46,204,113,0.8)"
                                : "rgba(241,196,15,0.8)";

                        const halo =
                            online
                                ? "rgba(46,204,113,0.25)"
                                : "rgba(241,196,15,0.25)";
                        const ehInstalado =
                            item.grupoAtual &&
                            item.grupoAtual.startsWith("Instalado no ");

                        const descricaoEquipamento =
                            (item.descEquipamento || '').toLowerCase();

                        let imagemEquipamento = "img/793D_default.png";

                        if (descricaoEquipamento.includes("motor")) {
                            imagemEquipamento = "img/MOTOR.png";
                        } else if (descricaoEquipamento.includes("conversor")) {
                            imagemEquipamento = "img/CONVERSOR.png";
                        } else if (descricaoEquipamento.includes("comando")) {
                            imagemEquipamento = "img/COMANDO.png";
                        } else if (descricaoEquipamento.includes("diferencial")) {
                            imagemEquipamento = "img/DIFERENCIAL.png";
                        } else if (
                            descricaoEquipamento.includes("transmissao") ||
                            descricaoEquipamento.includes("transmissão")
                        ) {
                            imagemEquipamento = "img/TRANSMISSAO.png";
                        }

                        const marker = L.marker(
                            [lat, lng],
                            {
                                icon: L.divIcon({
                                    className: "",
                                    html: ehInstalado
                                        ? `
                                <div style="
                                    width:12px;
                                    height:12px;
                                    background:#9B6DFF;
                                    border:2px solid white;
                                    border-radius:50%;
                                    box-shadow:
                                        0 0 0 4px rgba(155,109,255,0.25),
                                        0 0 10px rgba(155,109,255,0.8);
                                "></div>
                            `
                                        : `
                                <div style="
                                    width:12px;
                                    height:12px;
                                    background:${cor};
                                    border:2px solid white;
                                    border-radius:50%;
                                    box-shadow:
                                        0 0 0 4px ${halo},
                                        0 0 10px ${sombra};
                                "></div>
                            `,
                                    iconSize: [22, 22],
                                    iconAnchor: [11, 11]
                                })
                            }
                        ).bindPopup(`
                        <div id="imagemVeiculoPopup_${item.identificador}" style="
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                            color: #1e293b;
                            padding: 2px;
                            background: #ffffff;
                        ">
                            <!-- Container da Imagem -->
                            <div id="cabecalhoEquip_${item.identificador}" style="
                                text-align: center;
                                background: #f8fafc;
                                border: 1px solid #e2e8f0;
                                border-radius: 12px;
                                padding: 8px;
                                margin-bottom: 8px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                            ">
                                <img src="${imagemEquipamento}" alt="Equipamento" style="
                                    max-width: 100%;
                                    height: auto;
                                    max-height: 120px;
                                    object-fit: contain;
                                " />
                            </div>


                            <!-- Informações Principais -->
                        <div style="
                            text-align:center;
                        margin-bottom:8px;

                        ">

                            <div style="
                                font-size:12px;
                                color:#0f172a;
                                font-weight:700;
                                margin-bottom:6px;
                            ">
                                ${item.identificador}
                            </div>

                            <div style="
                                font-size:12px;
                                color:#334155;
                                font-weight:500;
                            ">
                                ${item.descEquipamento || 'Não informado'}
                            </div>

                        </div>

                            <!-- Seção Expansível de Detalhes -->
                            <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-bottom:8px;">
                                <details id="detalhesEquip_${item.identificador}" style="
                                    background: #f8fafc;
                                    border-radius: 8px;
                                    border: 1px solid #e2e8f0;
                                    overflow: hidden;
                                    ">
                                    <summary style="cursor: pointer; font-weight: 600; font-size: 13px; padding: 10px 12px; color: #475569; user-select: none; outline: none;">
                                        🔍 Ver detalhes
                                    </summary>
                                    <div style="padding: 12px; border-top: 1px solid #e2e8f0; background: #ffffff; font-size: 13px; display: flex; flex-direction: column; gap: 8px; line-height: 1.4;">
                                    <div>
                                        <b>Local:</b>
                                        ${item.localInstalacao || 'Não informado'}
                                    </div>

                                    <div>
                                        <b>Nota:</b>
                                        ${item.nota || 'Não informado'}
                                    </div>

                                    <div>
                                        <b>Gateway:</b>
                                        ${descricaoGateway || item.gateway || 'Não informado'}
                                    </div>  
                                    <div><b style="color: #64748b;">Grupo:</b> <span style="color: #1e293b;">${item.grupoAtual || 'Não informado'}</span></div>
                                        <div><b style="color: #64748b;">Descrição do Local:</b> <span style="color: #1e293b;">${item.descLocalInstalacao || 'Não informado'}</span></div>
                                        <div><b style="color: #64748b;">Centro de Trabalho:</b> <span style="color: #1e293b;">${item.centro_trab_resp || 'Não informado'}</span></div>
                                        <div><b style="color: #64748b;">Centro de Localização:</b> <span style="color: #1e293b;">${item.centro_localizacao || 'Não informado'}</span></div>
                                        <div><b style="color: #64748b;">Oficina:</b> <span style="color: #1e293b;">${item.oficina || 'Não informado'}</span></div>
                                    </div>
                                    <button id="btnCopiar_${item.identificador}" style="
                                    width: 100%;
                                    display: inline-flex;
                                    align-items: center;
                                    justify-content: center;
                                    gap: 6px;
                                    background-color: #f1f5f9;
                                    color: #334155;
                                    border: 1px solid #cbd5e1;
                                    padding: 9px 12px;
                                    border-radius: 6px;
                                    font-size: 12px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    transition: background 0.15s ease;
                                " onmouseover="this.style.backgroundColor='#e2e8f0'" onmouseout="this.style.backgroundColor='#f1f5f9'">
                                    📋 Copiar Informações
                                </button>
                                </details>
                                
                            </div>

                            <!-- Ações e Rodapé -->
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                

                                    <div style="
                                        padding-top: 10px;
                                        border-top: 1px solid #f1f5f9;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        color: #94a3b8;
                                        font-size: 11px;
                                    ">
                                                                               <span>Última atualização:</span>
                                        <span style="font-weight: 600; color: #64748b;">
                                            ${item.ultimaPosicao ? item.ultimaPosicao.substring(8, 10) + '/' + item.ultimaPosicao.substring(5, 7) + '/' + item.ultimaPosicao.substring(0, 4) + ' ' + item.ultimaPosicao.substring(11, 16) : 'Sem registro'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `, {
                            minWidth: 350,
                            maxWidth: 350
                        });

                        marker.on("popupopen", () => {

                            const detalhesEquip = document.getElementById(
                                `detalhesEquip_${item.identificador}`
                            );

                            const cabecalhoEquip = document.getElementById(
                                `cabecalhoEquip_${item.identificador}`
                            );

                            if (detalhesEquip && cabecalhoEquip) {

                                detalhesEquip.addEventListener("toggle", () => {

                                    if (detalhesEquip.open) {

                                        cabecalhoEquip.style.display = "none";

                                    } else {

                                        cabecalhoEquip.style.display = "flex";

                                    }

                                });

                            }

                            setTimeout(() => {

                                const btn = document.getElementById(
                                    `btnCopiar_${item.identificador}`
                                );

                                if (!btn) {
                                    return;
                                }

                                btn.onclick = () => {

                                    const texto = `
                                        Identificador: ${item.identificador}
                                        Equipamento: ${item.descEquipamento || ""}
                                        Local: ${item.localInstalacao || ""}
                                        Nota: ${item.nota || "Não informado"}
                                        Gateway: ${descricaoGateway || item.gateway || "Não informado"}
                                        Última atualização: ${item.ultimaPosicao
                                            ? item.ultimaPosicao.substring(8, 10) + '/' +
                                            item.ultimaPosicao.substring(5, 7) + '/' +
                                            item.ultimaPosicao.substring(0, 4) + ' ' +
                                            item.ultimaPosicao.substring(11, 16)
                                            : "Sem registro"
                                        }
                                        Grupo: ${item.grupoAtual || ""}
                                        Descrição do Local: ${item.descLocalInstalacao || ""}
                                        Centro de Trabalho: ${item.centro_trab_resp || "Não informado"}
                                        Centro de Localização: ${item.centro_localizacao || "Não informado"}
                                        Oficina: ${item.oficina || "Não informado"}
                                    `.trim();

                                    navigator.clipboard.writeText(texto);

                                    sap.m.MessageToast.show(
                                        "Informações copiadas."
                                    );

                                };

                            }, 100);

                        });

                        marker.on("click", (e) => {

                            if (this._modoMedicao) {

                                this.processarMedicao(
                                    lat,
                                    lng,
                                    item.identificador
                                );

                                e.target.closePopup();
                            }

                        });

                        marker.on("dblclick", () => {

                            const gatewayMarker =
                                this._gatewayMarkers[item.gateway];

                            if (!gatewayMarker) {

                                sap.m.MessageToast.show(
                                    "Gateway não encontrado."
                                );

                                return;

                            }

                            this.piscarGateway(gatewayMarker);

                            const posGateway =
                                gatewayMarker.getLatLng();

                            const distancia =
                                this.calcularDistanciaMetros(
                                    lat,
                                    lng,
                                    posGateway.lat,
                                    posGateway.lng
                                );
                            const textoDistancia =
                                distancia >= 1000
                                    ? (distancia / 1000)
                                        .toFixed(2)
                                        .replace(".", ",") + " km"
                                    : distancia.toFixed(0) + " m";
                            const gatewayInfo =
                                this._gatewayInfo[item.gateway];
                            // sap.m.MessageBox.information(

                            //     "Gateway: " +
                            //     item.gateway +

                            //     "\nDescrição: " +
                            //     (gatewayInfo?.identificador || "N/A") +

                            //     "\nDistância estimada: " +
                            //     textoDistancia

                            // );

                        });

                        this._equipamentoMarkers[
                            item.identificador
                        ] = marker;

                        markers.addLayer(marker);

                        if (ehInstalado) {

                            this._layerInstalados.addLayer(marker);

                        } else if (online) {

                            this._layerOnline.addLayer(marker);

                        } else {

                            this._layerOffline.addLayer(marker);

                        }

                    });
                    const veiculosUnicos = [];

                    const mapaVeiculos = {};

                    veiculos.forEach(v => {

                        const existente = mapaVeiculos[v.Veiculo];

                        if (
                            !existente ||
                            new Date(v.DataAtualizacao) >
                            new Date(existente.DataAtualizacao)
                        ) {
                            mapaVeiculos[v.Veiculo] = v;
                        }

                    });

                    Object.values(mapaVeiculos)
                        .forEach(v => veiculosUnicos.push(v));


                    this._veiculoMarkers = {};
                    veiculosUnicos.forEach(veiculo => {

                        // sap.m.MessageToast.show(
                        //     "Passou aqui 2"
                        // );

                        const resumo =
                            this.gerarResumoVeiculo(
                                veiculo.Veiculo,
                                dadosFiltrados
                            );
                        const equipamentosVeiculo =
                            dadosFiltrados.filter(item =>
                                item.grupoAtual ===
                                `Instalado no ${veiculo.Veiculo}`
                            );

                        let htmlDetalhes = "";

                        equipamentosVeiculo.forEach(item => {

                            const descricaoGateway =
                                mapaGatewayDescricao[item.gateway];

                            const dataPosicao =
                                this.converterDataBr(
                                    item.ultimaPosicao
                                );

                            const diasSemAtualizacao =
                                Math.floor(
                                    (agora - dataPosicao) /
                                    (1000 * 60 * 60 * 24)
                                );

                            const indicador =
                                diasSemAtualizacao <= 7
                                    ? "🟢"
                                    : "🟡";
                            const gatewayInfo =
                                this._gatewayInfo?.[item.gateway];
                            htmlDetalhes += `
                                                                                            <div style="
                                margin:6px 0;
                                padding:4px 0;
                                border-bottom:1px solid #eee;
                                font-size:12px;
                            ">
                                                                                                                ${indicador}
                                                                                                                <b>${item.identificador}</b>
                                                                                                                -
                                                                                                                <span style="
                                    display:inline-block;
                                    max-width:380px;
                                    white-space:nowrap;     
                                    overflow:hidden;
                                    text-overflow:ellipsis;
                                    vertical-align:bottom;
                                ">
                                                                                                                    ${item.descEquipamento || ""}
                                                                                                                </span>

                                                                                                                <br>

                                                                                                                    <span style="
                                        color:#666;
                                        font-size:12px;
                                    ">
                                                                                                                                    Última atualização:
                                                                                                                    ${item.ultimaPosicao || "Não informada"}
                                                                                                                </span>

                                                                                                                <br>

                                                                                                                    <span style="
                        color:#3498db;
                        font-size:12px;
                    ">
                                                                                                                        📡 Gateway:
                                                                                                            <b>
                                                                                                                ${descricaoGateway || item.gateway || "Não informado"}
                                                                                                            </b>
                                                                                                        </span>

                                                                                                    </div>
                                                                                                    `;

                        });

                        const totalEquipamentos =
                            Object.values(resumo)
                                .reduce(
                                    (a, b) => a + b,
                                    0
                                );

                        let htmlResumo = "";

                        Object.keys(resumo)
                            .sort()
                            .forEach(tipo => {

                                htmlResumo += `
                        <b>${tipo}:</b>
                        ${resumo[tipo]}<br>
                    `;

                            });
                        let lat = parseFloat(veiculo.Latitude);
                        let lng = parseFloat(veiculo.Longitude);

                        if (isNaN(lat) || isNaN(lng)) {

                            const local =
                                (veiculo.LOCAL_INSTALACAO || "")
                                    .toUpperCase();

                            if (local.startsWith("FEIT")) {

                                lat = -19.599252;
                                lng = -43.218690;

                            } else if (local.startsWith("FEMN")) {

                                lat = -20.376120;
                                lng = -43.416479;

                            } else if (local.startsWith("FEBR")) {

                                lat = -19.870131;
                                lng = -43.398402;

                            } else {

                                lat = -19.599252;
                                lng = -43.218690;
                            }
                        }

                        const textoResumo = Object.keys(resumo)
                            .sort()
                            .map(tipo =>
                                `${tipo}: ${resumo[tipo]}`
                            )
                            .join("\\n");

                        const textoResumoHtml =
                            textoResumo.replace(/'/g, "\\'");


                        const marker = L.marker(
                            [lat, lng],
                            {
                                icon: L.divIcon({
                                    className: "",
                                    html: `
                                                                                                    <div style="
                                    width:12px;
                                    height:12px;
                                    background:#9B6DFF;
                                    border:2px solid white;
                                    border-radius:50%;
                                    box-shadow:
                                        0 0 0 4px rgba(255,99,71,0.25),
                                        0 0 10px rgba(255,99,71,0.8);
                                "></div>
                                                                                                    `,
                                    iconSize: [22, 22],
                                    iconAnchor: [11, 11]
                                })
                            }
                        ).bindPopup(`
                <div id="imagemVeiculoPopup_${veiculo.Veiculo}" style="
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    font-size: 12px;
                    color: #1e293b;
                    padding: 6px;
                    background: #ffffff;
                ">
                    <!-- Header com Card da Imagem -->
                 <div id="cabecalho_${veiculo.Veiculo}" style="
                    position: relative;
                    text-align: center;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 8px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                ">
                    <img src="img/793D_default.png" alt="Veículo" style="
                        max-width: 100%;
                        height: auto;
                        max-height: 120px;
                        object-fit: contain;
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 8px;
                        padding: 4px 10px;
                    ">
                    <div style="
                        font-size: 13px;
                        font-weight: 700;
                        color: #0f172a;
                    ">
                        VEÍCULO ${veiculo.Veiculo}
                    </div>
                </div>


                    

                    <!-- Componentes de Accordion Modernizados -->
                    <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-bottom: 16px;">
                        
                        

                        <!-- Bloco Detalhes -->
                        <details id="detalhes_${veiculo.Veiculo}" data-veiculo="${veiculo.Veiculo}" style="
                            background: #f8fafc;
                            bor der-radius: 8px;
                            border: 1px solid #e2e8f0;
                            overflow: hidden;
                        ">
                            <summary style="cursor: pointer; font-weight: 600; font-size: 13px; padding: 10px 14px; color: #475569; user-select: none; outline: none;">
                                🔍 Ver Detalhes
                            </summary>
                            <div style="padding: 12px; border-top: 1px solid #e2e8f0; background: #ffffff;">
                                <div id="conteudoDetalhes_${veiculo.Veiculo}" style="
                                    max-height: 240px; 
                                    overflow-y: auto; 
                                    font-size: 13px; 
                                    font-weight: 600;   
                                    line-height: 1.5;
                                    margin-bottom: 14px;
                                    padding-right: 4px;
                                ">
                                <div style="
                    background:#f8fafc;
                    border:1px solid #e2e8f0;
                    border-radius:8px;
                    padding:10px;
                    margin-bottom:12px;
                    font-size:12px;
                ">

                    <div>
                        <b>Local de Instalação:</b>
                        ${veiculo.LOCAL_INSTALACAO || "Não informado"}
                    </div>

                    

                </div>

                ${htmlDetalhes}
                                </div>

                                <!-- Botões de Ação Alinhados Lado a Lado (Padrão Fiori-like) -->
                                <div style="display: flex; gap: 8px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                                    <button id="btnCopiarVeiculo_${veiculo.Veiculo}" style="
                                        flex: 1;
                                        display: inline-flex;
                                        align-items: center;
                                        justify-content: center;
                                        gap: 6px;
                                        background-color: #f1f5f9;
                                        color: #334155;
                                        border: 1px solid #cbd5e1;
                                        padding: 9px 12px;
                                        border-radius: 6px;
                                        font-size: 13px;
                                        font-weight: 600;
                                        cursor: pointer;
                                        transition: background 0.15s ease;
                                    " onmouseover="this.style.backgroundColor='#e2e8f0'" onmouseout="this.style.backgroundColor='#f1f5f9'">
                                        📋 Copiar
                                    </button>

                                    <button id="btnExportar_${veiculo.Veiculo}" style="
                                        flex: 1;
                                        display: inline-flex;
                                        align-items: center;
                                        justify-content: center;
                                        gap: 6px;
                                        background-color: #10b981;
                                        color: #ffffff;
                                        border: none;
                                        padding: 9px 12px;
                                        border-radius: 6px;
                                        font-size: 12px;
                                        font-weight: 600;
                                        cursor: pointer;
                                        transition: background 0.15s ease;
                                    " onmouseover="this.style.backgroundColor='#059669'" onmouseout="this.style.backgroundColor='#10b981'">
                                        📊 Exportar
                                    </button>
                                </div>
                            </div>
                        </details>
                        
                    </div>
                        <div style="
                            margin-top:12px;
                            padding-top:10px;
                            border-top:1px solid #e5e7eb;
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            font-size:12px;
                        ">
                            <span style="
                                color:#94a3b8;
                                font-weight:500;
                            ">
                                Última atualização:
                            </span>

                            <span style="
                                color:#475569;
                                font-weight:600;
                            ">
                               ${veiculo.DataAtualizacao
                                ? new Date(veiculo.DataAtualizacao)
                                    .toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                    .replace(',', '')
                                : 'Sem registro'}
                            </span>
                        </div>                      
                        `, {
                            minWidth: 350,
                            maxWidth: 350
                        });

                        this._veiculoMarkers =
                            this._veiculoMarkers || {};

                        this._veiculoMarkers[
                            veiculo.Veiculo
                        ] = marker;

                        marker.on("click", (e) => {
                            if (this._modoMedicao) {
                                this.processarMedicao(lat, lng, veiculo.Veiculo);
                                e.target.closePopup();
                            }
                        });

                        markers.addLayer(marker);

                        // Ciclo de vida interno quando o Popup é renderizado em tela
                        marker.on("popupopen", () => {
                            const resumo = document.getElementById(`resumo_${veiculo.Veiculo}`);
                            const detalhes = document.getElementById(`detalhes_${veiculo.Veiculo}`);

                            if (resumo) {
                                resumo.addEventListener("toggle", () => {
                                    if (resumo.open) {
                                        this.centralizarPopup(marker);
                                    }
                                });
                            }

                            if (detalhes) {

                                detalhes.addEventListener("toggle", () => {

                                    const cabecalho = document.getElementById(
                                        `cabecalho_${veiculo.Veiculo}`
                                    );

                                    if (!cabecalho) {
                                        return;
                                    }

                                    if (detalhes.open) {

                                        cabecalho.style.display = "none";

                                        this.centralizarPopup(marker);

                                    } else {

                                        cabecalho.style.display = "flex";

                                    }

                                });

                            }

                            setTimeout(() => {
                                const btnCopiar = document.getElementById(`btnCopiarVeiculo_${veiculo.Veiculo}`);
                                if (btnCopiar) {
                                    btnCopiar.onclick = () => {
                                        const texto = `
                Veículo: ${veiculo.Veiculo}
                Local de Instalação: ${veiculo.LOCAL_INSTALACAO || "Não informado"}

                Resumo:
                ${textoResumo}
                `.trim();

                                        navigator.clipboard.writeText(texto);
                                        sap.m.MessageToast.show("Informações do veículo copiadas.");
                                    };
                                }

                                const btn = document.getElementById(`btnExportar_${veiculo.Veiculo}`);
                                if (!btn) return;

                                btn.onclick = async () => {
                                    const response = await fetch(
                                        `http://10.44.32.193:4000/StatusComponentes/veiculo?local=${encodeURIComponent(veiculo.LOCAL_INSTALACAO)}`
                                    );
                                    const dadosExcel = await response.json();

                                    const oSpreadsheet = new Spreadsheet({
                                        workbook: {
                                            columns: [
                                                { label: "Status", property: "status" },
                                                { label: "Equipamento", property: "equipamento" },
                                                { label: "Descrição", property: "descricao" },
                                                { label: "Local Instalação", property: "localInstalacao" }
                                            ]
                                        },
                                        dataSource: dadosExcel,
                                        fileName: `Veiculo_${veiculo.Veiculo}.xlsx`
                                    });

                                    oSpreadsheet.build().finally(() => oSpreadsheet.destroy());
                                };
                            }, 100);
                        });

                        // Atualização de limites no mapa baseado nas coordenadas coletadas
                        bounds.push([lat, lng]);
                    });

                    // Notificações e processamento de Equipamentos

                    equipamentos.forEach(item => {
                        bounds.push([
                            parseFloat(item.latitude),
                            parseFloat(item.longitude)
                        ]);
                    });


                    gateways.forEach(gw => {


                        const lat = parseFloat(gw.latitude);
                        const lng = parseFloat(gw.longitude);

                        if (isNaN(lat) || isNaN(lng)) {
                            return;
                        }

                        const marker = L.marker(
                            [lat, lng],
                            {
                                icon: L.divIcon({
                                    className: "",
                                    html: `
                                                                                                                <div style="
                                        width:12px;
                                        height:12px;
                                        background:#3498db;
                                        border:2px solid white;
                                        border-radius:50%;
                                        box-shadow:
                                            0 0 0 3px rgba(52,152,219,0.25),
                                            0 0 8px rgba(52,152,219,0.8);
                                    "></div>
                                                                                                                `,
                                    iconSize: [22, 22],
                                    iconAnchor: [11, 11]
                                })
                            }
                        )


                            .bindPopup(`
                                                                                                                <b>${gw.identificador}</b><br>
                                                                                                                    Gateway ID: ${gw.gatewayId}<br>
                                                                                                                        Localidade: ${gw.localidade}<br>
                                                                                                                            Condição: ${gw.condicao}
                                                                                                                            `);

                        marker.on("click", (e) => {

                            if (this._modoMedicao) {

                                this.processarMedicao(
                                    lat,
                                    lng,
                                    gw.identificador
                                );

                                e.target.closePopup();
                            }

                        });

                        this._gatewayMarkers[gw.gatewayId] = marker;

                        this._gatewayInfo[gw.gatewayId] = {
                            identificador: gw.identificador,
                            localidade: gw.localidade,
                            condicao: gw.condicao
                        };

                        gatewaysLayer.addLayer(marker);

                    });
                    this._map.addLayer(markers);
                    this._map.addLayer(gatewaysLayer);


                    // if (this._primeiraCargaMapa) {


                    //     this._primeiraCargaMapa = false;

                    // }

                    if (this._busyDialog) {
                        this._busyDialog.close();
                    }

                    this.byId("idDashboardPage").setBusy(false);

                    setTimeout(() => {

                        const oPage = this.byId("idDashboardPage");

                        if (oPage && oPage.scrollTo) {
                            oPage.scrollTo(0, 0);
                        }

                    }, 300);

                }, 1000);


            },
            processarMedicao(
                lat,
                lng,
                descricao
            ) {

                if (!this._modoMedicao) {
                    return;
                }

                this._pontosMedicao.push({
                    lat,
                    lng,
                    descricao
                });

                if (
                    this._pontosMedicao.length < 2
                ) {
                    return;
                }

                const p1 =
                    this._pontosMedicao[0];

                const p2 =
                    this._pontosMedicao[1];

                const distancia =
                    this._map.distance(
                        [p1.lat, p1.lng],
                        [p2.lat, p2.lng]
                    );

                if (this._linhaMedicao) {

                    this._map.removeLayer(
                        this._linhaMedicao
                    );

                }

                this._linhaMedicao = L.polyline(
                    [
                        [p1.lat, p1.lng],
                        [p2.lat, p2.lng]
                    ],
                    {
                        color: "red",
                        weight: 4
                    }
                ).addTo(this._map);

                const meioLat =
                    (p1.lat + p2.lat) / 2;

                const meioLng =
                    (p1.lng + p2.lng) / 2;

                L.popup()
                    .setLatLng([
                        meioLat,
                        meioLng
                    ])
                    .setContent(`
                                                                                                                                <b>
                                                                                                                                    ${(distancia / 1000)
                            .toFixed(2)} km
                                                                                                                                </b>
                                                                                                                                `)
                    .openOn(this._map);

                this._pontosMedicao = [];

            },
            calcularDistanciaMetros(
                lat1,
                lon1,
                lat2,
                lon2
            ) {

                return this._map.distance(
                    [lat1, lon1],
                    [lat2, lon2]
                );

            },

            piscarGateway(marker) {

                const elemento = marker.getElement();

                if (!elemento) {
                    return;
                }

                let contador = 0;

                const intervalo = setInterval(() => {

                    elemento.style.opacity =
                        elemento.style.opacity === "0.2"
                            ? "1"
                            : "0.2";

                    contador++;

                    if (contador >= 8) {

                        clearInterval(intervalo);

                        elemento.style.opacity = "1";

                    }

                }, 250);

            },
            formatarStatusGrupo(grupoAtual) {


                if (
                    grupoAtual &&
                    grupoAtual.toUpperCase().includes("REFORMADO")
                ) {
                    return "Warning";
                }

                return "None";

            },
            onIrMariana() {
                if (this._oDialogLocalidades) {
                    this._oDialogLocalidades.close();
                }
                const oMapa = this._map;

                if (!oMapa) {
                    return;
                }

                oMapa.setView(
                    [-20.377, -43.416],
                    14
                );

            },
            onIrItabira() {
                if (this._oDialogLocalidades) {
                    this._oDialogLocalidades.close();
                }

                if (this._map) {

                    this._map.setView(
                        [-19.641510, -43.226143],
                        13
                    );

                }

            },

            onIrBrucutu() {
                if (this._oDialogLocalidades) {
                    this._oDialogLocalidades.close();
                }
                if (this._map) {

                    this._map.setView(
                        [-19.870131, -43.398402],
                        13
                    );

                }

            },

            onIrPico() {
                if (this._oDialogLocalidades) {
                    this._oDialogLocalidades.close();
                }
                if (this._map) {

                    this._map.setView(
                        [-20.217185, -43.864846],
                        13
                    );

                }

            },

            onIrVespasiano() {
                if (this._oDialogLocalidades) {
                    this._oDialogLocalidades.close();
                }
                if (this._map) {

                    this._map.setView(
                        [-19.708129, -43.903523],
                        13
                    );

                }

            },
            converterDataBr(dataStr) {

                if (!dataStr) {
                    return new Date(0);
                }

                return new Date(dataStr);

            }
        }
    );
});