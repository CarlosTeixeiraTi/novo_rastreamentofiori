/**
 * Onde os relatorios personalizados sao guardados.
 *
 * Com backend: rota /relatorios do API_Hana (MySQL db_MVP, tabela
 * RelatoriosPersonalizados). Biblioteca compartilhada — todos veem todos,
 * com o autor registrado.
 *
 * No modo simulado (?mock=true, ou sem backend alcancavel) grava no
 * navegador, para a funcionalidade poder ser avaliada fora da rede. A tela
 * avisa que, nesse modo, o que for salvo fica so neste navegador.
 *
 * O formato devolvido e o mesmo nos dois casos:
 *   { id, nome, descricao, tipo, autor, alteradoPor, versao, criadoEm, alteradoEm, definicao }
 */
sap.ui.define([
	"./Backend",
	"../model/regras/relatorioPersonalizado"
], function (Backend, motor) {
	"use strict";

	var CHAVE_LOCAL = "zrastreio.relatoriosPersonalizados";
	var CHAVE_AUTOR = "zrastreio.autorRelatorios";
	var CAMINHO = "/relatorios";

	function lerLocal() {
		try {
			return JSON.parse(window.localStorage.getItem(CHAVE_LOCAL) || "[]");
		} catch (e) {
			return [];
		}
	}

	function gravarLocal(lista) {
		try {
			window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lista));
		} catch (e) {
			throw new Error("Não foi possível gravar no navegador: " + e.message);
		}
	}

	function corpo(def, autor, versao) {
		var limpo = motor.normalizar(def);
		delete limpo.id;
		var saida = {
			nome: limpo.nome,
			descricao: limpo.descricao,
			tipo: limpo.tipo,
			autor: autor || null,
			definicao: limpo
		};
		if (versao !== undefined && versao !== null) { saida.versao = versao; }
		return saida;
	}

	function explicar(erro) {
		if (erro && erro.status === 404 && !erro.dados) {
			erro.message = "A rota /relatorios não existe no API_Hana deste ambiente. Publique o controller RelatoriosPersonalizados.js no backend.";
		}
		if (erro && /tempo limite|Failed to fetch|NetworkError/i.test(erro.message)) {
			erro.message = "Backend indisponível — o relatório não foi salvo.";
		}
		throw erro;
	}

	var Salvos = {

		/** true quando grava no navegador (modo simulado). */
		local: function () {
			return Backend.estaSimulado();
		},

		/** Nome de quem esta usando: FLP quando houver, senao o ultimo informado. */
		autor: function () {
			try {
				var ushell = window.sap && window.sap.ushell && window.sap.ushell.Container;
				var usuario = ushell && ushell.getUser && ushell.getUser();
				if (usuario && usuario.getFullName && usuario.getFullName()) { return usuario.getFullName(); }
			} catch (e) { /* fora do FLP */ }
			try {
				return window.localStorage.getItem(CHAVE_AUTOR) || "";
			} catch (e2) {
				return "";
			}
		},

		lembrarAutor: function (nome) {
			try { window.localStorage.setItem(CHAVE_AUTOR, String(nome || "").trim()); } catch (e) { /* sem storage */ }
		},

		listar: function () {
			if (this.local()) {
				return Promise.resolve(lerLocal().sort(function (a, b) {
					return String(a.nome).localeCompare(String(b.nome), "pt-BR");
				}));
			}
			return Backend.obterEstrito(CAMINHO).catch(explicar);
		},

		/** Cria (sem id) ou altera (com id). Devolve o registro gravado. */
		salvar: function (def, registro) {
			var autor = this.autor();
			var agora = new Date().toISOString();

			if (this.local()) {
				var lista = lerLocal();
				var limpo = motor.normalizar(def);
				delete limpo.id;
				if (registro && registro.id) {
					var i = lista.findIndex(function (r) { return r.id === registro.id; });
					if (i < 0) { return Promise.reject(new Error("Relatório não encontrado.")); }
					if (registro.versao !== undefined && lista[i].versao !== registro.versao) {
						var conflito = new Error("Este relatório foi alterado em outra aba depois que você o abriu.");
						conflito.status = 409;
						return Promise.reject(conflito);
					}
					lista[i] = Object.assign({}, lista[i], {
						nome: limpo.nome, descricao: limpo.descricao, tipo: limpo.tipo,
						definicao: limpo, alteradoPor: autor, alteradoEm: agora, versao: lista[i].versao + 1
					});
					gravarLocal(lista);
					return Promise.resolve(lista[i]);
				}
				var novo = {
					id: "local-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
					nome: limpo.nome, descricao: limpo.descricao, tipo: limpo.tipo,
					autor: autor, alteradoPor: autor, versao: 1, criadoEm: agora, alteradoEm: agora,
					definicao: limpo
				};
				lista.push(novo);
				gravarLocal(lista);
				return Promise.resolve(novo);
			}

			if (registro && registro.id) {
				return Backend.enviar("PUT", CAMINHO + "/" + encodeURIComponent(registro.id), corpo(def, autor, registro.versao)).catch(explicar);
			}
			return Backend.enviar("POST", CAMINHO, corpo(def, autor)).catch(explicar);
		},

		excluir: function (registro) {
			if (this.local()) {
				gravarLocal(lerLocal().filter(function (r) { return r.id !== registro.id; }));
				return Promise.resolve();
			}
			return Backend.enviar("DELETE", CAMINHO + "/" + encodeURIComponent(registro.id) +
				"?autor=" + encodeURIComponent(this.autor())).catch(explicar);
		},

		/** Arquivo .json para levar um relatorio de um ambiente a outro. */
		paraArquivo: function (registro) {
			return JSON.stringify({
				zrastreioRelatorio: motor.VERSAO,
				nome: registro.nome,
				definicao: motor.normalizar(registro.definicao)
			}, null, 2);
		},

		/** Le um arquivo exportado; devolve a definicao (sem id) ou lanca. */
		deArquivo: function (textoArquivo) {
			var dados;
			try {
				dados = JSON.parse(textoArquivo);
			} catch (e) {
				throw new Error("O arquivo não é um JSON válido.");
			}
			var def = dados && (dados.definicao || dados);
			if (!def || motor.TIPOS.indexOf(def.tipo) < 0) {
				throw new Error("O arquivo não contém um relatório do zrastreio.");
			}
			var limpo = motor.normalizar(def);
			delete limpo.id;
			return limpo;
		}
	};

	return Salvos;
});
