/**
 * Camada de acesso ao backend.
 *
 * Hoje ha ~45 URLs escritas a mao dentro dos controllers, todas apontando
 * para `http://10.44.32.193:4000` e `:4004`. Trocar de ambiente exige
 * varrer tres arquivos de milhares de linhas. Aqui a base sai do
 * `dataSources` do manifest, e o caminho de cada endpoint aparece uma vez.
 *
 * Os caminhos NAO foram inventados: saem do `app.use(...)` de cada
 * controller do API_Hana, com os nomes originais preservados, inclusive a
 * mistura de caixa (`/Equipamentos`, `/equipamentos/local`, `/Gateway`).
 *
 * Modo simulado: sem backend alcancavel — que e o caso ao rodar em
 * localhost fora da rede corporativa — cai nos arquivos de
 * `localService/mock/`. Isso existe para a aplicacao poder ser aberta e
 * avaliada; os dados sao fabricados e a tela avisa.
 */
sap.ui.define([], function () {
	"use strict";

	var TEMPO_LIMITE_MS = 12000;

	function juntar(base, caminho) {
		if (!base) { return caminho; }
		return base.replace(/\/+$/, "") + "/" + String(caminho).replace(/^\/+/, "");
	}

	function comTempoLimite(promessa, ms) {
		return Promise.race([
			promessa,
			new Promise(function (_, rejeitar) {
				setTimeout(function () { rejeitar(new Error("tempo limite")); }, ms);
			})
		]);
	}

	var Backend = {
		_base: "",
		_mock: false,
		_cacheMock: {},
		_avisou: false,

		/**
		 * `dataSource` vem do manifest. `mock` forca o modo simulado, que
		 * tambem e acionado sozinho na primeira falha de rede.
		 */
		init: function (opcoes) {
			var o = opcoes || {};
			this._base = o.base || "";
			this._mock = !!o.mock;
			this._raizMock = o.raizMock || "";
			return this;
		},

		estaSimulado: function () {
			return this._mock;
		},

		aoEntrarEmModoSimulado: function (fn) {
			this._aoSimular = fn;
		},

		_ativarSimulado: function (motivo) {
			if (this._mock) { return; }
			this._mock = true;
			if (!this._avisou) {
				this._avisou = true;
				// eslint-disable-next-line no-console
				console.warn("[zrastreio] backend indisponível (" + motivo + "). Usando dados simulados de localService/mock.");
				if (this._aoSimular) { this._aoSimular(motivo); }
			}
		},

		/** GET cru, com queda para o arquivo simulado. */
		obter: function (caminho, arquivoMock) {
			var that = this;

			if (this._mock) {
				return this._doMock(arquivoMock, caminho);
			}

			return comTempoLimite(fetch(juntar(this._base, caminho), {
				headers: { Accept: "application/json" }
			}), TEMPO_LIMITE_MS).then(function (resposta) {
				if (!resposta.ok) {
					throw new Error("HTTP " + resposta.status);
				}
				return resposta.json();
			}).catch(function (erro) {
				that._ativarSimulado(erro.message);
				return that._doMock(arquivoMock, caminho);
			});
		},

		/**
		 * Escrita (POST/PUT/DELETE). Diferente de `obter`, NAO cai no modo
		 * simulado em caso de falha: gravar em lugar nenhum e dizer que
		 * gravou seria pior que o erro. Quem chama decide o que fazer.
		 */
		enviar: function (metodo, caminho, corpo) {
			var opcoes = {
				method: metodo,
				headers: { Accept: "application/json" }
			};
			if (corpo !== undefined) {
				opcoes.headers["Content-Type"] = "application/json";
				opcoes.body = JSON.stringify(corpo);
			}
			return comTempoLimite(fetch(juntar(this._base, caminho), opcoes), TEMPO_LIMITE_MS)
				.then(function (resposta) {
					if (resposta.status === 204) { return null; }
					return resposta.json().catch(function () { return null; }).then(function (dados) {
						if (!resposta.ok) {
							var erro = new Error((dados && dados.erro) || ("HTTP " + resposta.status));
							erro.status = resposta.status;
							erro.dados = dados;
							throw erro;
						}
						return dados;
					});
				});
		},

		/** GET sem queda para o simulado (erro volta para quem chamou). */
		obterEstrito: function (caminho) {
			return this.enviar("GET", caminho);
		},

		_doMock: function (arquivo, caminho) {
			var nome = arquivo || String(caminho).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
			if (this._cacheMock[nome]) {
				return Promise.resolve(JSON.parse(JSON.stringify(this._cacheMock[nome])));
			}
			var that = this;
			return fetch(juntar(this._raizMock, nome + ".json"))
				.then(function (r) { return r.ok ? r.json() : []; })
				.then(function (dados) {
					that._cacheMock[nome] = dados;
					return JSON.parse(JSON.stringify(dados));
				})
				.catch(function () { return []; });
		},

		/* ---------- SAP ECC, via API_Hana ---------- */

		/** Frota cadastrada. Sem paginacao na origem — ver README. */
		equipamentos: function () {
			return this.obter("/Equipamentos", "Equipamentos");
		},

		/** Equipamentos de um local (LIKE sobre LOCAL_INSTALACAO). */
		equipamentosDoLocal: function (local) {
			return this.obter("/equipamentos/todos/" + encodeURIComponent(local), "equipamentos-todos");
		},

		/**
		 * Arvore do local: objeto-mapa { "MOTOR": 2, ... }.
		 * NAO e array — e a fonte do denominador de toda comparacao.
		 */
		arvoreDoLocal: function (local) {
			return this.obter("/equipamentos/local/" + encodeURIComponent(local), "equipamentos-local")
				.then(function (dados) {
					if (!dados) { return {}; }
					/* O backend real devolve o mapa daquele local direto. O
					   arquivo simulado guarda todos os locais num objeto so,
					   entao aqui se recorta pela chave quando ela existe. */
					return dados[local] !== undefined ? dados[local] : dados;
				});
		},

		/** Situacao atual por equipamento, com confianca e justificativa. */
		localizacaoAtual: function () {
			return this.obter("/LocalizacaoAtual", "LocalizacaoAtual");
		},

		/** Historico de leituras por rastreador. Tabela nunca truncada. */
		rastreio: function () {
			return this.obter("/Rastreio/dados", "Rastreio-dados");
		},

		/** Veiculos com posicao. Latitude/Longitude em caixa alta e texto. */
		veiculos: function () {
			return this.obter("/Veiculo", "Veiculo");
		},

		zonas: function () {
			return this.obter("/Zonas", "Zonas");
		},

		gateways: function () {
			return this.obter("/Gateway", "Gateway");
		},

		notas: function () {
			return this.obter("/SincronizarNotasReforma/listar", "NotasReforma");
		},

		ordens: function () {
			return this.obter("/SincronizarOrdensRastreio/listar", "OrdensRastreio");
		},

		reformadosPorLocal: function () {
			return this.obter("/ReformadosDescLocal/listar", "ReformadosDescLocal");
		},

		/** Indice calculado pelo backend atual — usado so para comparacao. */
		valorGerado: function () {
			return this.obter("/ValorGerado", "ValorGerado");
		},

		valorGeradoSemanal: function () {
			return this.obter("/ValorGeradoSemanal", "ValorGeradoSemanal");
		},

		centrosOficina: function () {
			return this.obter("/CentroOficina", "CentroOficina");
		}
	};

	return Backend;
});
