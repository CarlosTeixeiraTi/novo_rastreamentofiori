/**
 * Quando um rastreador conta como mudo.
 *
 * Regra do cliente: componente instalado em veiculo fica em ponto cego de
 * gateway por dias sem que isso signifique nada — so alarma depois de
 * QUINZE dias sem leitura. Fora de veiculo, o limite continua sendo sete.
 *
 * No painel atual o limite e unico (7 dias, `ValorGerado.js:385`), o que
 * produz alarme falso em maquina em operacao.
 */
sap.ui.define(["./arvore"], function (arvore) {
	"use strict";

	var DIA_MS = 24 * 60 * 60 * 1000;

	return {
		LIMITE_INSTALADO_DIAS: 15,
		LIMITE_PADRAO_DIAS: 7,

		/** Limite em dias para este grupo. */
		limiteDe: function (grupoAtual) {
			return arvore.estaInstalado(grupoAtual)
				? this.LIMITE_INSTALADO_DIAS
				: this.LIMITE_PADRAO_DIAS;
		},

		/** Dias desde a ultima leitura. Infinity quando nunca comunicou. */
		diasDesde: function (instante, agora) {
			if (!instante) {
				return Infinity;
			}
			var ms = (agora || Date.now()) - new Date(instante).getTime();
			return isNaN(ms) ? Infinity : ms / DIA_MS;
		},

		avaliar: function (ultimaLeitura, grupoAtual, agora) {
			var dias = this.diasDesde(ultimaLeitura, agora);
			var limite = this.limiteDe(grupoAtual);
			return {
				dias: dias,
				limite: limite,
				mudo: dias > limite,
				instalado: arvore.estaInstalado(grupoAtual)
			};
		},

		/** Texto curto para a tela, sem inventar precisao. */
		descrever: function (dias) {
			if (dias === null || dias === undefined || !isFinite(dias)) {
				return "nunca comunicou";
			}
			var minutos = dias * 24 * 60;
			if (minutos < 1) { return "agora há pouco"; }
			if (minutos < 60) { return "há " + Math.round(minutos) + " min"; }
			if (dias < 1) { return "há " + Math.round(dias * 24) + " h"; }
			return "há " + Math.round(dias) + " d";
		}
	};
});
