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
        "br.com.smartpcm.rastreamento.zrastreio.controller.Rastreamento",
        {
            onInit() {

                this._busyDialog = new BusyDialog({
                    title: "Carregando",
                    text: "Reconstruindo mapa..."
                });

                this._busyMapaInicial = new BusyDialog({
                    title: "Carregando",
                    text: "Montando mapa..."
                });

                this._primeiraCargaMapa = true;

                this.resumoTipoStatus = [];

                const oDashboardModel = new JSONModel({
                    totalEquipamentos: 0,
                    online: 0,
                    offline: 0,
                    gateways: 0,
                    grupos: [],
                    ultimasLeituras: [],
                    dashboardVeiculos: [],
                    resumoFrotas: []
                });

                this.getView().setModel(
                    oDashboardModel,
                    "dashboard"
                );

                this._grupoSelecionado = null;

                // this.carregarDashboard();
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

                if (perfil === "DESENVOLVEDOR") {
                    return;
                }

                this.byId("tabDashboard").setVisible(false);
                this.byId("tabInformacoes").setVisible(false);
                this.byId("tabValorGerado").setVisible(false);
                this.byId("tabAtualizacao").setVisible(false);
            },
            onAfterRendering() {
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

                        mina = "SOTREQ";

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
                    " rastreadores para atingir 100% da cobertura planejada do piloto.",

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
                    " gateways para concluir a infraestrutura RFID prevista para o piloto.",

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

                            "Considera os componentes que apresentaram comunicação nos últimos 7 dias. Componentes localizados fora da área operacional FEIT são considerados disponíveis, pois não estão sob cobertura esperada da infraestrutura RFID de Itabira.<br><br>" +

                            "<strong>" +
                            formula +
                            "</strong><br><br>" +

                            "<strong>Por que é importante?</strong><br><br>" +

                            "Demonstra a capacidade real da solução de monitorar continuamente os componentes do piloto, considerando apenas indisponibilidades que efetivamente podem ser atribuídas à infraestrutura monitorada."
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

                    "Quantidade de componentes que apresentaram pelo menos uma mudança de localização durante o período do piloto.\n\n" +

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

                            "Percentual da meta de implantação efetivamente alcançada durante o piloto.<br><br>" +

                            "<strong>Como é calculado?</strong><br><br>" +

                            "Relação entre a quantidade de componentes monitorados e a meta planejada para o piloto.<br><br>" +

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
            onButtonAjudaIndiceEfetividadePress() {

                const disponibilidade =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/disponibilidadeMonitoramento");

                const cobertura =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/coberturaValorGerado");

                const consistencia =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/percentualConsistenciaMovimentacao");


                const gateways =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/percentualGateway");

                const indice =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/indiceEfetividade");

                const oDialog = new sap.m.Dialog({
                    title: "Índice Geral de Efetividade",
                    contentWidth: "650px",

                    content: new sap.m.FormattedText({
                        htmlText:
                            "<strong>O que mede?</strong><br><br>" +

                            "Consolida os principais resultados do piloto em uma única métrica de desempenho.<br><br>" +

                            "<strong>Como é calculado?</strong><br><br>" +

                            "Combina os indicadores de Disponibilidade de Monitoramento, Cobertura do Piloto, Consistência das movimentações e Disponibilidade de Gateways, aplicando pesos conforme sua relevância para o resultado do piloto.<br><br>" +

                            "<strong>Fórmula:</strong><br><br>" +

                            "Disponibilidade (" + disponibilidade + "% × 50%) + " +
                            "Cobertura (" + cobertura + "% × 25%) + " +
                            "Consistência (" + consistencia + "% × 15%) + " +
                            "Gateways (" + gateways + "% × 10%) = " +
                            "<strong>" + indice + "%</strong><br><br>" +

                            "<strong>Por que é importante?</strong><br><br>" +

                            "Permite uma avaliação rápida da efetividade global da solução, resumindo os principais benefícios alcançados durante o piloto."
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

                const resumoGrupoAtual =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/resumoGrupoAtual");

                const resumoEquipamentos =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/resumoEquipamentos");

                const total =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/totalEquipamentos");

                let html = "";

                html +=
                    "<b>Componentes rastreados:</b> " +
                    total +
                    "<br><br>";

                html +=
                    "<b>Distribuição por fase</b><br>" +
                    "─────────────────────<br>";

                resumoGrupoAtual.forEach(item => {

                    html +=
                        item.grupo +
                        ": " +
                        item.quantidade +
                        "<br>";

                });

                html +=
                    "<br><b>Principais famílias</b><br>" +
                    "─────────────────────<br>";

                resumoEquipamentos
                    .filter(item => item.familia !== "TOTAL")
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5)
                    .forEach(item => {

                        html +=
                            item.familia +
                            ": " +
                            item.total +
                            "<br>";

                    });

                const oDialog = new sap.m.Dialog({
                    title: "Resumo dos Componentes",
                    contentWidth: "650px",

                    content: new sap.m.FormattedText({
                        htmlText: html
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

                            "Avalia o percentual de gateways previstos para o piloto que estão efetivamente ativos e contribuindo para a cobertura da infraestrutura RFID.<br><br>" +

                            "<strong>Como é calculado?</strong><br><br>" +

                            "Compara a quantidade de gateways ativos identificados no ambiente com a quantidade total planejada para o piloto.<br><br>" +

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

                            "Avalia a aderência entre a localização operacional cadastrada e a última movimentação detectada pela infraestrutura RFID de Itabira.<br><br>" +

                            "<strong>Como é calculado?</strong><br><br>" +

                            "Considera apenas rastreadores online (última atualização nos últimos 7 dias). Um rastreador é considerado consistente quando sua localização cadastrada está compatível com a área operacional onde foi detectado.<br><br>" +

                            "<strong>" +
                            consistentes +
                            " movimentações consistentes ÷ " +
                            online +
                            " rastreadores online × 100 = " +
                            percentual +
                            "%</strong><br><br>" +

                            "<strong>Por que é importante?</strong><br><br>" +

                            "Permite identificar divergências entre a localização física dos componentes e os registros operacionais, aumentando a confiabilidade das informações utilizadas para gestão e rastreabilidade."
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

                    grupo = "Reforma externa";

                } else if (
                    (
                        descLocal.includes("EMREF") ||
                        descLocal.includes("REFORMA")
                    ) &&
                    !descLocal.includes("EXT")
                ) {

                    grupo = "Reforma interna";

                }

                return grupo;

            },

            onPesquisarRastreador(oEvent) {

                const identificador =
                    oEvent.getParameter("query")
                        .trim();

                if (!identificador) {
                    return;
                }

                const marker =
                    this._equipamentoMarkers?.[
                    identificador
                    ];

                if (!marker) {

                    sap.m.MessageToast.show(
                        "Rastreador não encontrado."
                    );

                    return;

                }

                this._map.setView(
                    marker.getLatLng(),
                    18
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
                    return "CONVERSOR DE TORQUE";
                }

                if (texto.startsWith("MOTOR")) {
                    return "MOTOR";
                }

                if (texto.startsWith("COMANDO FINAL")) {
                    return "COMANDO FINAL";
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
            onQuantidadeObjectListItemPress(oEvent) {

                const grupo =
                    oEvent.getSource()
                        .getBindingContext("dashboard")
                        .getObject()
                        .grupo;

                const dados =
                    this.getView()
                        .getModel("dashboard")
                        .getData();

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

                    this._map.fitBounds(bounds, {
                        padding: [50, 50],
                        maxZoom: 18
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

                    } else if (grupo === "Reforma interna") {

                        resumo[familia].reformaInterna++;

                    } else if (grupo === "Reforma externa") {

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
                                            `Erro ${response.status}`
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
                        `${item.fornecedor}|${item.frota}`;

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
                            `Instalado no ${veiculo}`
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
                            + `No mesmo veículo (${veiculo}), a atualização mais recente identificada ocorreu em `
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
                                `${item.localInstalacao || "Sem local"}`
                                + (item.gateway
                                    ? ` | Gateway: ${item.gateway}`
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
                        `Instalado no ${veiculoId}`
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
                            <div style="
                                display:flex;
                                align-items:center;
                                white-space:nowrap;
                            ">

                                <div style="
                                    width:18px;
                                    height:18px;
                                    background:#95a5a6;
                                    border-radius:50%;
                                    border:3px solid white;
                                    box-shadow:0 0 6px rgba(0,0,0,.5);
                                ">
                                </div>

                                <span style="
                                    margin-left:6px;
                                    color:white;
                                    font-weight:bold;
                                    font-size:14px;
                                    text-shadow:
                                        2px 2px 4px black;
                                ">
                                    ${texto}
                                </span>

                            </div>
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
                if (zoom <= 14) {

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
                if (zoom >= 14) {

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
                if (zoom >= 14) {

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
                        this.normalizarGrupo(
                            item.descEquipamento
                        );

                    if (!tipo || tipo === "OUTROS") {
                        return;
                    }

                    let status =
                        this.determinarGrupo(item);

                    if (
                        status &&
                        status.startsWith("Instalado no ")
                    ) {
                        status = "Instalado";
                    }

                    const chave =
                        `${tipo}|${status}`;

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
                            `Erro ${response.status}`
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
                            `Erro ${response.status}`
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

                    sap.ui.core.BusyIndicator.hide();

                }

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

                if (this._primeiraCargaMapa) {
                    this._busyMapaInicial.open();
                }

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

                const resumoTipoStatus =
                    this.gerarGraficoTipoStatus(
                        dadosFiltrados
                    );
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
                            local.startsWith("FEIT") &&
                            item.grupoAtual ===
                            "Tags Digitais desatualizadas"
                        ) {
                            offlineFeitDesatualizados++;
                        }

                        if (
                            !local.startsWith("FEIT") &&
                            (
                                !item.grupoAtual ||
                                !item.grupoAtual.startsWith("Instalado no ")
                            )
                        ) {
                            offlineForaItabira++;
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


                const distribuicaoImplantacao =
                    this.gerarDistribuicaoImplantacao(
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
                            `Instalado no ${veiculo.Veiculo}`
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

                        conferencia,

                        status: divergente
                            ? "Divergente"
                            : "Conforme",

                        state: divergente
                            ? "Error"
                            : "Success"

                    });


                }
                const graficoTipoStatus =
                    this.gerarGraficoTipoStatus(
                        dadosFiltrados
                    );
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

                if (Number(valorGerado.cobertura) < 100) {

                    oportunidadesMelhoria.push({
                        tipo: "cobertura",
                        texto:
                            "Concluir a instalação dos rastreadores pendentes para atingir 100% da cobertura planejada.",
                        state: "Warning"
                    });

                }

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
                            "Todas as metas operacionais do piloto foram atingidas.",
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
                    .getModel("dashboard")
                    .setData({

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
                            valorGerado.indiceEfetividade,

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
                            distribuicaoImplantacao
                    }
                    );
                const oVizFrame =
                    this.byId("idTipoStatusVizFrame");

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
                            dataLabel: {
                                visible: true,
                                style: {
                                    fontSize: "16px",
                                    fontWeight: "bold"
                                }
                            }
                        },

                        legend: {
                            title: {
                                visible: false
                            }
                        },

                        title: {
                            visible: false
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
                            dataLabel: {
                                visible: true,
                                style: {
                                    fontSize: "16px",
                                    fontWeight: "bold"
                                }
                            }
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
        style="height:1220px;width:100%;">
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

                    const labels = L.tileLayer(
                        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    );

                    this._map = L.map("mapaEquipamentos", {
                        layers: [satelite]
                    });
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

                        const latitude = e.latlng.lat.toFixed(6);
                        const longitude = e.latlng.lng.toFixed(6);

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

                    });
                    this._layerLabels = L.layerGroup().addTo(this._map);

                    this.atualizarLabels();

                    this._map.on("zoomend", () => {

                        this.atualizarLabels();

                        const zoom = this._map.getZoom();
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



                    // this._layerCidades = L.layerGroup();

                    // L.marker([-19.6191, -43.2266], {
                    //     opacity: 0
                    // })
                    //     .bindTooltip("ITABIRA", {
                    //         permanent: true,
                    //         direction: "center",
                    //         className: "cityLabel"
                    //     })
                    //     .addTo(this._layerCidades);

                    // L.marker([-19.8123, -43.1735], {
                    //     opacity: 0
                    // })
                    //     .bindTooltip("JOÃO MONLEVADE", {
                    //         permanent: true,
                    //         direction: "center",
                    //         className: "cityLabel"
                    //     })
                    //     .addTo(this._layerCidades);

                    // const atualizarCamadas = () => {

                    //     const zoom = this._map.getZoom();

                    //     if (zoom >= 13) {

                    //         if (!this._map.hasLayer(this._layerCidades)) {
                    //             this._map.addLayer(this._layerCidades);
                    //         }

                    //     } else {

                    //         if (this._map.hasLayer(this._layerCidades)) {
                    //             this._map.removeLayer(this._layerCidades);
                    //         }

                    //     }
                    // };

                    // atualizarCamadas();

                    // this._map.on("zoomend", atualizarCamadas);

                    // this._layerCidades.addTo(this._map);
                    const botaoMedir = L.control({
                        position: "topleft"
                    });

                    botaoMedir.onAdd = () => {

                        const div =
                            L.DomUtil.create("div");

                        div.innerHTML = `
                                <button
                                    style="
                                        background:white;
                                        border:1px solid #ccc;
                                        padding:8px;
                                        cursor:pointer;
                                        font-size:16px;
                                        font-weight:bold;
                                    ">
                                    📏 Medir
                                </button>
                            `;
                        div.onclick = () => {

                            this._modoMedicao =
                                !this._modoMedicao;

                            this._pontosMedicao = [];

                            if (this._linhaMedicao) {

                                this._map.removeLayer(
                                    this._linhaMedicao
                                );

                                this._linhaMedicao = null;

                            }

                            sap.m.MessageToast.show(

                                this._modoMedicao
                                    ? "Modo medição ativado"
                                    : "Modo medição desativado"

                            );

                        };

                        return div;

                    };

                    botaoMedir.addTo(this._map);
                    setTimeout(() => {
                        this._map.invalidateSize();
                    }, 200);
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

                    setTimeout((a) => {

                        const controleLayers =
                            document.querySelector(".leaflet-control-layers");

                        if (controleLayers) {

                            controleLayers.style.width = "200px";

                            controleLayers.style.fontSize = "20px";

                            const labels =
                                controleLayers.querySelectorAll("label");

                            labels.forEach(label => {
                                label.style.fontSize = "20px";
                                label.style.lineHeight = "24px";
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
                        div.style.fontSize = "20px";
                        div.style.lineHeight = "20px";
                        div.style.width = "200px";
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
                            "width:8px;" +
                            "height:8px;" +
                            "background:#2ecc71;" +
                            "border:3px solid white;" +
                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(46,204,113,0.25),0 0 10px rgba(46,204,113,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Online<br>" +

                            "<span style='display:inline-block;" +
                            "width:8px;" +
                            "height:8px;" +
                            "background:#f1c40f;" +
                            "border:3px solid white;" +
                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(241,196,15,0.25),0 0 10px rgba(241,196,15,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Offline<br>" +

                            "<span style='display:inline-block;" +
                            "width:8px;" +
                            "height:8px;" +
                            "background:#3498db;" +
                            "border:3px solid white;" +
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
                            "width:8px;" +
                            "height:8px;" +
                            "background:#9B6DFF;" +
                            "border:3px solid white;" +
                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(155,109,255,0.25),0 0 10px rgba(155,109,255,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Instalados";

                        return div;
                    };

                    legenda.addTo(this._map);
                    // const cidades = L.control({ position: 'topright' });

                    //                     cidades.onAdd = () => {
                    //                         const div = L.DomUtil.create('div', 'map-cities');

                    //                         div.style.background = 'white';
                    //                         div.style.padding = '6px 8px';
                    //                         div.style.borderRadius = '6px';
                    //                         div.style.boxShadow = '0 1px 6px rgba(0,0,0,.4)';
                    //                         div.style.fontSize = '20px';
                    //                         div.style.lineHeight = '30px';
                    //                         div.style.width = '200px';
                    //                         div.style.color = '#333';
                    //                         div.style.marginTop = '6px';
                    //                         const htmlVeiculos = veiculos
                    //                             .filter(v => v.Veiculo)
                    //                             .sort((a, b) => a.Veiculo.localeCompare(b.Veiculo))
                    //                             .map(v =>
                    //                                 `<a            ${v.Veiculo}
                    //         </a><br>`
                    //                             )
                    //                             .join("");
                    //                         div.innerHTML = `
                    //     <div style="font-weight:bold; margin-bottom:4px; text-align:center; border-bottom:1px solid #ddd;">
                    //         Cidades (MG)
                    //     </div>

                    //     <a href="#" id="cidadeItabira">Itabira</a><br>
                    //     <a href="#" id="cidadeItabirito">Itabirito</a><br>
                    //     <a href="#" id="cidadeSaoGoncalo">São Gonçalo</a><br>
                    //     <a href="#" id="cidadeVespasiano">Vespasiano</a>

                    //     <div style="font-weight:bold; margin-top:8px; margin-bottom:4px; text-align:center; border-top:1px solid #ddd; padding-top:4px;">
                    //         Minas
                    //     </div>

                    //     <a href="#" id="minaCaue">Cauê</a><br>
                    //     <a href="#" id="minaConceicao">Conceição</a><br>
                    //     <a href="#" id="minaPeriquito">Periquito</a><br>
                    //     <a href="#" id="minaAlegria">Alegria</a><br>
                    //     <a href="#" id="minaPico">Pico</a><br>
                    //     <a href="#" id="minaBrucutu">Brucutu</a>
                    // `;

                    //                         const tituloVeiculos = document.createElement("div");

                    //                         tituloVeiculos.style.fontWeight = "bold";
                    //                         tituloVeiculos.style.marginTop = "8px";
                    //                         tituloVeiculos.style.marginBottom = "4px";
                    //                         tituloVeiculos.style.textAlign = "center";
                    //                         tituloVeiculos.style.borderTop = "1px solid #ddd";
                    //                         tituloVeiculos.style.paddingTop = "4px";

                    //                         tituloVeiculos.textContent = "Veículos";

                    //                         div.appendChild(tituloVeiculos);

                    //                         veiculos
                    //                             .filter(v => v.Veiculo)
                    //                             .sort((a, b) => a.Veiculo.localeCompare(b.Veiculo))
                    //                             .forEach(v => {

                    //                                 const link = document.createElement("a");

                    //                                 link.id = "veiculo_" + v.Veiculo;
                    //                                 link.href = "#";
                    //                                 link.textContent = v.Veiculo;

                    //                                 div.appendChild(link);
                    //                                 div.appendChild(document.createElement("br"));

                    //                             });
                    //                         L.DomEvent.disableClickPropagation(div);

                    //                         setTimeout(() => {
                    //                             document.getElementById('cidadeItabira')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-19.641510, -43.226143],
                    //                                         13
                    //                                     );

                    //                                 });
                    //                             document.getElementById('cidadeItabirito')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-20.217717, -43.864048],
                    //                                         15
                    //                                     );

                    //                                 });

                    //                             document.getElementById('cidadeSaoGoncalo')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-19.857575, -43.389106],
                    //                                         13
                    //                                     );

                    //                                 });
                    //                             document.getElementById('cidadeVespasiano')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-19.708129, -43.903523],
                    //                                         15
                    //                                     );

                    //                                 });
                    //                             document.getElementById('minaCaue')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-19.599252, -43.218690],
                    //                                         15
                    //                                     );

                    //                                 });

                    //                             document.getElementById('minaConceicao')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-19.657580, -43.269398],
                    //                                         15
                    //                                     );

                    //                                 });

                    //                             document.getElementById('minaPeriquito')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-19.632715, -43.254261],
                    //                                         15
                    //                                     );

                    //                                 });

                    //                             document.getElementById('minaAlegria')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-20.163679, -43.501025],
                    //                                         15
                    //                                     );

                    //                                 });

                    //                             document.getElementById('minaPico')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-20.217185, -43.864846],
                    //                                         15
                    //                                     );

                    //                                 });

                    //                             document.getElementById('minaBrucutu')
                    //                                 ?.addEventListener('click', (e) => {

                    //                                     e.preventDefault();

                    //                                     this._map.setView(
                    //                                         [-19.870131, -43.398402],
                    //                                         15
                    //                                     );

                    //                                 });
                    //                             veiculos.forEach(v => {

                    //                                 document
                    //                                     .getElementById("veiculo_" + v.Veiculo)
                    //                                     ?.addEventListener("click", (e) => {

                    //                                         e.preventDefault();

                    //                                         const lat = parseFloat(v.Latitude);
                    //                                         const lng = parseFloat(v.Longitude);

                    //                                         if (isNaN(lat) || isNaN(lng)) {
                    //                                             return;
                    //                                         }

                    //                                         this._map.setView(
                    //                                             [lat, lng],
                    //                                             17
                    //                                         );

                    //                                      });

                    //                             });
                    //                         }, 100);

                    //                         return div;
                    //                     };

                    //                     cidades.addTo(this._map);

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
                            imagemEquipamento = "img/MOTOR.png";
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
                                    width:16px;
                                    height:16px;
                                    background:#9B6DFF;
                                    border:3px solid white;
                                    border-radius:50%;
                                    box-shadow:
                                        0 0 0 4px rgba(155,109,255,0.25),
                                        0 0 10px rgba(155,109,255,0.8);
                                "></div>
                            `
                                        : `
                                <div style="
                                    width:16px;
                                    height:16px;
                                    background:${cor};
                                    border:3px solid white;
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
    padding: 4px;
    background: #ffffff;
    min-width: 300px;
    max-width: 360px;
">
    <!-- Container da Imagem -->
    <div style="
        text-align: center;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
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
    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
        <div style="font-size: 16px; color: #0f172a; font-weight: 700; margin-bottom: 2px;">
            ${item.identificador}
        </div>
        
        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Equipamento</span>
            <span style="font-size: 13px; color: #334155; font-weight: 500;">${item.descEquipamento || 'Não informado'}</span>
        </div>

        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Local</span>
            <span style="font-size: 13px; color: #334155; font-weight: 500;">${item.localInstalacao || 'Não informado'}</span>
        </div>

        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Nota</span>
            <span style="font-size: 13px; color: #334155; font-weight: 500;">${item.nota || 'Não informado'}</span>
        </div>

        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">📡 Gateway</span>
            <span style="font-size: 13px; color: #0284c7; font-weight: 600;">${descricaoGateway || item.gateway || "Não informado"}</span>
        </div>
    </div>

    <!-- Seção Expansível de Detalhes -->
    <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-bottom: 16px;">
        <details style="
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
        ">
            <summary style="cursor: pointer; font-weight: 600; font-size: 13px; padding: 10px 12px; color: #475569; user-select: none; outline: none;">
                🔍 Ver detalhes
            </summary>
            <div style="padding: 12px; border-top: 1px solid #e2e8f0; background: #ffffff; font-size: 13px; display: flex; flex-direction: column; gap: 8px; line-height: 1.4;">
                <div><b style="color: #64748b;">Grupo:</b> <span style="color: #1e293b;">${item.grupoAtual || 'Não informado'}</span></div>
                <div><b style="color: #64748b;">Descrição do Local:</b> <span style="color: #1e293b;">${item.descLocalInstalacao || 'Não informado'}</span></div>
                <div><b style="color: #64748b;">Centro de Trabalho:</b> <span style="color: #1e293b;">${item.centro_trab_resp || 'Não informado'}</span></div>
                <div><b style="color: #64748b;">Centro de Localização:</b> <span style="color: #1e293b;">${item.centro_localizacao || 'Não informado'}</span></div>
                <div><b style="color: #64748b;">Oficina:</b> <span style="color: #1e293b;">${item.oficina || 'Não informado'}</span></div>
            </div>
        </details>
    </div>

    <!-- Ações e Rodapé -->
    <div style="display: flex; flex-direction: column; gap: 12px;">
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

        <div style="
            padding-top: 10px;
            border-top: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #94a3b8;
            font-size: 11px;
        ">
            <span>Última Atualização:</span>
            <span style="font-weight: 600; color: #64748b;">${item.ultimaPosicao || 'Sem registro'}</span>
        </div>
    </div>
</div>
`);

                        marker.on("popupopen", () => {

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
                                        Última Atualização: ${item.ultimaPosicao || ""}
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
                        const lat = parseFloat(veiculo.Latitude);
                        const lng = parseFloat(veiculo.Longitude);

                        if (isNaN(lat) || isNaN(lng)) {
                            return;
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
                                    width:16px;
                                    height:16px;
                                    background:#9B6DFF;
                                    border:3px solid white;
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
    font-size: 15px;
    color: #1e293b;
    padding: 6px;
    background: #ffffff;
">
    <!-- Header com Card da Imagem -->
    <div style="
        text-align: center;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        justify-content: center;
        align-items: center;
    ">
        <img src="img/793D_default.png" alt="Veículo" style="
            max-width: 100%;
            height: auto;
            max-height: 120px;
            object-fit: contain;
        " />
    </div>

    <!-- Informações Principais (Sem Quebras de Linha Brutas) -->
    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Veículo</span>
            <span style="font-size: 16px; color: #0f172a; font-weight: 700;">${veiculo.Veiculo}</span>
        </div>

        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Local de Instalação</span>
            <span style="font-size: 15px; color: #334155; font-weight: 500;">${veiculo.LOCAL_INSTALACAO || "Não informado"}</span>
        </div>

        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Equipamentos Embarcados</span>
            <span style="font-size: 15px; color: #334155; font-weight: 500;">${totalEquipamentos}</span>
        </div>
    </div>

    <!-- Componentes de Accordion Modernizados -->
    <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-bottom: 16px;">
        
        <!-- Bloco Resumo -->
        <details id="resumo_${veiculo.Veiculo}" data-veiculo="${veiculo.Veiculo}" style="
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
        ">
            <summary style="cursor: pointer; font-weight: 600; font-size: 15px; padding: 10px 14px; color: #475569; user-select: none; outline: none;">
                📝 Ver Resumo
            </summary>
            <div id="conteudoResumo_${veiculo.Veiculo}" style="padding: 15px; border-top: 1px solid #e2e8f0; background: #ffffff; font-size: 13px; line-height: 1.5;">
                ${htmlResumo}
            </div>
        </details>

        <!-- Bloco Detalhes -->
        <details id="detalhes_${veiculo.Veiculo}" data-veiculo="${veiculo.Veiculo}" style="
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
        ">
            <summary style="cursor: pointer; font-weight: 600; font-size: 15px; padding: 10px 14px; color: #475569; user-select: none; outline: none;">
                🔍 Ver Detalhes
            </summary>
            <div style="padding: 12px; border-top: 1px solid #e2e8f0; background: #ffffff;">
                <div id="conteudoDetalhes_${veiculo.Veiculo}" style="
                    max-height: 240px; 
                    overflow-y: auto; 
                    font-size: 15px; 
                    line-height: 1.5;
                    margin-bottom: 14px;
                    padding-right: 4px;
                ">
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
                        font-size: 15px;
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
                        font-size: 15px;
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

    <!-- Rodapé de Atualização Limpo -->
    <div style="
        padding-top: 10px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #94a3b8;
        font-size: 15px;
    ">
        <span>Última atualização:</span>
        <span style="font-weight: 600; color: #64748b;">
            ${new Date(veiculo.DataAtualizacao).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                        }).replace(",", "")}
        </span>
    </div>
</div>
`, {
                            minWidth: 350,
                            maxWidth: 450
                        });

                        // Eventos de clique do Leaflet Marker
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
                                    if (detalhes.open) {
                                        this.centralizarPopup(marker);
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
Equipamentos Embarcados: ${totalEquipamentos}

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
                    sap.m.MessageToast.show("Markers gateway: " + gatewaysLayer.getLayers().length);

                    equipamentos.forEach(item => {
                        bounds.push([
                            parseFloat(item.latitude),
                            parseFloat(item.longitude)
                        ]);
                    });

                    sap.m.MessageToast.show(
                        "Entrando no loop de gateways: " + gateways.length
                    );
                    gateways.forEach(gw => {

                        sap.m.MessageToast.show(
                            gw.identificador
                        );

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
                                        width:16px;
                                        height:16px;
                                        background:#3498db;
                                        border:3px solid white;
                                        border-radius:50%;
                                        box-shadow:
                                            0 0 0 5px rgba(52,152,219,0.25),
                                            0 0 12px rgba(52,152,219,0.8);
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

                    this._map.setView(
                        [-19.641510, -43.226143],
                        14
                    );
                    if (this._primeiraCargaMapa) {

                        this._busyMapaInicial.close();

                        this._primeiraCargaMapa = false;

                    }

                    if (this._busyDialog) {
                        this._busyDialog.close();
                    }

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
            onIrItabira() {

                if (this._map) {

                    this._map.setView(
                        [-19.641510, -43.226143],
                        13
                    );

                }

            },

            onIrBrucutu() {

                if (this._map) {

                    this._map.setView(
                        [-19.870131, -43.398402],
                        15
                    );

                }

            },

            onIrPico() {

                if (this._map) {

                    this._map.setView(
                        [-20.217185, -43.864846],
                        15
                    );

                }

            },

            onIrVespasiano() {

                if (this._map) {

                    this._map.setView(
                        [-19.708129, -43.903523],
                        15
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