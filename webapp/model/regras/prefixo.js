/**
 * Prefixo do local de instalacao.
 *
 * Regra do cliente: o recorte da Sala de Controle sao SEMPRE os quatro
 * primeiros caracteres de LOCAL_INSTALACAO, e apenas de equipamentos que
 * tem rastreador. O que vem depois dos quatro e conteudo, nao prefixo —
 * `FEIT-EMREF_EX...` continua sendo FEIT.
 *
 * Isso corrige o agrupamento de `onCardEmbarcadosPress` no Rastreamento2,
 * que trata `_EMREF_EXT` como se fosse um prefixo proprio e manda a reforma
 * externa para um grupo separado de Itabira.
 *
 * A lista de prefixos NAO e fixa: sai do distinct dos dados.
 */
sap.ui.define([], function () {
	"use strict";

	var TAMANHO = 4;

	function normalizar(valor) {
		return String(valor === null || valor === undefined ? "" : valor).trim().toUpperCase();
	}

	return {
		TAMANHO: TAMANHO,

		/** Prefixo de um local de instalacao, ou null se nao houver. */
		de: function (local) {
			var texto = normalizar(local);
			if (texto.length < TAMANHO) {
				return null;
			}
			return texto.slice(0, TAMANHO);
		},

		/**
		 * Prefixos existentes, com quantos rastreadores cada um tem.
		 *
		 * `equipamentos` sao os registros do SAP (EQUIPAMENTO,
		 * LOCAL_INSTALACAO) e `codigosComRastreador` e o conjunto de codigos
		 * que aparecem no rastreamento. So entra quem tem os dois.
		 */
		contar: function (equipamentos, codigosComRastreador) {
			var mapa = {};
			var total = 0;
			var lista = equipamentos || [];
			var comTag = codigosComRastreador || {};

			for (var i = 0; i < lista.length; i++) {
				var eq = lista[i];
				var codigo = this.chave(eq && eq.EQUIPAMENTO);
				if (!codigo || !comTag[codigo]) {
					continue;
				}
				var prefixo = this.de(eq.LOCAL_INSTALACAO);
				if (!prefixo) {
					continue;
				}
				mapa[prefixo] = (mapa[prefixo] || 0) + 1;
				total += 1;
			}

			var saida = Object.keys(mapa).map(function (prefixo) {
				return { prefixo: prefixo, total: mapa[prefixo] };
			});
			saida.sort(function (a, b) {
				return b.total - a.total || a.prefixo.localeCompare(b.prefixo, "pt-BR");
			});
			return { prefixos: saida, total: total };
		},

		/** Um equipamento pertence ao recorte? `null` de prefixo = todos. */
		casa: function (local, prefixo) {
			if (!prefixo) {
				return true;
			}
			return this.de(local) === normalizar(prefixo).slice(0, TAMANHO);
		},

		/**
		 * Codigo de equipamento comparavel entre SAP e rastreamento.
		 * O SAP grava com zeros a esquerda; a operacao digita sem eles.
		 */
		chave: function (valor) {
			var texto = normalizar(valor);
			if (!texto) {
				return null;
			}
			if (/^\d+$/.test(texto)) {
				return texto.replace(/^0+/, "") || "0";
			}
			return texto;
		}
	};
});
