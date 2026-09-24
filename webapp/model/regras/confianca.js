/**
 * Confianca do CADASTRO — nao da leitura.
 *
 * A distincao e o ponto. Contar amostras mede se a tag foi bem lida; nao
 * diz se o local de instalacao declarado no SAP esta certo. O que responde
 * isso e o cruzamento entre tres coisas:
 *
 *  1. o local declarado mudou? (historico vem das notas YA e das ordens
 *     YRR, que gravam `local_instalacao` com data — o /Equipamentos guarda
 *     so o valor corrente e sobrescreve a cada sincronizacao);
 *  2. o equipamento se deslocou de fato?
 *  3. a leitura tem lastro? (amostras e tipo dominante)
 *
 * Deslocamento: `device.lat`/`device.lon` e a posicao GNSS do proprio
 * dispositivo, requisitada pelo gateway — BT e LR sao transporte, nao
 * metodo de posicionamento. Entao vale limiar em metros, com dois cuidados:
 *
 *  - a referencia e a MEDIANA das leituras, nao a leitura anterior: uma
 *    fixacao ruim isolada deslocaria o equipamento e o traria de volta,
 *    gerando duas movimentacoes falsas;
 *  - passar do limiar SEM trocar de gateway e tratado como deriva. O
 *    equipamento nao pode ter saido do alcance daquele gateway e seguir
 *    sendo ouvido por ele. E o caso do componente parado em oficina
 *    coberta, onde o sinal degrada e a coordenada passeia.
 */
sap.ui.define([], function () {
	"use strict";

	/** Deriva tipica de GNSS de consumo em mina: ceu aberto 5-10 m, com
	 *  multicaminho de bancada e caçamba chega a 30. Abaixo disto nao da
	 *  para separar movimento de alucinacao do sensor. */
	var DERIVA_M = 25;
	var RAIO_TERRA_M = 6371000;

	function rad(g) { return (g * Math.PI) / 180; }

	function distancia(a, b) {
		if (!a || !b) { return null; }
		var dLat = rad(b.lat - a.lat);
		var dLng = rad(b.lng - a.lng);
		var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
		return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(s)));
	}

	function medianaDe(numeros) {
		var v = numeros.slice().sort(function (a, b) { return a - b; });
		if (!v.length) { return null; }
		var meio = Math.floor(v.length / 2);
		return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
	}

	var api = {
		DERIVA_M: DERIVA_M,
		distancia: distancia,

		/** Posicao mediana das leituras — resistente a fixacao solta. */
		posicaoMediana: function (leituras) {
			var lats = [];
			var lngs = [];
			(leituras || []).forEach(function (l) {
				var lat = Number(l.latitude);
				var lng = Number(l.longitude);
				if (isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0)) {
					lats.push(lat);
					lngs.push(lng);
				}
			});
			if (!lats.length) { return null; }
			return { lat: medianaDe(lats), lng: medianaDe(lngs) };
		},

		/** Gateways distintos que leram a tag nas leituras dadas. */
		gatewaysDe: function (leituras) {
			var vistos = {};
			(leituras || []).forEach(function (l) {
				var g = String(l.gateway || "").trim();
				if (g) { vistos[g] = true; }
			});
			return Object.keys(vistos);
		},

		/**
		 * O equipamento se moveu?
		 * Exige os dois sinais: passou do limiar E trocou de gateway.
		 */
		deslocamento: function (leituras, limiteM) {
			var limite = limiteM || DERIVA_M;
			var ancora = api.posicaoMediana(leituras);
			var gateways = api.gatewaysDe(leituras);
			if (!ancora) {
				return { medido: false, moveu: false, distanciaM: null, gateways: gateways };
			}

			var maior = 0;
			(leituras || []).forEach(function (l) {
				var d = distancia(ancora, { lat: Number(l.latitude), lng: Number(l.longitude) });
				if (d !== null && isFinite(d) && d > maior) { maior = d; }
			});

			var passouLimiar = maior > limite;
			var trocouGateway = gateways.length > 1;

			return {
				medido: true,
				ancora: ancora,
				distanciaM: Math.round(maior),
				limiteM: limite,
				passouLimiar: passouLimiar,
				trocouGateway: trocouGateway,
				gateways: gateways,
				moveu: passouLimiar && trocouGateway,
				/** Passou do limiar sem trocar de gateway: deriva, nao movimento. */
				deriva: passouLimiar && !trocouGateway
			};
		},

		/**
		 * Historico do local declarado, a partir de notas e ordens.
		 * Devolve os valores distintos, do mais recente para o mais antigo.
		 */
		historicoDeLocal: function (notas, ordens) {
			var eventos = [];
			(notas || []).forEach(function (n) {
				if (n.local_instalacao) {
					eventos.push({ local: String(n.local_instalacao).trim(), data: n.data_modificacao || n.data_criacao, origem: "nota " + n.nota });
				}
			});
			(ordens || []).forEach(function (o) {
				if (o.local_instalacao) {
					eventos.push({ local: String(o.local_instalacao).trim(), data: o.data_criacao, origem: "ordem " + o.ordem });
				}
			});
			eventos.sort(function (a, b) { return new Date(b.data || 0) - new Date(a.data || 0); });

			var distintos = [];
			eventos.forEach(function (e) {
				if (!distintos.length || distintos[distintos.length - 1].local !== e.local) {
					distintos.push(e);
				}
			});
			return { eventos: eventos, distintos: distintos, estavel: distintos.length <= 1 };
		},

		/**
		 * Avalia a confianca e devolve os testes NOMEADOS, para a tela
		 * poder mostrar por que — e nao so o rotulo.
		 */
		avaliar: function (dados) {
			var d = dados || {};
			var leituras = d.leituras || [];
			var historico = api.historicoDeLocal(d.notas, d.ordens);
			var mov = api.deslocamento(leituras, d.limiteM);
			var amostras = Number(d.amostras || leituras.length) || 0;

			var testes = [];

			testes.push({
				id: "local",
				ok: historico.estavel,
				texto: historico.estavel
					? "Local de instalação " + (d.localAtual || "—") + " estável no histórico de notas e ordens"
					: "Local declarado mudou " + (historico.distintos.length - 1) + "x no histórico de notas e ordens"
			});

			testes.push({
				id: "deslocamento",
				ok: mov.medido ? !mov.moveu : false,
				texto: !mov.medido
					? "Sem coordenada suficiente para medir deslocamento"
					: mov.moveu
						? "Deslocou " + mov.distanciaM + " m da mediana e trocou de gateway"
						: mov.deriva
							? "Variou " + mov.distanciaM + " m sem trocar de gateway — tratado como deriva de GPS"
							: "Posição a " + mov.distanciaM + " m da mediana das leituras (limite " + mov.limiteM + " m)"
			});

			testes.push({
				id: "lastro",
				ok: amostras >= 30,
				texto: amostras
					? amostras + " leituras analisadas" + (d.tipoDominante ? ", predominância " + d.tipoDominante : "")
					: "Sem leituras analisadas"
			});

			/**
			 * O caso que o cliente descreveu: local declarado nao muda e o
			 * equipamento se moveu. Ai quem nao e confiavel e o CADASTRO.
			 */
			var cadastroSuspeito = historico.estavel && mov.moveu;
			var nivel;
			if (cadastroSuspeito) {
				nivel = "BAIXA";
			} else if (testes.every(function (t) { return t.ok; })) {
				nivel = "ALTA";
			} else {
				nivel = "MEDIA";
			}

			return {
				nivel: nivel,
				testes: testes,
				cadastroSuspeito: cadastroSuspeito,
				deslocamento: mov,
				historicoLocal: historico,
				explicacao: cadastroSuspeito
					? "O equipamento mudou de posição e de gateway, e o local de instalação declarado continua o mesmo. Isso aponta cadastro desatualizado, não rastreador errado."
					: "Local declarado, posição e volume de leituras concordam entre si."
			};
		}
	};

	return api;
});
