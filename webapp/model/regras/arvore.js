/**
 * Comparacao contra a arvore do SAP.
 *
 * A regra do cliente, textual: comparar SEMPRE a arvore equivalente aos
 * equipamentos com rastreador ativado. Quando esses equipamentos estao
 * instalados em veiculos, comparar a quantidade de equipamentos COM
 * RASTREADOR, por tipo, contra a quantidade de equipamentos, por tipo, na
 * arvore SAP daquele veiculo.
 *
 * Nunca contra o catalogo inteiro do SAP. O denominador e a arvore dos
 * veiculos que tem pelo menos um equipamento rastreado.
 *
 * Dois defeitos do Rastreamento2 ficam corrigidos aqui:
 *
 *  1. o filtro monta `Instalado no ${veiculo} ` com espaco no fim e o
 *     backend grava sem espaco — nunca casa, e todo veiculo aparece como
 *     divergente. Aqui o nome e EXTRAIDO do grupo e comparado normalizado;
 *  2. `normalizarGrupo` devolve "CONVERSOR" enquanto `/equipamentos/local/`
 *     usa a chave "CONVERSOR DE TORQUE" — essa familia conta zero para
 *     sempre. Aqui `familiaDe` devolve a mesma chave do endpoint.
 */
sap.ui.define([], function () {
	"use strict";

	var FAMILIAS = [
		{ id: "MOTOR", rotulo: "Motor" },
		{ id: "COMANDO FINAL", rotulo: "Comando final" },
		{ id: "DIFERENCIAL", rotulo: "Diferencial" },
		{ id: "TRANSMISSAO", rotulo: "Transmissão" },
		{ id: "CONVERSOR DE TORQUE", rotulo: "Conversor de torque" }
	];

	var PREFIXO_INSTALADO = "INSTALADO NO ";

	function normalizar(valor) {
		return String(valor === null || valor === undefined ? "" : valor)
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/\s+/g, " ")
			.trim()
			.toUpperCase();
	}

	var api = {
		FAMILIAS: FAMILIAS,

		rotuloFamilia: function (id) {
			for (var i = 0; i < FAMILIAS.length; i++) {
				if (FAMILIAS[i].id === id) {
					return FAMILIAS[i].rotulo;
				}
			}
			return id;
		},

		/** Familia a partir da descricao, na MESMA chave de /equipamentos/local. */
		familiaDe: function (descricao) {
			var texto = normalizar(descricao);
			if (!texto) {
				return null;
			}
			if (texto.indexOf("COMANDO FINAL") >= 0) { return "COMANDO FINAL"; }
			if (texto.indexOf("TRANSMISSAO") >= 0) { return "TRANSMISSAO"; }
			if (texto.indexOf("CONVERSOR") >= 0) { return "CONVERSOR DE TORQUE"; }
			if (texto.indexOf("DIFERENCIAL") >= 0) { return "DIFERENCIAL"; }
			if (texto.indexOf("MOTOR") >= 0) { return "MOTOR"; }
			return null;
		},

		/**
		 * Nome do veiculo em que o componente diz estar instalado.
		 * Extrai em vez de remontar a string — e o defeito 1 da lista acima.
		 */
		veiculoDoGrupo: function (grupo) {
			var texto = normalizar(grupo);
			if (texto.indexOf(PREFIXO_INSTALADO) !== 0) {
				return null;
			}
			var nome = texto.slice(PREFIXO_INSTALADO.length).trim();
			return nome || null;
		},

		estaInstalado: function (grupo) {
			return api.veiculoDoGrupo(grupo) !== null;
		},

		/**
		 * Confere um veiculo.
		 *
		 * `arvore` e o objeto-mapa de /equipamentos/local/{local}
		 * ({ MOTOR: 2, ... }) e `rastreados` sao registros de
		 * /LocalizacaoAtual com grupoAtual e descEquipamento.
		 */
		conferirVeiculo: function (veiculo, arvore, rastreados) {
			var alvo = normalizar(veiculo && veiculo.nome);
			var comTag = {};
			var lista = rastreados || [];

			for (var i = 0; i < lista.length; i++) {
				var item = lista[i];
				if (api.veiculoDoGrupo(item.grupoAtual) !== alvo) {
					continue;
				}
				var familia = api.familiaDe(item.descEquipamento);
				if (!familia) {
					continue;
				}
				comTag[familia] = (comTag[familia] || []);
				comTag[familia].push(item);
			}

			var esperado = arvore || {};
			var chaves = {};
			Object.keys(esperado).forEach(function (k) { chaves[normalizar(k)] = true; });
			Object.keys(comTag).forEach(function (k) { chaves[k] = true; });

			var linhas = Object.keys(chaves).map(function (familia) {
				var naArvore = Number(esperado[familia] || 0) || 0;
				var comRastreador = (comTag[familia] || []).length;
				return {
					familia: familia,
					rotulo: api.rotuloFamilia(familia),
					naArvore: naArvore,
					comRastreador: comRastreador,
					/** Cobertos: quantos de fato casam com a arvore. Separar
					 *  isto de `comRastreador` impede que uma sobra numa
					 *  familia compense uma falta em outra. */
					cobertos: Math.min(comRastreador, naArvore),
					diferenca: comRastreador - naArvore,
					itens: comTag[familia] || []
				};
			});

			linhas.sort(function (a, b) {
				var ia = FAMILIAS.findIndex(function (f) { return f.id === a.familia; });
				var ib = FAMILIAS.findIndex(function (f) { return f.id === b.familia; });
				return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
			});

			var naArvore = linhas.reduce(function (s, l) { return s + l.naArvore; }, 0);
			var comRastreador = linhas.reduce(function (s, l) { return s + l.comRastreador; }, 0);
			var cobertos = linhas.reduce(function (s, l) { return s + l.cobertos; }, 0);

			return {
				nome: veiculo && veiculo.nome,
				local: veiculo && veiculo.local,
				mina: veiculo && veiculo.mina,
				posicao: veiculo && veiculo.posicao,
				linhas: linhas,
				naArvore: naArvore,
				comRastreador: comRastreador,
				cobertos: cobertos,
				cobertura: naArvore ? cobertos / naArvore : null,
				conforme: linhas.every(function (l) { return l.diferenca === 0; })
			};
		},

		/** Confere a frota e agrega por familia — o numero da tela principal. */
		compararFrota: function (veiculos, arvorePorVeiculo, rastreados) {
			var lista = (veiculos || []).map(function (v) {
				var arvore = (arvorePorVeiculo || {})[v.local] || (arvorePorVeiculo || {})[v.nome] || {};
				return api.conferirVeiculo(v, arvore, rastreados);
			});

			var porFamilia = FAMILIAS.map(function (f) {
				var naArvore = 0;
				var comRastreador = 0;
				lista.forEach(function (v) {
					v.linhas.forEach(function (l) {
						if (l.familia !== f.id) { return; }
						naArvore += l.naArvore;
						comRastreador += l.comRastreador;
					});
				});
				return {
					familia: f.id,
					rotulo: f.rotulo,
					naArvore: naArvore,
					comRastreador: comRastreador,
					cobertura: naArvore ? Math.min(comRastreador / naArvore, 1) : null
				};
			});

			var naArvore = porFamilia.reduce(function (s, f) { return s + f.naArvore; }, 0);
			var comRastreador = porFamilia.reduce(function (s, f) { return s + f.comRastreador; }, 0);
			var cobertos = lista.reduce(function (s, v) { return s + v.cobertos; }, 0);

			lista.sort(function (a, b) {
				var ca = a.cobertura === null ? 1 : a.cobertura;
				var cb = b.cobertura === null ? 1 : b.cobertura;
				return ca - cb || String(a.nome).localeCompare(String(b.nome), "pt-BR");
			});

			return {
				veiculos: lista,
				porFamilia: porFamilia,
				resumo: {
					veiculos: lista.length,
					conformes: lista.filter(function (v) { return v.conforme && v.naArvore > 0; }).length,
					divergentes: lista.filter(function (v) { return v.naArvore > 0 && !v.conforme; }).length,
					semArvore: lista.filter(function (v) { return v.naArvore === 0; }).length,
					naArvore: naArvore,
					comRastreador: comRastreador,
					cobertos: cobertos,
					/** Cobertura da arvore: com rastreador sobre o que a
					 *  arvore declara. Nunca passa de 100%. */
					cobertura: naArvore ? Math.min(comRastreador / naArvore, 1) : null
				}
			};
		},

		/**
		 * Deduplica /Veiculo, que nao tem DISTINCT e repete o mesmo veiculo
		 * em varios locais. Fica o registro mais recente.
		 */
		veiculosUnicos: function (veiculos) {
			var porNome = {};
			var lista = veiculos || [];

			for (var i = 0; i < lista.length; i++) {
				var v = lista[i];
				var nome = String(v && v.Veiculo ? v.Veiculo : "").trim();
				if (!nome) {
					continue;
				}
				var atual = porNome[nome];
				if (!atual || instante(v.DataAtualizacao) > instante(atual.DataAtualizacao)) {
					porNome[nome] = v;
				}
			}

			return Object.keys(porNome).map(function (nome) {
				var v = porNome[nome];
				return {
					nome: nome,
					local: v.LOCAL_INSTALACAO || null,
					mina: v.NomeMina || null,
					atualizadoEm: v.DataAtualizacao || null,
					// Latitude/Longitude vem em caixa alta e como texto.
					posicao: api.coordenada(v.Latitude, v.Longitude)
				};
			});
		},

		/** DECIMAL do MySQL chega como string; sem Number o mapa nao plota. */
		coordenada: function (lat, lng) {
			var a = Number(lat);
			var b = Number(lng);
			if (!isFinite(a) || !isFinite(b)) {
				return null;
			}
			if (a === 0 && b === 0) {
				return null; // 0,0 e ausencia de dado
			}
			return { lat: a, lng: b };
		}
	};

	function instante(valor) {
		var ms = new Date(valor || 0).getTime();
		return isNaN(ms) ? 0 : ms;
	}

	return api;
});
