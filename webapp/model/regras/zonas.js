/**
 * Cercas: leitura de /Zonas e hierarquia entre elas.
 *
 * Tres armadilhas de formato, todas reais:
 *  - `pontos` e uma STRING JSON, nao um array;
 *  - cada ponto usa `lon`, nao `lng`;
 *  - `cor` existe e o Rastreamento2 ignora, desenhando tudo em branco.
 *
 * Hierarquia: /Zonas nao tem campo de zona-pai. Uma zona contida dentro de
 * outra e um LOCAL da unidade que a contem (posto de abastecimento dentro
 * da Mina Cauê). Isso sai da geometria que ja existe, sem campo novo.
 */
sap.ui.define([], function () {
	"use strict";

	var COR_UNIDADE = "#e10073";   // magenta Vale
	var COR_LOCAL = "#00807c";     // verde Vale

	function numero(v) {
		var n = Number(v);
		return isFinite(n) ? n : null;
	}

	var api = {
		COR_UNIDADE: COR_UNIDADE,
		COR_LOCAL: COR_LOCAL,

		/** Pontos de uma zona, como [[lat, lng], ...]. */
		pontosDaZona: function (zona) {
			var bruto = zona && zona.pontos;
			if (!bruto) { return []; }

			var lista = bruto;
			if (typeof bruto === "string") {
				try {
					lista = JSON.parse(bruto);
				} catch (e) {
					return []; // zona com JSON quebrado nao derruba o mapa
				}
			}
			if (!Array.isArray(lista)) { return []; }

			var saida = [];
			for (var i = 0; i < lista.length; i++) {
				var p = lista[i] || {};
				var lat = numero(p.lat !== undefined ? p.lat : p.latitude);
				var lng = numero(p.lon !== undefined ? p.lon : (p.lng !== undefined ? p.lng : p.longitude));
				if (lat === null || lng === null) { continue; }
				saida.push([lat, lng]);
			}
			return saida;
		},

		/** gatewayIds vem como string JSON ou separado por virgula. */
		gatewaysDaZona: function (zona) {
			var bruto = zona && zona.gatewayIds;
			if (!bruto) { return []; }
			if (Array.isArray(bruto)) { return bruto.map(String); }
			if (typeof bruto !== "string") { return []; }
			var texto = bruto.trim();
			if (texto.charAt(0) === "[") {
				try {
					var lista = JSON.parse(texto);
					return Array.isArray(lista) ? lista.map(String) : [];
				} catch (e) {
					return [];
				}
			}
			return texto.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
		},

		/** Ponto dentro de poligono, por lancamento de raio. */
		pontoEmPoligono: function (ponto, poligono) {
			if (!ponto || !poligono || poligono.length < 3) { return false; }
			var lat = ponto.lat !== undefined ? ponto.lat : ponto[0];
			var lng = ponto.lng !== undefined ? ponto.lng : ponto[1];
			var dentro = false;
			for (var i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
				var yi = poligono[i][0], xi = poligono[i][1];
				var yj = poligono[j][0], xj = poligono[j][1];
				var cruza = ((yi > lat) !== (yj > lat)) &&
					(lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.MIN_VALUE) + xi);
				if (cruza) { dentro = !dentro; }
			}
			return dentro;
		},

		centroide: function (pontos) {
			if (!pontos || !pontos.length) { return null; }
			var lat = 0, lng = 0;
			pontos.forEach(function (p) { lat += p[0]; lng += p[1]; });
			return { lat: lat / pontos.length, lng: lng / pontos.length };
		},

		/** Area aproximada, so para decidir quem contem quem. */
		area: function (pontos) {
			if (!pontos || pontos.length < 3) { return 0; }
			var soma = 0;
			for (var i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
				soma += (pontos[j][1] + pontos[i][1]) * (pontos[j][0] - pontos[i][0]);
			}
			return Math.abs(soma / 2);
		},

		/**
		 * Prepara as zonas e descobre a hierarquia por contencao.
		 * A zona com MENOR area que contem o centroide de outra e a mae.
		 */
		preparar: function (zonas) {
			var lista = (zonas || []).map(function (z) {
				var pontos = api.pontosDaZona(z);
				if (pontos.length < 3) { return null; }
				return {
					id: String(z.idZona || z.id || ""),
					nome: z.nome || "Zona sem nome",
					corCadastrada: typeof z.cor === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(z.cor.trim()) ? z.cor.trim() : null,
					gateways: api.gatewaysDaZona(z),
					pontos: pontos,
					centro: api.centroide(pontos),
					area: api.area(pontos)
				};
			}).filter(Boolean);

			lista.forEach(function (z) {
				var mae = null;
				lista.forEach(function (outra) {
					if (outra === z || outra.area <= z.area) { return; }
					if (!api.pontoEmPoligono(z.centro, outra.pontos)) { return; }
					if (!mae || outra.area < mae.area) { mae = outra; }
				});
				z.mae = mae ? { id: mae.id, nome: mae.nome } : null;
				z.tipo = mae ? "local" : "unidade";
				z.cor = z.corCadastrada || (mae ? COR_LOCAL : COR_UNIDADE);
			});

			return lista;
		},

		/** Em que zona esta um ponto: devolve o local e a unidade. */
		localizar: function (posicao, zonasPreparadas) {
			if (!posicao) { return { local: null, unidade: null }; }
			var candidatos = (zonasPreparadas || []).filter(function (z) {
				return api.pontoEmPoligono(posicao, z.pontos);
			});
			if (!candidatos.length) { return { local: null, unidade: null }; }
			candidatos.sort(function (a, b) { return a.area - b.area; });
			var menor = candidatos[0];
			var unidade = menor.tipo === "unidade" ? menor : candidatos.filter(function (z) { return z.tipo === "unidade"; })[0] || null;
			return { local: menor.tipo === "local" ? menor : null, unidade: unidade };
		},

		/** Enquadramento que cabe tudo; null quando nao ha ponto algum. */
		enquadrar: function () {
			var pontos = [];
			for (var i = 0; i < arguments.length; i++) {
				(arguments[i] || []).forEach(function (p) {
					if (!p) { return; }
					var lat = Array.isArray(p) ? p[0] : p.lat;
					var lng = Array.isArray(p) ? p[1] : p.lng;
					if (isFinite(lat) && isFinite(lng)) { pontos.push([lat, lng]); }
				});
			}
			if (!pontos.length) { return null; }
			var latMin = Infinity, latMax = -Infinity, lngMin = Infinity, lngMax = -Infinity;
			pontos.forEach(function (p) {
				latMin = Math.min(latMin, p[0]); latMax = Math.max(latMax, p[0]);
				lngMin = Math.min(lngMin, p[1]); lngMax = Math.max(lngMax, p[1]);
			});
			return [[latMin, lngMin], [latMax, lngMax]];
		},

		/** Gateways plotaveis. DECIMAL vem como texto. */
		prepararGateways: function (gateways) {
			return (gateways || []).map(function (g) {
				var lat = numero(g.latitude);
				var lng = numero(g.longitude);
				if (lat === null || lng === null || (lat === 0 && lng === 0)) { return null; }
				return {
					id: String(g.gatewayId || g.id || ""),
					identificador: g.identificador || null,
					localidade: g.localidade || null,
					condicao: g.condicao || null,
					ativo: true,
					posicao: { lat: lat, lng: lng }
				};
			}).filter(Boolean);
		}
	};

	return api;
});
