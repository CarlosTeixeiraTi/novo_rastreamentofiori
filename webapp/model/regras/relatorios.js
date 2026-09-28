/**
 * Relatorios.
 *
 * Nenhum deles consulta endpoint proprio: todos saem da MESMA frota que
 * alimenta as outras telas. Relatorio que consulta sozinho e relatorio que
 * um dia discorda da tela que o originou.
 *
 * Cada um declara a pergunta que responde e o que fazer com a resposta.
 * Relatorio sem essas duas frases vira planilha que ninguem abre duas vezes.
 *
 * `tipo` nas colunas segue regras/detalhamentos: "equipamento" vira link para
 * a ficha, "gateway" para os equipamentos do gateway, "acao" para outra lista.
 */
sap.ui.define([
	"./arvore",
	"./silencio",
	"./prefixo"
], function (arvore, silencio, prefixo) {
	"use strict";

	function texto(v) {
		return v === null || v === undefined ? "" : String(v);
	}

	var RELATORIOS = [
		{
			id: "sem-rastreador",
			titulo: "Componentes da árvore sem rastreador",
			pergunta: "O que a árvore SAP declara nos veículos rastreados e não tem tag.",
			acao: "É a fila de instalação. Cada linha é um componente que a operação acha que acompanha e não acompanha.",
			colunas: [
				{ chave: "veiculo", rotulo: "Veículo", largura: "12em", tipo: "acao", acao: "veiculo" },
				{ chave: "local", rotulo: "Local de instalação", largura: "16em" },
				{ chave: "familia", rotulo: "Família", largura: "14em" },
				{ chave: "naArvore", rotulo: "Na árvore SAP", largura: "9em" },
				{ chave: "comRastreador", rotulo: "Com rastreador", largura: "9em" },
				{ chave: "faltando", rotulo: "Faltando", largura: "8em" }
			],
			linhas: function (ctx) {
				var saida = [];
				(ctx.conferencia.veiculos || []).forEach(function (v) {
					v.linhas.forEach(function (l) {
						if (l.diferenca >= 0) { return; }
						saida.push({
							veiculo: v.nome, local: texto(v.local), familia: l.rotulo,
							naArvore: l.naArvore, comRastreador: l.comRastreador, faltando: Math.abs(l.diferenca)
						});
					});
				});
				return saida;
			}
		},
		{
			id: "em-silencio",
			titulo: "Rastreadores em silêncio",
			pergunta: "Sem comunicação além do limite esperado: 15 dias para equipamentos embarcados e 7 dias para equipamentos fora de operação.",
			acao: "Aqui a cobertura mente para quem só olha o total: a tag existe, mas não está entregando nada.",
			colunas: [
				{ chave: "equipamento", rotulo: "Equipamento", largura: "12em", tipo: "equipamento" },
				{ chave: "descricao", rotulo: "Descrição", largura: "22em" },
				{ chave: "grupo", rotulo: "Situação", largura: "16em" },
				{ chave: "local", rotulo: "Local de instalação", largura: "14em" },
				{ chave: "dias", rotulo: "Dias sem comunicar", largura: "10em" },
				{ chave: "limite", rotulo: "Limite aplicado", largura: "9em" }
			],
			linhas: function (ctx) {
				return (ctx.ativos || [])
					.filter(function (a) {
						return a.mudo;
					})
					.map(function (a) {
						return {
							equipamento: texto(a.codigoOriginal).replace(/^0+/, ""),
							descricao: texto(a.descricao),
							grupo: texto(a.grupoAtual),
							local: texto(a.local),
							dias: isFinite(a.dias) ? Math.round(a.dias) : "nunca",
							limite: a.limite
						};
					});
			}
		},
		{
			id: "cadastro-divergente",
			titulo: "Local do equipamento possivelmente desatualizado",
			pergunta: "O equipamento mudou de posição e de gateway, e o local de instalação declarado não mudou.",
			acao: "Não é falha de rastreador: é o SAP apontando para um lugar onde o componente não está mais.",
			colunas: [
				{ chave: "equipamento", rotulo: "Equipamento", largura: "12em", tipo: "equipamento" },
				{ chave: "descricao", rotulo: "Descrição", largura: "22em" },
				{ chave: "local", rotulo: "Local declarado", largura: "14em" },
				{ chave: "deslocamento", rotulo: "Deslocamento (m)", largura: "10em" },
				{ chave: "gateways", rotulo: "Gateways que leram", largura: "18em" }
			],
			linhas: function (ctx) {
				return (ctx.divergentes || []).map(function (d) {
					return {
						equipamento: texto(d.identificador).replace(/^0+/, ""),
						descricao: texto(d.descEquipamento),
						local: texto(d.localInstalacao),
						deslocamento: d.distanciaM,
						gateways: (d.gateways || []).join(", ")
					};
				});
			}
		},
		{
			id: "cobertura-por-veiculo",
			titulo: "Cobertura da árvore por veículo",
			pergunta: "Quanto da árvore SAP de cada veículo está de fato rastreado.",
			acao: "É o número da visão geral aberto por veículo — onde ele deixa de ser média e vira responsabilidade de alguém.",
			colunas: [
				{ chave: "veiculo", rotulo: "Veículo", largura: "12em", tipo: "acao", acao: "veiculo" },
				{ chave: "local", rotulo: "Local de instalação", largura: "16em" },
				{ chave: "prefixo", rotulo: "Prefixo", largura: "7em" },
				{ chave: "naArvore", rotulo: "Na árvore SAP", largura: "9em" },
				{ chave: "comRastreador", rotulo: "Com rastreador", largura: "9em" },
				{ chave: "cobertura", rotulo: "Cobertura (%)", largura: "9em" },
				{ chave: "situacao", rotulo: "Situação", largura: "11em" }
			],
			linhas: function (ctx) {
				return (ctx.conferencia.veiculos || []).map(function (v) {
					return {
						veiculo: v.nome,
						local: texto(v.local),
						prefixo: texto(prefixo.de(v.local)),
						naArvore: v.naArvore,
						comRastreador: v.comRastreador,
						cobertura: v.cobertura === null ? "" : Math.round(v.cobertura * 100),
						situacao: v.naArvore === 0 ? "Sem árvore" : (v.conforme ? "Conforme" : "Divergente")
					};
				});
			}
		},
		{
			id: "nota-sem-rastreador",
			titulo: "Nota aberta sem rastreador",
			pergunta: "Equipamento com nota YA em aberto e sem tag associada.",
			acao: "Entra em manutenção e ninguém consegue acompanhar por onde ele anda.",
			colunas: [
				{ chave: "equipamento", rotulo: "Equipamento", largura: "12em", tipo: "equipamento" },
				{ chave: "nota", rotulo: "Nota", largura: "10em" },
				{ chave: "texto", rotulo: "Texto breve", largura: "26em" },
				{ chave: "oficina", rotulo: "Oficina", largura: "16em" },
				{ chave: "status", rotulo: "Status sistema", largura: "10em" },
				{ chave: "prioridade", rotulo: "Prioridade", largura: "9em" }
			],
			linhas: function (ctx) {
				var comTag = ctx.codigosComRastreador || {};
				return (ctx.notas || []).filter(function (n) {
					return !comTag[prefixo.chave(n.equipamento)];
				}).map(function (n) {
					return {
						equipamento: texto(n.equipamento).replace(/^0+/, ""),
						nota: texto(n.nota),
						texto: texto(n.txt_breve_nota),
						oficina: texto(n.oficina),
						status: texto(n.status_sistema),
						prioridade: texto(n.prioridade)
					};
				});
			}
		},
		{
			id: "gateways",
			titulo: "Gateways fora de operação",
			pergunta: "Infraestrutura de leitura cadastrada que não está ativa.",
			acao: "Cada gateway parado cria um ponto cego: os componentes daquela área somem do indicador sem terem saído do lugar.",
			colunas: [
				{ chave: "identificador", rotulo: "Identificador", largura: "18em", tipo: "gateway" },
				{ chave: "gatewayId", rotulo: "ID", largura: "14em" },
				{ chave: "localidade", rotulo: "Localidade", largura: "18em" },
				{ chave: "condicao", rotulo: "Condição", largura: "12em" },
				{ chave: "posicao", rotulo: "Posição", largura: "18em" }
			],
			linhas: function (ctx) {
				return (ctx.gateways || []).filter(function (g) { return !g.ativo; }).map(function (g) {
					return {
						identificador: texto(g.identificador),
						gatewayId: texto(g.id),
						localidade: texto(g.localidade),
						condicao: texto(g.condicao) || "sem condição cadastrada",
						posicao: g.posicao ? g.posicao.lat.toFixed(5) + ", " + g.posicao.lng.toFixed(5) : ""
					};
				});
			}
		}
	];

	return {
		RELATORIOS: RELATORIOS,

		obter: function (id) {
			for (var i = 0; i < RELATORIOS.length; i++) {
				if (RELATORIOS[i].id === id) { return RELATORIOS[i]; }
			}
			return null;
		},

		montar: function (id, ctx) {
			var rel = this.obter(id);
			if (!rel) { return null; }
			var contexto = Object.assign({ conferencia: { veiculos: [] }, agora: Date.now() }, ctx || {});
			return { relatorio: rel, linhas: rel.linhas(contexto) };
		},

		/** Colunas no formato do sap.ui.export.Spreadsheet. */
		colunasParaExportacao: function (rel) {
			return rel.colunas.map(function (c) {
				return { label: c.rotulo, property: c.chave, width: parseInt(c.largura, 10) || 12 };
			});
		}
	};
});
