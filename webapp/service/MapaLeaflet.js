/* global L */
/**
 * Mapa Leaflet, compartilhado pela Sala de Controle, pelo Mapa operacional
 * e pela ficha do equipamento.
 */
sap.ui.define([
	"../model/regras/zonas",
	"sap/base/Log"
], function (zonas, Log) {
	"use strict";
	sap.ui.require([
		"sap/base/Log"
	], function (Log) {
		Log.error("window.L = " + typeof window.L);
	});

	var BASES = {
		claro: {
			rotulo: "Claro",
			camadas: [{
				url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
				opcoes: {
					maxZoom: 19,
					attribution: "© OpenStreetMap",
					zIndex: 1
				}
			}]
		},

		satelite: {
			rotulo: "Satélite",
			camadas: [{
				url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
				opcoes: {
					maxZoom: 19,
					attribution: "Tiles © Esri",
					zIndex: 1
				}
			}, {
				// Sem este overlay a foto de satelite fica sem nenhum nome de
				// rua ou de lugar por cima — so a imagem crua.
				url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
				opcoes: {
					maxZoom: 19,
					attribution: "Tiles © Esri",
					zIndex: 2
				}
			}]
		}
	};

	var ZOOM_ROTULO = 13;
	var CENTRO_PADRAO = [-19.64151, -43.226143];

	function corDoEstado(ativo) {
		if (!ativo) { return "#6a6d70"; }
		if (ativo.mudo) { return "#bb0000"; }
		if (ativo.confianca === "BAIXA") { return "#eda800"; }
		return "#107e3e";
	}

	function escapar(texto) {
		return String(texto === null || texto === undefined ? "" : texto)
			.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	function Mapa(elemento, opcoes) {

		if (typeof L === "undefined") {
			Log.error("Leaflet não carregado");
			return;
		}

		var o = opcoes || {};

		this._mapa = L.map(elemento, {
			center: o.centro || CENTRO_PADRAO,
			zoom: o.zoom || 12,
			minZoom: 3,
			maxZoom: 20,
			zoomControl: o.zoomControl !== false,
			attributionControl: o.attribution !== false,
			preferCanvas: false
		});
		this._base = null;
		this._camadasBase = [];
		this._cercas = L.layerGroup().addTo(this._mapa);
		this._gateways = L.layerGroup().addTo(this._mapa);
		this._minas = L.layerGroup().addTo(this._mapa);
		this._cluster = L.markerClusterGroup({
			showCoverageOnHover: false,
			maxClusterRadius: 48,
			disableClusteringAtZoom: 17
		}).addTo(this._mapa);
		this._legendas = true;

		this.trocarBase(o.base || "satelite");

		var that = this;
		this._mapa.on("zoomend", function () {

			that._aplicarLegendas();
			that.desenharMinas();

			var zoom = that._mapa.getZoom();

			sap.m.MessageToast.show(
				"Zoom: " + zoom
			);

			that._gateways.eachLayer(function (marcador) {

				if (zoom >= 25) {
					marcador.openTooltip();
				} else {
					marcador.closeTooltip();
				}

			});

		});
	}

	Mapa.prototype.instancia = function () { return this._mapa; };

	Mapa.prototype.trocarBase = function (chave) {
		var base = BASES[chave] || BASES.satelite;
		var that = this;
		this._camadasBase.forEach(function (c) { that._mapa.removeLayer(c); });
		// A ordem entre as camadas da propria base (ex.: foto + rotulos)
		// vem do zIndex de cada uma, nao de bringToBack — com duas camadas
		// na mesma base, bringToBack em sequencia inverteria a ordem e
		// jogaria o overlay de rotulos atras da foto. Ficar abaixo das
		// cercas/gateways/alfinetes e garantido pelo pane (tilePane sempre
		// atras de overlayPane/markerPane), sem precisar de bringToBack.
		this._camadasBase = base.camadas.map(function (def) {
			return L.tileLayer(def.url, def.opcoes).addTo(that._mapa);
		});
		this._base = chave;
	};

	Mapa.prototype.baseAtual = function () { return this._base; };

	Mapa.prototype.alternarLegendas = function (ligado) {
		this._legendas = ligado === undefined ? !this._legendas : !!ligado;
		this._aplicarLegendas();
		return this._legendas;
	};

	Mapa.prototype._aplicarLegendas = function () {
		var mostrar = this._legendas && this._mapa.getZoom() >= ZOOM_ROTULO;
		var container = this._mapa.getContainer();
		if (mostrar) {
			L.DomUtil.removeClass(container, "valeSemLegendas");
		} else {
			L.DomUtil.addClass(container, "valeSemLegendas");
		}
	};

	Mapa.prototype.desenharCercas = function (lista) {
		this._cercas.clearLayers();
		var that = this;
		(lista || []).forEach(function (z) {
			var unidade = z.tipo === "unidade";
			var poligono = L.polygon(z.pontos, {
				color: z.cor,
				weight: unidade ? 2.5 : 2,
				fillOpacity: unidade ? 0.06 : 0.1
			});
			var rotulo = unidade
				? escapar(z.nome)
				: escapar(z.nome) + "<br><span style=\"font-size:10px;font-weight:500;text-transform:none\">" +
				escapar(z.mae ? z.mae.nome : "") + "</span>";
			poligono.bindTooltip(rotulo, {
				permanent: true,
				direction: "center",
				className: unidade ? "valeUnidade" : "valeCerca"
			});

			poligono.closeTooltip();
			if (that._aoClicarCerca) {
				poligono.on("click", function () { that._aoClicarCerca(z); });
			}
			that._cercas.addLayer(poligono);
		});
	};

	Mapa.prototype.aoClicarCerca = function (fn) { this._aoClicarCerca = fn; };

	Mapa.prototype.desenharGateways = function (lista) {
		this._gateways.clearLayers();
		var zoom = this._mapa.getZoom();

		if (zoom < 18) {
			return;
		}
		var that = this;
		(lista || []).forEach(function (g) {
			var marcador = L.circleMarker([g.posicao.lat, g.posicao.lng], {
				radius: 5,
				color: g.ativo ? "#0a6ed1" : "#6a6d70",
				fillColor: g.ativo ? "#0a6ed1" : "#6a6d70",
				fillOpacity: 0.9,
				weight: 1
			});
			marcador.bindPopup(
				"<div class=\"valePopup\"><b>" + escapar(g.identificador || g.id) + "</b>" +
				"<div class=\"valePopup__linha\"><span>Localidade</span><b>" + escapar(g.localidade || "—") + "</b></div>" +
				"<div class=\"valePopup__linha\"><span>Condição</span><b>" + escapar(g.condicao || "—") + "</b></div></div>"
			);

			marcador.bindTooltip(
				escapar(g.identificador || g.id),
				{
					permanent: true,
					direction: "top",
					className: "gatewayLabel"
				}
			);

			marcador.closeTooltip();

			that._gateways.addLayer(marcador);
			if (that._mapa.getZoom() < 25) {
				marcador.closeTooltip();
			}
		});
	};

	Mapa.prototype.desenharAtivos = function (ativos, posicaoDe, aoSelecionar) {
		var that = this;
		this._cluster.clearLayers();
		var marcadores = [];
		var agrupados = {};
		(ativos || []).forEach(function (a) {

			if (a.instalado && a.veiculo) {

				if (!agrupados[a.veiculo]) {
					agrupados[a.veiculo] = [];
				}

				agrupados[a.veiculo].push(a);

				return;
			}
			var pos = posicaoDe(a);
			if (!pos) { return; }
			var cor = corDoEstado(a);
			var icone = L.divIcon({
				className: "valeAlfinete",
				html: "<span class=\"valeAlfinete__ponto\" style=\"background:" + cor + "\"></span>" +
					"<span class=\"valeAlfinete__rotulo\">" + escapar(a.codigoOriginal || a.codigo) + "</span>",
				iconSize: null,
				iconAnchor: [6, 6]
			});
			var marcador = L.marker([pos.lat, pos.lng], { icon: icone });
			marcador.bindPopup(
				"<div class=\"valePopup\"><b>" + escapar(a.codigoOriginal || a.codigo) + "</b>" +
				"<div style=\"font-size:11px;margin:2px 0 6px\">" + escapar(a.descricao || "sem descrição") + "</div>" +
				"<div class=\"valePopup__linha\"><span>Situação</span><b>" + escapar(a.grupoAtual || "—") + "</b></div>" +
				"<div class=\"valePopup__linha\"><span>Local</span><b>" + escapar(a.local || "—") + "</b></div>" +
				"<div class=\"valePopup__linha\"><span>Comunicação</span><b>" + escapar(a.silencioTexto) + "</b></div></div>"
			);
			if (aoSelecionar) {
				marcador.on("click", function () { aoSelecionar(a); });
			}
			marcadores.push(marcador);
		});
		Object.keys(agrupados).forEach(function (veiculo) {

			var equipamentos = agrupados[veiculo];

			var pos = posicaoDe(equipamentos[0]);

			if (!pos) {
				return;
			}

			var htmlDetalhes = "";
			function abreviarDescricao(texto) {

				return String(texto || "")
					.replace("CATERPILLAR", "CAT")
					.replace("COMANDO FINAL", "CMD FINAL")
					.replace("CONVERSOR DE TORQUE", "CONV T")
					.replace("CONVERSOR TORQUE", "CONV T")
					.replace("TRANSMISSAO", "TRANSM.")
					.replace("TRANSMISSÃO", "TRANSM.")
					.replace("MOTOR COMBUSTAO", "MOTOR")
					.replace("MOTOR COMBUSTÃO", "MOTOR")
					.replace("DIFERENCIAL", "DIF.")
					.replace("DIANTEIRO", "DIANT.")
					.replace("TRASEIRO", "TRAS.");
			}
			equipamentos.forEach(function (eq) {

				htmlDetalhes +=
					"<div " +
					"class='veiculoEquipamentoPopup' " +
					"data-codigo='" + escapar(eq.codigo) + "' " +
					"style='margin:1px 0;padding:1px 0;border-bottom:1px solid #eee;font-size:9px;cursor:pointer;'>" +

					"<span style='" +
					"font-weight:700;" +
					"color:#0A6ED1;" +
					"text-decoration:underline;" +
					"'>" +
					escapar(
						String(eq.codigoOriginal || eq.codigo)
							.replace(/^0+/, "")
							.slice(-8)
					) +
					"</span> - " +

					"<span>" +
					escapar(
						abreviarDescricao(eq.descricao)
					) +
					"</span>" +

					"</div>";

			});

			var html =
				"<div class='valePopup'>" +

				"<div style='text-align:center;margin-bottom:8px;'>" +
				"<b style='font-size:14px;'>VEÍCULO " +
				escapar(veiculo) +
				"</b>" +
				"</div>" +

				"<div style='margin-bottom:8px;color:#64748b;font-size:12px;'>" +
				escapar(
					equipamentos[0] && equipamentos[0].local
						? equipamentos[0].local
							.split("-")
							.slice(0, 5)
							.join("-")
						: ""
				) +
				"</div>" +

				"<details>" +

				"<summary style='" +
				"cursor:pointer;" +
				"color:#0A6ED1;" +
				"font-weight:400;" +
				"text-decoration:underline;" +
				"'>" +

				"🔍 Ver Componentes (" +
				equipamentos.length +
				")" +
				"</summary>" +

				"<div style='margin-top:8px;'>" +
				htmlDetalhes +
				"</div>" +

				"</details>" +

				"</div>";

			var marcador = L.marker(
				[pos.lat, pos.lng]
			);

			marcador.bindPopup(html);
			marcador.on("popupopen", function () {

				setTimeout(function () {

					document
						.querySelectorAll(".veiculoEquipamentoPopup")
						.forEach(function (el) {

							el.onclick = function () {

								var codigo =
									el.getAttribute("data-codigo");

								if (aoSelecionar) {
									aoSelecionar({
										codigo: codigo
									});
								}

							};

						});

				}, 100);

			});
			marcadores.push(marcador);

		});

		if (marcadores.length) { this._cluster.addLayers(marcadores); }
		return marcadores.length;
	};

	Mapa.prototype.enquadrar = function (caixa) {
		if (!caixa) { return; }
		this._mapa.fitBounds(caixa, { padding: [24, 24], maxZoom: 12 });
	};

	Mapa.prototype.irPara = function (posicao, zoom) {
		if (!posicao) { return; }
		this._mapa.setView([posicao.lat, posicao.lng], zoom || 12);
	};

	Mapa.prototype.ajustar = function () {
		var that = this;
		setTimeout(function () { that._mapa.invalidateSize(); }, 0);
	};


	// ... restou do código do protótipo acima ...
	Mapa.prototype.destruir = function () { this._mapa.remove(); };
	Mapa.prototype.desenharMinas = function () {

		this._minas.clearLayers();
		var zoom = this._mapa.getZoom();

		if (zoom > 16) {
			return;
		}
		[
			["MINA CAUÊ", -19.599252, -43.218690],
			["MINA CONCEIÇÃO", -19.657580, -43.269398],
			["MINA PERIQUITO", -19.632715, -43.254261],

			["MINA DE BRUCUTU", -19.870131, -43.398402],
			["MINA DO PICO", -20.217185, -43.864846],
			["MINA DE ALEGRIA", -20.172795, -43.490555],
			["MINA FAZENDÃO", -20.145046, -43.419664]
		].forEach(function (mina) {

			L.marker(
				[mina[1], mina[2]],
				{
					interactive: false,
					zIndexOffset: -1000,
					icon: L.divIcon({
						className: "minaLabel",
						html: mina[0]
					})
				}
			).addTo(this._minas);

		}, this);

	};
	return {
		BASES: BASES,
		ZOOM_ROTULO: ZOOM_ROTULO,
		criar: function (elemento, opcoes) {
			return new Mapa(elemento, opcoes);
		},
		enquadramentoDe: zonas.enquadrar
	};
});


