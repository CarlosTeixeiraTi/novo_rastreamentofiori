sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/ui/model/json/JSONModel"
], function (Controller, MessageBox, BusyIndicator, JSONModel) {
    "use strict";

    return Controller.extend("br.com.smartpcm.rastreamento.zrastreio.controller.Login", {

        onInit: function () {
            // Inicialização da tela se necessário
        },

        onEntrarPress: function () {
            var that = this;
            var usuario = this.byId("idUsuario").getValue().trim();
            var senha = this.byId("idSenha").getValue();

            if (!usuario || !senha) {
                MessageBox.warning("Informe usuário e senha.");
                return;
            }

            BusyIndicator.show(0);

            fetch("http://10.44.32.193:4000/Usuario/login", {

                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    USUARIO: usuario,
                    SENHA: senha
                })
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (dados) {

                    if (!dados.sucesso) {

                        MessageBox.error(
                            dados.mensagem ||
                            "Usuário ou senha inválidos."
                        );

                        BusyIndicator.hide();

                        return;
                    }

                    var oComponent = that.getOwnerComponent();

                    oComponent.setModel(
                        new JSONModel({
                            usuario: dados.USUARIO,
                            perfil: dados.PERFIL
                        }),
                        "usuarioLogado"
                    );

                    sessionStorage.setItem(
                        "usuario",
                        dados.USUARIO
                    );

                    sessionStorage.setItem(
                        "perfil",
                        dados.PERFIL
                    );

                    BusyIndicator.hide();

                    var oRouter = that.getOwnerComponent().getRouter();

                    if ((dados.PERFIL || "").toUpperCase() === "VISUALIZADOR") {
                        oRouter.navTo("RouteRastreamento2");
                    } else {
                        oRouter.navTo("RouteRastreamento");
                    }


                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    MessageBox.error("Erro ao conectar ao servidor.");
                });
        }
    });
})
