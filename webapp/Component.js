sap.ui.define([
    "sap/ui/core/UIComponent",
    "br/com/smartpcm/rastreamento/zrastreio/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend(
        "br.com.smartpcm.rastreamento.zrastreio.Component",
        {
            metadata: {
                manifest: "json",
                interfaces: [
                    "sap.ui.core.IAsyncContentCreation"
                ]
            },

            init() {

                UIComponent.prototype.init.apply(
                    this,
                    arguments
                );

                this.setModel(
                    models.createDeviceModel(),
                    "device"
                );

                this.getRouter().initialize();

            }
        }
    );

});