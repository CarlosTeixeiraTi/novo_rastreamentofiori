/**
 * Detalhamentos.
 *
 * Tudo o que e clicavel nas telas (card, item de lista, parcela de
 * indicador, gateway no mapa) abre uma lista exportavel para Excel. Esta e
 * a declaracao dessas listas: o que cada uma mostra e de onde sai.
 *
 * Mesma regra dos relatorios: nenhuma lista consulta sozinha. Todas leem o
 * MESMO snapshot da frota que pinta o numero do card — por isso a contagem
 * da lista sempre bate com o numero clicado.
 *
 * Cada funcao devolve { titulo, arquivo, colunas, linhas }. Tipos de coluna:
 *   equipamento  vira link para a ficha (quando o equipamento tem rastreador)
 *   gateway      vira link para o detalhe do gateway
 *   numero       alinhado a direita, exportado como numero
 *   percentual   fracao 0..1, exibida como "64,8%", exportada como percentual
 *   acao         link que abre outra lista (drill-down), pelo nome em `acao`
 *   (vazio)      texto
 *
 * `nota` (opcional) e uma linha de contexto exibida acima da tabela.
 *
 * Modulo puro: sem sap.m, roda no Node (test/regras).
 */
sap.ui.define([
	"./arvore",
	"./prefixo",
	"../Configuracoes",
	"./indicadores"
], function (
	arvore,
	prefixo,
	Configuracoes,
	indicadores
) {
	"use strict";

	var NAO_HABILITADA = "Tags Digitais Não Habilitadas";


	function texto(v) {
		return v === null || v === undefined ? "" : String(v);
	}

	/** Mesmo recorte do resumo em Frota: e o denominador dos cards. */
	function habilitados(d) {
		return ((d && d.ativos) || []).filter(function (a) {
			return a.grupoAtual !== NAO_HABILITADA;
		});
	}

	/** Mudos habilitados + mudos com cadastro divergente, sem repetir. */
	function semComunicacaoDe(d) {
		return ((d && d.ativos) || []).filter(function (a) {

			var habilitado =
				a.grupoAtual !== NAO_HABILITADA;

			if (!(a.mudo && (habilitado || a.cadastroDivergente))) {
				return false;
			}

			if (Configuracoes.obter("/modoCadastro") !== "piloto") {
				return true;
			}

			return (
				String(a.local || "").toUpperCase().startsWith("FEIT") &&
				!a.instalado
			);

		});
	}

	function linhaDeAtivo(a) {
		return {
			equipamento: texto(a.codigoOriginal || a.codigo),
			descricao: texto(a.descricao),
			local: texto(a.local),
			situacao: texto(a.grupoAtual),
			comunicacao: texto(a.silencioTexto),
			dias: isFinite(a.dias) ? Math.round(a.dias) : null,
			limite: a.limite === undefined ? null : a.limite,
			estado: (
				Configuracoes.obter("/modoCadastro") === "piloto" &&
				(
					!!a.instalado ||
					!String(a.local || "").toUpperCase().startsWith("FEIT")
				)
			)
				? "Comunicando"
				: (a.mudo ? "Sem comunicação" : "Comunicando")
		};
	}

	var COL = {
		equipamento: { chave: "equipamento", rotulo: "Equipamento", tipo: "equipamento", largura: "9rem" },
		descricao: { chave: "descricao", rotulo: "Descrição" },
		local: { chave: "local", rotulo: "Local de instalação", largura: "11rem" },
		situacao: { chave: "situacao", rotulo: "Situação" },
		comunicacao: { chave: "comunicacao", rotulo: "Última comunicação", largura: "10rem" },
		dias: { chave: "dias", rotulo: "Dias sem comunicar", tipo: "numero", largura: "9rem" },
		limite: { chave: "limite", rotulo: "Limite (dias)", tipo: "numero", largura: "7rem" },
		estado: { chave: "estado", rotulo: "Comunicação", largura: "9rem" }
	};

	function veiculoPorNome(d, nome) {
		var alvo = String(nome || "").toUpperCase();
		return (((d && d.conferencia) || {}).veiculos || []).filter(function (v) {
			return String(v.nome || "").toUpperCase() === alvo;
		})[0] || null;
	}

	/** Componentes rastreados de uma familia — os mesmos que a arvore contou. */
	function componentesDaFamilia(veiculos, familia) {
		var saida = [];
		(veiculos || []).forEach(function (v) {
			(v.linhas || []).forEach(function (l) {
				if (familia && l.familia !== familia) { return; }
				(l.itens || []).forEach(function (r) {
					saida.push({
						equipamento: texto(r.identificador),
						descricao: texto(r.descEquipamento),
						familia: texto(l.rotulo),
						veiculo: texto(v.nome),
						local: texto(v.local),
						situacao: texto(r.grupoAtual)
					});
				});
			});
		});
		return saida;
	}

	function linhaDeVeiculo(v) {
		return {
			veiculo: texto(v.nome),
			local: texto(v.local),
			prefixo: texto(prefixo.de(v.local)),
			naArvore: v.naArvore,
			comRastreador: v.comRastreador,
			cobertura: v.cobertura === undefined ? null : v.cobertura,
			situacao: v.naArvore === 0 ? "Sem árvore" : (v.conforme ? "Conforme" : "Divergente")
		};
	}

	var COLUNAS_VEICULO = [
		{ chave: "veiculo", rotulo: "Veículo", largura: "9rem" },
		{ chave: "local", rotulo: "Local de instalação", largura: "11rem" },
		{ chave: "prefixo", rotulo: "Prefixo", largura: "6rem" },
		{ chave: "naArvore", rotulo: "Na árvore SAP", tipo: "numero", largura: "8rem" },
		{ chave: "comRastreador", rotulo: "Com rastreador", tipo: "numero", largura: "8rem" },
		{ chave: "cobertura", rotulo: "Cobertura", tipo: "percentual", largura: "7rem" },
		{ chave: "situacao", rotulo: "Situação", largura: "8rem" }
	];

	var COLUNAS_COMPONENTE = [
		COL.equipamento,
		COL.descricao,
		{ chave: "familia", rotulo: "Família", largura: "9rem" },
		{ chave: "veiculo", rotulo: "Veículo", largura: "8rem" },
		{ chave: "local", rotulo: "Local do veículo", largura: "10rem" },
		{ chave: "situacao", rotulo: "Situação" }
	];

	function linhaDeNota(n) {
		return {
			equipamento: texto(n.equipamento),
			nota: texto(n.nota),
			ordem: texto(n.ordem_numero),
			texto: texto(n.txt_breve_nota),
			oficina: texto(n.oficina),
			local: texto(n.local_instalacao),
			status: texto(n.status_sistema),
			prioridade: texto(n.prioridade)
		};
	}

	var COLUNAS_NOTA = [
		COL.equipamento,
		{ chave: "nota", rotulo: "Nota", largura: "7rem" },
		{ chave: "ordem", rotulo: "Ordem", largura: "7rem" },
		{ chave: "texto", rotulo: "Texto breve" },
		{ chave: "oficina", rotulo: "Oficina", largura: "10rem" },
		{ chave: "local", rotulo: "Local de instalação", largura: "9rem" },
		{ chave: "status", rotulo: "Status sistema", largura: "7rem" },
		{ chave: "prioridade", rotulo: "Prioridade", largura: "6rem" }
	];

	function linhaDeOrdem(o) {
		return {
			equipamento: texto(o.equipamento),
			ordem: texto(o.ordem),
			nota: texto(o.nota),
			texto: texto(o.texto_breve_om),
			centroTrab: texto(o.centro_trab_resp),
			local: texto(o.local_instalacao),
			status: texto(o.status_sistema_om),
			criacao: texto(o.data_criacao)
		};
	}

	var COLUNAS_ORDEM = [
		COL.equipamento,
		{ chave: "ordem", rotulo: "Ordem", largura: "7rem" },
		{ chave: "nota", rotulo: "Nota", largura: "7rem" },
		{ chave: "texto", rotulo: "Texto breve" },
		{ chave: "centroTrab", rotulo: "Centro de trabalho", largura: "8rem" },
		{ chave: "local", rotulo: "Local de instalação", largura: "9rem" },
		{ chave: "status", rotulo: "Status", largura: "6rem" },
		{ chave: "criacao", rotulo: "Criada em", largura: "7rem" }
	];

	var COLUNAS_GATEWAY = [
		{ chave: "gateway", rotulo: "Gateway", tipo: "gateway", largura: "10rem" },
		{ chave: "id", rotulo: "ID", largura: "10rem" },
		{ chave: "localidade", rotulo: "Localidade" },
		{ chave: "condicao", rotulo: "Condição", largura: "9rem" },
		{ chave: "situacao", rotulo: "Situação", largura: "7rem" },
		{ chave: "leituras", rotulo: "Equipamentos lidos", tipo: "numero", largura: "9rem" }
	];

	var api = {

		/** Card "Rastreadores comunicando". */
		comunicando: function (d) {
			return {
				titulo: "Rastreadores comunicando",
				arquivo: "Rastreadores_Comunicando",
				colunas: [COL.equipamento, COL.descricao, COL.local, COL.situacao, COL.comunicacao],
				linhas: habilitados(d).filter(function (a) {

					if (Configuracoes.obter("/modoCadastro") === "piloto") {

						var local = String(a.local || "").toUpperCase();

						if (
							!!a.instalado ||
							!local.startsWith("FEIT")
						) {
							return true;
						}
					}

					return !a.mudo;

				}).map(linhaDeAtivo)
			};
		},

		/** Card "Sem comunicacao". Mesmo filtro do numero do card. */
		mudos: function (d) {
			return {
				titulo: "Rastreadores sem comunicação",
				arquivo: "Rastreadores_Sem_Comunicacao",
				colunas: [
					COL.equipamento,
					COL.descricao,
					COL.local,
					COL.situacao,
					COL.dias,
					COL.limite
				],
				linhas: semComunicacaoDe(d).map(linhaDeAtivo)
			};
		},

		/**
		 * Card "Sem comunicacao" da Sala de Controle: mudos habilitados + mudos
		 * com cadastro divergente (mesmo filtro de resumo.semComunicacao).
		 */
		semComunicacao: function (d) {
			return {
				titulo: "Rastreadores sem comunicação",
				arquivo: "Rastreadores_Sem_Comunicacao",
				colunas: [COL.equipamento, COL.descricao, COL.local, COL.situacao, COL.dias, COL.limite],
				linhas: semComunicacaoDe(d).map(linhaDeAtivo)
			};
		},

		/** Card "Rastreadores habilitados": comunicando + sem comunicacao. */
		habilitados: function (d) {
			return {
				titulo: "Rastreadores habilitados",
				arquivo: "Rastreadores_Habilitados",
				colunas: [
					COL.equipamento,
					COL.descricao,
					COL.local,
					COL.situacao,
					COL.estado,
					COL.comunicacao
				],
				linhas: habilitados(d).map(linhaDeAtivo)
			};
		},

		/** Todos os rastreadores habilitados, com o estado de comunicacao. */
		rastreadores: function (d) {
			return {
				titulo: "Rastreadores instalados",
				arquivo: "Rastreadores_Instalados",
				colunas: [COL.equipamento, COL.descricao, COL.local, COL.situacao, COL.estado, COL.comunicacao],
				linhas: habilitados(d).map(linhaDeAtivo)
			};
		},

		/** Cobertura da arvore SAP por familia. `aoClicarFamilia` abre os componentes. */
		porFamilia: function (d) {
			return {
				titulo: "Cobertura da árvore SAP por família",
				arquivo: "Cobertura_Arvore_SAP",
				colunas: [
					{ chave: "rotulo", rotulo: "Família", tipo: "acao", acao: "familia" },
					{ chave: "comRastreador", rotulo: "Com rastreador", tipo: "numero" },
					{ chave: "naArvore", rotulo: "Na árvore SAP", tipo: "numero" },
					{ chave: "cobertura", rotulo: "Cobertura", tipo: "percentual" }
				],
				linhas: ((d && d.porFamilia) || []).map(function (f) {
					return {
						familia: f.familia, rotulo: f.rotulo,
						comRastreador: f.comRastreador, naArvore: f.naArvore,
						cobertura: f.cobertura
					};
				})
			};
		},

		/** Componentes rastreados de uma familia, em todos os veiculos. */
		familia: function (d, familia) {
			return {
				titulo: "Rastreadores da família " + arvore.rotuloFamilia(familia),
				arquivo: "Rastreadores_" + String(familia || "").replace(/\s+/g, "_"),
				colunas: COLUNAS_COMPONENTE,
				linhas: componentesDaFamilia(((d && d.conferencia) || {}).veiculos, familia)
			};
		},

		/** Componentes de uma familia num veiculo — ou todos do veiculo. */
		veiculoFamilia: function (d, nomeVeiculo, familia) {
			var v = veiculoPorNome(d, nomeVeiculo);
			var rotulo = familia ? arvore.rotuloFamilia(familia) + " · " : "";
			return {
				titulo: rotulo + "Rastreadores no veículo " + texto(nomeVeiculo),
				arquivo: "Rastreadores_" + texto(nomeVeiculo) + (familia ? "_" + String(familia).replace(/\s+/g, "_") : ""),
				colunas: COLUNAS_COMPONENTE,
				linhas: v ? componentesDaFamilia([v], familia) : []
			};
		},

		/** Cards de Embarcados: todos, conformes ou divergentes. */
		veiculos: function (d, filtro) {
			var lista = (((d && d.conferencia) || {}).veiculos || []).filter(function (v) {
				if (filtro === "conformes") { return v.naArvore > 0 && v.conforme; }
				if (filtro === "divergentes") { return v.naArvore > 0 && !v.conforme; }
				return true;
			});
			var titulos = {
				conformes: ["Veículos conformes", "Veiculos_Conformes"],
				divergentes: ["Veículos divergentes", "Veiculos_Divergentes"]
			};
			var t = titulos[filtro] || ["Veículos conferidos", "Veiculos_Conferidos"];
			var colunas = COLUNAS_VEICULO.map(function (c) {
				return c.chave === "veiculo" ? Object.assign({}, c, { tipo: "acao", acao: "veiculo" }) : c;
			});
			return { titulo: t[0], arquivo: t[1], colunas: colunas, linhas: lista.map(linhaDeVeiculo) };
		},

		/** Veiculo × familia: a conferencia inteira aberta, linha a linha. */
		conferencia: function (d) {
			var linhas = [];
			(((d && d.conferencia) || {}).veiculos || []).forEach(function (v) {
				(v.linhas || []).forEach(function (l) {
					linhas.push({
						veiculo: texto(v.nome), local: texto(v.local), familiaId: l.familia, familia: texto(l.rotulo),
						naArvore: l.naArvore, comRastreador: l.comRastreador, diferenca: l.diferenca,
						resultado: l.diferenca === 0 ? "Confere" : (l.diferenca < 0 ? "Faltando " + Math.abs(l.diferenca) : "Sobrando " + l.diferenca)
					});
				});
			});
			return {
				titulo: "Conferência da árvore por veículo e família",
				arquivo: "Conferencia_Embarcados",
				colunas: [
					{ chave: "veiculo", rotulo: "Veículo", largura: "8rem" },
					{ chave: "local", rotulo: "Local de instalação", largura: "10rem" },
					{ chave: "familia", rotulo: "Família", tipo: "acao", acao: "veiculoFamilia" },
					{ chave: "naArvore", rotulo: "Na árvore SAP", tipo: "numero", largura: "8rem" },
					{ chave: "comRastreador", rotulo: "Com rastreador", tipo: "numero", largura: "8rem" },
					{ chave: "diferenca", rotulo: "Diferença", tipo: "numero", largura: "7rem" },
					{ chave: "resultado", rotulo: "Resultado", largura: "8rem" }
				],
				linhas: linhas
			};
		},

		/** Familias de um veiculo (tabela de baixo de Embarcados, arvore da ficha). */
		familiasDoVeiculo: function (d, nomeVeiculo, linhasDoVeiculo) {
			var v = veiculoPorNome(d, nomeVeiculo);
			var fonte = linhasDoVeiculo || (v && v.linhas) || [];
			return {
				titulo: "Árvore SAP do veículo " + texto(nomeVeiculo),
				arquivo: "Arvore_" + texto(nomeVeiculo),
				colunas: [
					{ chave: "familia", rotulo: "Família", tipo: "acao", acao: "veiculoFamilia" },
					{ chave: "naArvore", rotulo: "Na árvore SAP", tipo: "numero" },
					{ chave: "comRastreador", rotulo: "Com rastreador", tipo: "numero" },
					{ chave: "diferenca", rotulo: "Diferença", tipo: "numero" }
				],
				linhas: fonte.map(function (l) {
					return {
						veiculo: texto(nomeVeiculo), familiaId: l.familia, familia: texto(l.rotulo),
						naArvore: l.naArvore, comRastreador: l.comRastreador, diferenca: l.diferenca
					};
				})
			};
		},

		/** Cadastro divergente: SAP aponta para onde o componente nao esta. */
		divergentes: function (d) {
			return {
				titulo: "Cadastro divergente",
				arquivo: "Cadastro_Divergente",
				colunas: [
					COL.equipamento,
					COL.descricao,
					{ chave: "local", rotulo: "Local declarado", largura: "10rem" },
					{ chave: "deslocamento", rotulo: "Deslocamento (m)", tipo: "numero", largura: "9rem" },
					{ chave: "gateways", rotulo: "Gateways que leram" }
				],
				linhas: ((d && d.divergentes) || []).map(function (x) {
					return {
						equipamento: texto(x.identificador),
						descricao: texto(x.descEquipamento),
						local: texto(x.localInstalacao),
						deslocamento: x.distanciaM === undefined ? null : x.distanciaM,
						gateways: (x.gateways || []).join(", ")
					};
				})
			};
		},

		/** Gateways. `somenteAtivos` casa com o card "Gateways ativos". */
		gateways: function (d, somenteAtivos) {
			var leituras = {};
			((d && d.ativos) || []).forEach(function (a) {
				if (a.gateway) { leituras[a.gateway] = (leituras[a.gateway] || 0) + 1; }
			});
			return {
				titulo: somenteAtivos ? "Gateways ativos" : "Gateways cadastrados",
				arquivo: somenteAtivos ? "Gateways_Ativos" : "Gateways",
				colunas: COLUNAS_GATEWAY,
				linhas: ((d && d.gateways) || []).filter(function (g) {
					return !somenteAtivos || g.ativo;
				}).map(function (g) {
					var chave = g.identificador || g.id;
					return {
						gateway: texto(chave),
						id: texto(g.id),
						localidade: texto(g.localidade),
						condicao: texto(g.condicao),
						situacao: g.ativo ? "Ativo" : "Inativo",
						leituras: leituras[chave] || leituras[g.id] || 0
					};
				})
			};
		},

		/** Equipamentos cuja ultima leitura veio deste gateway. */
		doGateway: function (d, gateway) {
			var alvo = String(gateway || "");
			return {
				titulo: "Equipamentos lidos pelo gateway " + alvo,
				arquivo: "Gateway_" + alvo.replace(/[^\w-]+/g, "_"),
				colunas: [COL.equipamento, COL.descricao, COL.local, COL.situacao, COL.comunicacao],
				linhas: ((d && d.ativos) || []).filter(function (a) {
					return String(a.gateway || "") === alvo;
				}).map(linhaDeAtivo)
			};
		},

		/** Ultimas mudancas de situacao (Sala de Controle). */
		movimentacoes: function (d) {
			return {
				titulo: "Últimas mudanças de situação",
				arquivo: "Ultimas_Mudancas",
				colunas: [
					COL.equipamento,
					COL.descricao,
					{ chave: "de", rotulo: "De" },
					{ chave: "para", rotulo: "Para" },
					{ chave: "oficina", rotulo: "Oficina", largura: "10rem" },
					{ chave: "quando", rotulo: "Quando", largura: "8rem" }
				],
				linhas: ((d && d.movimentacoes) || []).map(function (m) {
					return {
						equipamento: texto(m.codigo), descricao: texto(m.descricao),
						de: texto(m.de), para: texto(m.para),
						oficina: texto(m.oficina), quando: texto(m.quando)
					};
				})
			};
		},

		/** Notas YA. `lista` permite passar as notas de um equipamento so. */
		notas: function (d, lista, titulo) {
			return {
				titulo: titulo || "Notas abertas",
				arquivo: "Notas",
				colunas: COLUNAS_NOTA,
				linhas: (lista || (d && d.notas) || []).map(linhaDeNota)
			};
		},

		ordens: function (d, lista, titulo) {
			return {
				titulo: titulo || "Ordens de manutenção",
				arquivo: "Ordens",
				colunas: COLUNAS_ORDEM,
				linhas: (lista || (d && d.ordens) || []).map(linhaDeOrdem)
			};
		},

		/** Nota aberta cujo equipamento nao tem tag — ninguem acompanha. */
		notasSemRastreador: function (d) {
			var comTag = {};
			((d && d.ativos) || []).forEach(function (a) { comTag[a.codigo] = true; });
			return {
				titulo: "Notas abertas sem rastreador",
				arquivo: "Notas_Sem_Rastreador",
				colunas: COLUNAS_NOTA,
				linhas: ((d && d.notas) || []).filter(function (n) {
					return !comTag[prefixo.chave(n.equipamento)];
				}).map(linhaDeNota)
			};
		},

		/** Composicao do indice geral. Cada parcela abre a propria lista. */
		efetividade: function (d) {
			var r = (d && d.indicadores) || {};
			var ind = indicadores.obter("efetividade");
			var medidas = ind.parcelas.filter(function (p) { return r[p.id] && r[p.id].valor !== null && r[p.id].valor !== undefined; });
			var pesoTotal = medidas.reduce(function (s, p) { return s + p.peso; }, 0);
			var linhas = ind.parcelas.map(function (p) {
				var x = r[p.id] || {};
				var medido = x.valor !== null && x.valor !== undefined;
				var pesoEfetivo = medido && pesoTotal ? p.peso / pesoTotal : null;
				return {
					parcela: p.id,
					titulo: texto((indicadores.obter(p.id) || {}).titulo),
					valor: medido ? x.valor : null,
					numerador: x.numerador === undefined ? null : x.numerador,
					denominador: x.denominador === undefined ? null : x.denominador,
					peso: pesoEfetivo,
					contribuicao: pesoEfetivo === null ? null : x.valor * pesoEfetivo
				};
			});
			var geral = r.efetividade && r.efetividade.valor;
			linhas.push({
				parcela: null, titulo: "Índice geral de efetividade",
				valor: geral === undefined ? null : geral,
				numerador: null, denominador: null,
				peso: pesoTotal ? 1 : null,
				contribuicao: geral === undefined ? null : geral
			});
			var e = r.efetividade && r.efetividade.parcelas ? indicadores.explicar("efetividade", r) : null;
			return {
				titulo: "Índice geral de efetividade — composição",
				nota: e ? e.formula + "\n" + e.conta : "",
				arquivo: "Indice_Efetividade",
				colunas: [
					{ chave: "titulo", rotulo: "Parcela", tipo: "acao", acao: "parcela" },
					{ chave: "numerador", rotulo: "Numerador", tipo: "numero", largura: "7rem" },
					{ chave: "denominador", rotulo: "Denominador", tipo: "numero", largura: "7rem" },
					{ chave: "valor", rotulo: "Valor", tipo: "percentual", largura: "7rem" },
					{ chave: "peso", rotulo: "Peso", tipo: "percentual", largura: "6rem" },
					{ chave: "contribuicao", rotulo: "Contribuição", tipo: "percentual", largura: "8rem" }
				],
				linhas: linhas
			};
		},

		/** Lista por tras de cada parcela do indice. */
		parcela: function (d, id) {
			var def = null;
			if (id === "cobertura") { def = api.porFamilia(d); }
			if (id === "disponibilidade") { def = api.rastreadores(d); }
			if (id === "gateways") { def = api.gateways(d, false); }
			if (id === "efetividade") { return api.efetividade(d); }
			if (!def) { return null; }
			var e = indicadores.explicar(id, (d && d.indicadores) || {});
			if (e) { def.nota = e.titulo + ": " + e.conta; }
			return def;
		},

		/** Linha do tempo de leituras de um equipamento (ficha). */
		historico: function (detalhe) {
			var a = (detalhe && detalhe.ativo) || {};
			return {
				titulo: "Linha do tempo · " + texto(a.codigoOriginal),
				arquivo: "Linha_do_Tempo_" + texto(prefixo.chave(a.codigoOriginal || a.codigo)),
				colunas: [
					{ chave: "recebidoEm", rotulo: "Recebido em", largura: "10rem" },
					{ chave: "grupo", rotulo: "Grupo" },
					{ chave: "gateway", rotulo: "Gateway", tipo: "gateway", largura: "10rem" },
					{ chave: "comunicacao", rotulo: "Comunicação", largura: "8rem" },
					{ chave: "mudou", rotulo: "Mudou de grupo", largura: "7rem" }
				],
				linhas: ((detalhe && detalhe.historico) || []).map(function (h) {
					return {
						recebidoEm: texto(h.recebidoEm), grupo: texto(h.grupo), gateway: texto(h.gateway),
						comunicacao: texto(h.comunicacao), mudou: h.mudou ? "Sim" : ""
					};
				})
			};
		}
	};

	return api;
});
