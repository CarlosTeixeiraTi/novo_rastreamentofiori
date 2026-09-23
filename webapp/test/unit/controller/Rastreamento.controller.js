/*global QUnit*/

sap.ui.define([
	"br/com/smartpcm/rastreamento/zrastreio/controller/Rastreamento.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Rastreamento Controller");

	QUnit.test("I should test the Rastreamento controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
