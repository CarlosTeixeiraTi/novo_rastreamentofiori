/**
 * Catalogo de fontes e campos dos relatorios personalizados.
 *
 * E o unico lugar que diz o que o usuario pode escolher. Cada fonte le o
 * MESMO snapshot da frota que pinta as telas (modelo "frota"), entao um
 * relatorio personalizado nunca discorda de um card.
 *
 * Nada aqui foi inventado: cada campo sai de uma propriedade que o Frota ja
 * monta a partir do API_Hana.
 *
 * Tipos de campo:
 *   texto | numero | percentual (fracao 0..1) | data | booleano
 * `equipamento: true` marca o campo que leva a ficha no drill-down.
 *
 * Modulo puro: roda no Node (test/regras).
 */
sap.ui.define([
	"./prefixo",
	"./arvore"
], function (prefixo, arvore) {
	"use strict";

	var NAO_HABILITADA = "Tags Digitais Não Habilitadas";
	var DESATUALIZADA = "Tags Digitais desatualizadas";

	function texto(v) {
		return v === null || v === undefined ? "" : String(v);
	}

	function numeroOuNulo(v) {
		if (v === null || v === undefined || v === "") { return null; }
		var n = Number(v);
		return isFinite(n) ? n : null;
	}

	function mapaComTag(d) {
		var comTag = {};
		((d && d.ativos) || []).forEach(function (a) { comTag[a.codigo] = true; });
		return comTag;
	}

	/**
	 * Cada fonte: rotulo, descricao, `linhas(d)` que devolve objetos planos
	 * { campoId: valor }, os campos e as colunas padrao do drill-down.
	 */
	var FONTES = {

		rastreadores: {
			rotulo: "Rastreadores",
			descricao: "Um registro por equipamento com rastreador, no recorte de prefixo atual.",
			campos: [
				{ id: "equipamento", rotulo: "Equipamento", tipo: "texto", equipamento: true },
				{ id: "descricao", rotulo: "Descrição", tipo: "texto" },
				{ id: "familia", rotulo: "Família", tipo: "texto" },
				{ id: "local", rotulo: "Local de instalação", tipo: "texto" },
				{ id: "descLocal", rotulo: "Descrição do local", tipo: "texto" },
				{ id: "prefixo", rotulo: "Prefixo (4 primeiros do local)", tipo: "texto" },
				{ id: "centro", rotulo: "Centro", tipo: "texto" },
				{ id: "situacao", rotulo: "Situação atual", tipo: "texto" },
				{ id: "situacaoAnterior", rotulo: "Situação anterior", tipo: "texto" },
				{ id: "veiculo", rotulo: "Veículo", tipo: "texto" },
				{ id: "instalado", rotulo: "Instalado em veículo", tipo: "booleano" },
				{ id: "gateway", rotulo: "Gateway", tipo: "texto" },
				{ id: "oficina", rotulo: "Oficina", tipo: "texto" },
				{ id: "nota", rotulo: "Nota", tipo: "texto" },
				{ id: "ordem", rotulo: "Ordem", tipo: "texto" },
				{ id: "habilitado", rotulo: "Habilitado (conta nos indicadores)", tipo: "booleano" },
				{ id: "comunicando", rotulo: "Comunicando", tipo: "booleano" },
				{ id: "mudo", rotulo: "Sem comunicação (mudo)", tipo: "booleano" },
				{ id: "dias", rotulo: "Dias sem comunicar", tipo: "numero" },
				{ id: "limite", rotulo: "Limite de silêncio (dias)", tipo: "numero" },
				{ id: "ultimaAtualizacao", rotulo: "Última comunicação", tipo: "data" },
				{ id: "confianca", rotulo: "Confiança do cadastro", tipo: "texto" },
				{ id: "noSap", rotulo: "Cadastrado no SAP", tipo: "booleano" },
				{ id: "amostras", rotulo: "Amostras analisadas", tipo: "numero" }
			],
			colunasPadrao: ["equipamento", "descricao", "local", "situacao", "dias"],
			linhas: function (d) {
				return ((d && d.ativos) || []).map(function (a) {
					return {
						equipamento: texto(a.codigoOriginal || a.codigo).replace(/^0+(?=.)/, ""),
						descricao: texto(a.descricao),
						familia: a.familia ? arvore.rotuloFamilia(a.familia) : "",
						local: texto(a.local),
						descLocal: texto(a.descLocal),
						prefixo: texto(a.prefixo || prefixo.de(a.local)),
						centro: texto(a.centro),
						situacao: texto(a.grupoAtual),
						situacaoAnterior: texto(a.grupoAnterior),
						veiculo: texto(a.veiculo),
						instalado: !!a.instalado,
						gateway: texto(a.gateway),
						oficina: texto(a.oficina),
						nota: texto(a.nota),
						ordem: texto(a.ordem),
						habilitado: a.grupoAtual !== NAO_HABILITADA && a.grupoAtual !== DESATUALIZADA,
						comunicando: !a.mudo,
						mudo: !!a.mudo,
						dias: isFinite(a.dias) ? Math.round(a.dias) : null,
						limite: numeroOuNulo(a.limite),
						ultimaAtualizacao: a.ultimaAtualizacao || null,
						confianca: texto(a.confianca),
						noSap: !!a.noSap,
						amostras: numeroOuNulo(a.amostras)
					};
				});
			}
		},

		veiculos: {
			rotulo: "Veículos (conferência da árvore)",
			descricao: "Um registro por veículo com pelo menos um equipamento rastreado.",
			campos: [
				{ id: "veiculo", rotulo: "Veículo", tipo: "texto" },
				{ id: "local", rotulo: "Local de instalação", tipo: "texto" },
				{ id: "prefixo", rotulo: "Prefixo (4 primeiros do local)", tipo: "texto" },
				{ id: "mina", rotulo: "Mina", tipo: "texto" },
				{ id: "naArvore", rotulo: "Componentes na árvore SAP", tipo: "numero" },
				{ id: "comRastreador", rotulo: "Componentes com rastreador", tipo: "numero" },
				{ id: "cobertos", rotulo: "Componentes cobertos", tipo: "numero" },
				{ id: "cobertura", rotulo: "Cobertura da árvore", tipo: "percentual" },
				{ id: "conforme", rotulo: "Conforme", tipo: "booleano" },
				{ id: "situacao", rotulo: "Situação", tipo: "texto" }
			],
			colunasPadrao: ["veiculo", "local", "naArvore", "comRastreador", "cobertura", "situacao"],
			linhas: function (d) {
				return (((d && d.conferencia) || {}).veiculos || []).map(function (v) {
					return {
						veiculo: texto(v.nome),
						local: texto(v.local),
						prefixo: texto(prefixo.de(v.local)),
						mina: texto(v.mina),
						naArvore: numeroOuNulo(v.naArvore),
						comRastreador: numeroOuNulo(v.comRastreador),
						cobertos: numeroOuNulo(v.cobertos),
						cobertura: v.cobertura === undefined ? null : v.cobertura,
						conforme: !!(v.conforme && v.naArvore > 0),
						situacao: v.naArvore === 0 ? "Sem árvore" : (v.conforme ? "Conforme" : "Divergente")
					};
				});
			}
		},

		veiculoFamilia: {
			rotulo: "Veículo × família",
			descricao: "Um registro por família em cada veículo: o que a árvore declara e o que tem tag.",
			campos: [
				{ id: "veiculo", rotulo: "Veículo", tipo: "texto" },
				{ id: "local", rotulo: "Local de instalação", tipo: "texto" },
				{ id: "prefixo", rotulo: "Prefixo (4 primeiros do local)", tipo: "texto" },
				{ id: "familia", rotulo: "Família", tipo: "texto" },
				{ id: "naArvore", rotulo: "Na árvore SAP", tipo: "numero" },
				{ id: "comRastreador", rotulo: "Com rastreador", tipo: "numero" },
				{ id: "cobertos", rotulo: "Cobertos", tipo: "numero" },
				{ id: "diferenca", rotulo: "Diferença (tag − árvore)", tipo: "numero" },
				{ id: "resultado", rotulo: "Resultado", tipo: "texto" }
			],
			colunasPadrao: ["veiculo", "familia", "naArvore", "comRastreador", "diferenca"],
			linhas: function (d) {
				var saida = [];
				(((d && d.conferencia) || {}).veiculos || []).forEach(function (v) {
					(v.linhas || []).forEach(function (l) {
						saida.push({
							veiculo: texto(v.nome),
							local: texto(v.local),
							prefixo: texto(prefixo.de(v.local)),
							familia: texto(l.rotulo),
							naArvore: numeroOuNulo(l.naArvore),
							comRastreador: numeroOuNulo(l.comRastreador),
							cobertos: numeroOuNulo(l.cobertos),
							diferenca: numeroOuNulo(l.diferenca),
							resultado: l.diferenca === 0 ? "Confere" : (l.diferenca < 0 ? "Faltando" : "Sobrando")
						});
					});
				});
				return saida;
			}
		},

		gateways: {
			rotulo: "Gateways",
			descricao: "Infraestrutura de leitura cadastrada.",
			campos: [
				{ id: "gateway", rotulo: "Gateway", tipo: "texto" },
				{ id: "id", rotulo: "ID", tipo: "texto" },
				{ id: "localidade", rotulo: "Localidade", tipo: "texto" },
				{ id: "condicao", rotulo: "Condição", tipo: "texto" },
				{ id: "ativo", rotulo: "Ativo", tipo: "booleano" },
				{ id: "equipamentosLidos", rotulo: "Equipamentos lidos", tipo: "numero" }
			],
			colunasPadrao: ["gateway", "localidade", "condicao", "ativo", "equipamentosLidos"],
			linhas: function (d) {
				var lidos = {};
				((d && d.ativos) || []).forEach(function (a) {
					if (a.gateway) { lidos[a.gateway] = (lidos[a.gateway] || 0) + 1; }
				});
				return ((d && d.gateways) || []).map(function (g) {
					var chave = g.identificador || g.id;
					return {
						gateway: texto(chave),
						id: texto(g.id),
						localidade: texto(g.localidade),
						condicao: texto(g.condicao),
						ativo: !!g.ativo,
						equipamentosLidos: lidos[chave] || lidos[g.id] || 0
					};
				});
			}
		},

		notas: {
			rotulo: "Notas de manutenção (YA)",
			descricao: "Notas abertas, de todos os equipamentos — com ou sem rastreador.",
			campos: [
				{ id: "equipamento", rotulo: "Equipamento", tipo: "texto", equipamento: true },
				{ id: "nota", rotulo: "Nota", tipo: "texto" },
				{ id: "tipoNota", rotulo: "Tipo de nota", tipo: "texto" },
				{ id: "ordem", rotulo: "Ordem", tipo: "texto" },
				{ id: "texto", rotulo: "Texto breve", tipo: "texto" },
				{ id: "oficina", rotulo: "Oficina", tipo: "texto" },
				{ id: "centroTrab", rotulo: "Centro de trabalho", tipo: "texto" },
				{ id: "centro", rotulo: "Centro de localização", tipo: "texto" },
				{ id: "local", rotulo: "Local de instalação", tipo: "texto" },
				{ id: "prefixo", rotulo: "Prefixo (4 primeiros do local)", tipo: "texto" },
				{ id: "status", rotulo: "Status sistema", tipo: "texto" },
				{ id: "statusUsuario", rotulo: "Status usuário", tipo: "texto" },
				{ id: "prioridade", rotulo: "Prioridade", tipo: "texto" },
				{ id: "dataCriacao", rotulo: "Data de criação", tipo: "data" },
				{ id: "dataModificacao", rotulo: "Data de modificação", tipo: "data" },
				{ id: "inicioDesejado", rotulo: "Início desejado", tipo: "data" },
				{ id: "conclusaoDesejada", rotulo: "Conclusão desejada", tipo: "data" },
				{ id: "temRastreador", rotulo: "Equipamento tem rastreador", tipo: "booleano" }
			],
			colunasPadrao: ["equipamento", "nota", "texto", "oficina", "status", "prioridade"],
			linhas: function (d) {
				var comTag = mapaComTag(d);
				return ((d && d.notas) || []).map(function (n) {
					return {
						equipamento: texto(n.equipamento).replace(/^0+(?=.)/, ""),
						nota: texto(n.nota),
						tipoNota: texto(n.tipo_nota),
						ordem: texto(n.ordem_numero),
						texto: texto(n.txt_breve_nota),
						oficina: texto(n.oficina),
						centroTrab: texto(n.centro_trabalho_respons),
						centro: texto(n.centro_localizacao),
						local: texto(n.local_instalacao),
						prefixo: texto(prefixo.de(n.local_instalacao)),
						status: texto(n.status_sistema),
						statusUsuario: texto(n.status_usuario),
						prioridade: texto(n.prioridade),
						dataCriacao: n.data_criacao || null,
						dataModificacao: n.data_modificacao || null,
						inicioDesejado: n.dt_inicio_desejado || null,
						conclusaoDesejada: n.dt_conclusao_desejado || null,
						temRastreador: !!comTag[prefixo.chave(n.equipamento)]
					};
				});
			}
		},

		ordens: {
			rotulo: "Ordens de manutenção",
			descricao: "Ordens ligadas aos equipamentos rastreados.",
			campos: [
				{ id: "equipamento", rotulo: "Equipamento", tipo: "texto", equipamento: true },
				{ id: "ordem", rotulo: "Ordem", tipo: "texto" },
				{ id: "nota", rotulo: "Nota", tipo: "texto" },
				{ id: "texto", rotulo: "Texto breve", tipo: "texto" },
				{ id: "centroTrab", rotulo: "Centro de trabalho", tipo: "texto" },
				{ id: "centro", rotulo: "Centro", tipo: "texto" },
				{ id: "local", rotulo: "Local de instalação", tipo: "texto" },
				{ id: "prefixo", rotulo: "Prefixo (4 primeiros do local)", tipo: "texto" },
				{ id: "status", rotulo: "Status sistema", tipo: "texto" },
				{ id: "statusUsuario", rotulo: "Status usuário", tipo: "texto" },
				{ id: "dataCriacao", rotulo: "Data de criação", tipo: "data" },
				{ id: "temRastreador", rotulo: "Equipamento tem rastreador", tipo: "booleano" }
			],
			colunasPadrao: ["equipamento", "ordem", "texto", "centroTrab", "status", "dataCriacao"],
			linhas: function (d) {
				var comTag = mapaComTag(d);
				return ((d && d.ordens) || []).map(function (o) {
					return {
						equipamento: texto(o.equipamento).replace(/^0+(?=.)/, ""),
						ordem: texto(o.ordem),
						nota: texto(o.nota),
						texto: texto(o.texto_breve_om),
						centroTrab: texto(o.centro_trab_resp),
						centro: texto(o.centro_centro_trabalho),
						local: texto(o.local_instalacao),
						prefixo: texto(prefixo.de(o.local_instalacao)),
						status: texto(o.status_sistema_om),
						statusUsuario: texto(o.status_usuario_om),
						dataCriacao: o.data_criacao || null,
						temRastreador: !!comTag[prefixo.chave(o.equipamento)]
					};
				});
			}
		},

		divergentes: {
			rotulo: "Cadastro divergente",
			descricao: "Equipamentos que mudaram de posição e de gateway sem o local de instalação mudar.",
			campos: [
				{ id: "equipamento", rotulo: "Equipamento", tipo: "texto", equipamento: true },
				{ id: "descricao", rotulo: "Descrição", tipo: "texto" },
				{ id: "local", rotulo: "Local declarado", tipo: "texto" },
				{ id: "prefixo", rotulo: "Prefixo (4 primeiros do local)", tipo: "texto" },
				{ id: "deslocamento", rotulo: "Deslocamento (m)", tipo: "numero" },
				{ id: "gateways", rotulo: "Gateways que leram", tipo: "texto" },
				{ id: "qtdGateways", rotulo: "Quantidade de gateways", tipo: "numero" }
			],
			colunasPadrao: ["equipamento", "descricao", "local", "deslocamento", "gateways"],
			linhas: function (d) {
				return ((d && d.divergentes) || []).map(function (x) {
					return {
						equipamento: texto(x.identificador).replace(/^0+(?=.)/, ""),
						descricao: texto(x.descEquipamento),
						local: texto(x.localInstalacao),
						prefixo: texto(prefixo.de(x.localInstalacao)),
						deslocamento: numeroOuNulo(x.distanciaM),
						gateways: (x.gateways || []).join(", "),
						qtdGateways: (x.gateways || []).length
					};
				});
			}
		}
	};

	/** Operadores por tipo de campo. `valores`: quantos valores o operador pede. */
	var OPERADORES = {
		igual: { rotulo: "é igual a", valores: 1, tipos: ["texto", "numero", "percentual", "data"] },
		diferente: { rotulo: "é diferente de", valores: 1, tipos: ["texto", "numero", "percentual", "data"] },
		contem: { rotulo: "contém", valores: 1, tipos: ["texto"] },
		naoContem: { rotulo: "não contém", valores: 1, tipos: ["texto"] },
		comecaCom: { rotulo: "começa com", valores: 1, tipos: ["texto"] },
		em: { rotulo: "está na lista (separe por vírgula)", valores: 1, tipos: ["texto", "numero"] },
		maior: { rotulo: "maior que", valores: 1, tipos: ["numero", "percentual", "data"] },
		maiorIgual: { rotulo: "maior ou igual a", valores: 1, tipos: ["numero", "percentual", "data"] },
		menor: { rotulo: "menor que", valores: 1, tipos: ["numero", "percentual", "data"] },
		menorIgual: { rotulo: "menor ou igual a", valores: 1, tipos: ["numero", "percentual", "data"] },
		entre: { rotulo: "entre (inclusive)", valores: 2, tipos: ["numero", "percentual", "data"] },
		ultimosDias: { rotulo: "nos últimos N dias", valores: 1, tipos: ["data"] },
		verdadeiro: { rotulo: "é verdadeiro", valores: 0, tipos: ["booleano"] },
		falso: { rotulo: "é falso", valores: 0, tipos: ["booleano"] },
		vazio: { rotulo: "está vazio", valores: 0, tipos: ["texto", "numero", "percentual", "data"] },
		naoVazio: { rotulo: "não está vazio", valores: 0, tipos: ["texto", "numero", "percentual", "data"] }
	};

	/** Agregacoes. `campo`: se precisa de um campo; `tipos`: quais tipos aceitam. */
	var AGREGACOES = {
		contagem: { rotulo: "Contagem de registros", campo: false },
		contagemDistinta: { rotulo: "Contagem de valores distintos", campo: true, tipos: ["texto", "numero", "percentual", "data", "booleano"] },
		soma: { rotulo: "Soma", campo: true, tipos: ["numero"] },
		media: { rotulo: "Média", campo: true, tipos: ["numero", "percentual"] },
		minimo: { rotulo: "Mínimo", campo: true, tipos: ["numero", "percentual", "data"] },
		maximo: { rotulo: "Máximo", campo: true, tipos: ["numero", "percentual", "data"] },
		verdadeiros: { rotulo: "Contagem de verdadeiros", campo: true, tipos: ["booleano"] }
	};

	/** Transformacoes de agrupamento (linhas, colunas, metrica por grupo). */
	var TRANSFORMACOES = {
		valor: { rotulo: "Valor inteiro", tipos: ["texto", "numero", "percentual", "data", "booleano"] },
		primeiros: { rotulo: "Primeiros N caracteres", tipos: ["texto"], parametro: "N caracteres" },
		ultimos: { rotulo: "Últimos N caracteres", tipos: ["texto"], parametro: "N caracteres" },
		faixa: { rotulo: "Faixas de tamanho N", tipos: ["numero"], parametro: "Tamanho da faixa" },
		dia: { rotulo: "Dia", tipos: ["data"] },
		mes: { rotulo: "Mês", tipos: ["data"] },
		ano: { rotulo: "Ano", tipos: ["data"] }
	};

	var api = {
		FONTES: FONTES,
		OPERADORES: OPERADORES,
		AGREGACOES: AGREGACOES,
		TRANSFORMACOES: TRANSFORMACOES,

		fonte: function (id) {
			return FONTES[id] || null;
		},

		campo: function (fonteId, campoId) {
			var f = FONTES[fonteId];
			if (!f) { return null; }
			for (var i = 0; i < f.campos.length; i++) {
				if (f.campos[i].id === campoId) { return f.campos[i]; }
			}
			return null;
		},

		/** Lista [{ id, rotulo }] para seletores. */
		listaFontes: function () {
			return Object.keys(FONTES).map(function (id) {
				return { id: id, rotulo: FONTES[id].rotulo, descricao: FONTES[id].descricao };
			});
		},

		operadoresPara: function (tipo) {
			return Object.keys(OPERADORES).filter(function (k) {
				return OPERADORES[k].tipos.indexOf(tipo) >= 0;
			}).map(function (k) { return { id: k, rotulo: OPERADORES[k].rotulo, valores: OPERADORES[k].valores }; });
		},

		agregacoesPara: function (tipo) {
			return Object.keys(AGREGACOES).filter(function (k) {
				var a = AGREGACOES[k];
				return !a.campo || !tipo || a.tipos.indexOf(tipo) >= 0;
			}).map(function (k) { return { id: k, rotulo: AGREGACOES[k].rotulo, campo: AGREGACOES[k].campo }; });
		},

		transformacoesPara: function (tipo) {
			return Object.keys(TRANSFORMACOES).filter(function (k) {
				return TRANSFORMACOES[k].tipos.indexOf(tipo) >= 0;
			}).map(function (k) { return { id: k, rotulo: TRANSFORMACOES[k].rotulo, parametro: TRANSFORMACOES[k].parametro || null }; });
		},

		/** Campos que existem em TODAS as fontes dadas (agrupar metrica por grupo). */
		camposComuns: function (fontesIds) {
			var ids = (fontesIds || []).filter(function (f) { return FONTES[f]; });
			if (!ids.length) { return []; }
			return FONTES[ids[0]].campos.filter(function (c) {
				return ids.every(function (f) {
					var outro = api.campo(f, c.id);
					return outro && outro.tipo === c.tipo;
				});
			});
		},

		/** Linhas de uma fonte a partir do snapshot da frota. */
		linhas: function (fonteId, d) {
			var f = FONTES[fonteId];
			return f ? f.linhas(d || {}) : [];
		}
	};

	return api;
});
