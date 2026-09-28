/**
 * Estado de tela do editor e do assistente de relatorios personalizados.
 *
 * O editor precisa de listas auxiliares que a definicao gravada nao tem:
 * os campos da fonte de cada parcela, os operadores que cabem no tipo do
 * campo escolhido, as transformacoes possiveis de um agrupamento... Elas
 * ficam em propriedades com "_" e sao descartadas por `paraDefinicao`
 * (motor.normalizar so copia o que e do esquema).
 *
 * `doAssistente` traduz as respostas do passo a passo numa definicao comum
 * — o assistente e so outra forma de preencher o mesmo relatorio, que
 * depois pode ser aberto no editor completo.
 *
 * Modulo puro: roda no Node (test/regras).
 */
sap.ui.define([
	"./campos",
	"./relatorioPersonalizado"
], function (campos, motor) {
	"use strict";

	var VAZIO = { id: "", rotulo: "(escolha)" };

	function clonar(o) {
		return JSON.parse(JSON.stringify(o === undefined ? null : o));
	}

	function listaCampos(fonteId, filtroTipos) {
		var f = campos.fonte(fonteId);
		if (!f) { return [VAZIO]; }
		return [VAZIO].concat(f.campos.filter(function (c) {
			return !filtroTipos || filtroTipos.indexOf(c.tipo) >= 0;
		}).map(function (c) {
			return { id: c.id, rotulo: c.rotulo, tipo: c.tipo };
		}));
	}

	/* ---------- filtro ---------- */

	function prepararFiltro(f, fonteId) {
		f._campos = listaCampos(fonteId);
		var c = campos.campo(fonteId, f.campo);
		f._operadores = c ? campos.operadoresPara(c.tipo) : [];
		if (c && !f._operadores.some(function (o) { return o.id === f.operador; })) {
			f.operador = f._operadores.length ? f._operadores[0].id : "";
		}
		if (!c) { f.operador = ""; }
		var op = campos.OPERADORES[f.operador];
		f._nValores = op ? op.valores : 0;
		f._dica = c && c.tipo === "data" ? (f.operador === "ultimosDias" ? "dias" : "dd/mm/aaaa")
			: (c && c.tipo === "percentual" ? "ex.: 90 (%)" : (f.operador === "em" ? "A, B, C" : "valor"));
		if (f.valor === undefined) { f.valor = ""; }
		if (f.valor2 === undefined) { f.valor2 = ""; }
		return f;
	}

	/* ---------- agrupamento ---------- */

	function prepararDimensao(d, fontesIds) {
		var ids = [].concat(fontesIds);
		d._campos = ids.length > 1
			? [VAZIO].concat(campos.camposComuns(ids).map(function (c) { return { id: c.id, rotulo: c.rotulo, tipo: c.tipo }; }))
			: listaCampos(ids[0]);
		d.transformacao = d.transformacao || { tipo: "valor" };
		var c = campos.campo(ids[0], d.campo);
		d._transformacoes = c ? campos.transformacoesPara(c.tipo) : [{ id: "valor", rotulo: "Valor inteiro" }];
		if (!d._transformacoes.some(function (t) { return t.id === d.transformacao.tipo; })) {
			d.transformacao.tipo = d._transformacoes[0].id;
		}
		var t = campos.TRANSFORMACOES[d.transformacao.tipo];
		d._temParametro = !!(t && t.parametro);
		d._rotuloParametro = t && t.parametro ? t.parametro : "";
		if (d._temParametro && !(Number(d.transformacao.n) > 0)) {
			d.transformacao.n = d.transformacao.tipo === "faixa" ? 7 : 4;
		}
		return d;
	}

	/* ---------- agregacao ---------- */

	function prepararAgregacao(o, fonteId) {
		var ag = campos.AGREGACOES[o.agregacao] || campos.AGREGACOES.contagem;
		if (!campos.AGREGACOES[o.agregacao]) { o.agregacao = "contagem"; }
		o._agregacoes = Object.keys(campos.AGREGACOES).map(function (k) {
			return { id: k, rotulo: campos.AGREGACOES[k].rotulo };
		});
		o._precisaCampo = !!ag.campo;
		o._camposAgregacao = ag.campo ? listaCampos(fonteId, ag.tipos) : [VAZIO];
		if (!ag.campo) {
			o.campo = "";
		} else if (!o._camposAgregacao.some(function (c) { return c.id === o.campo; })) {
			o.campo = "";
		}
		return o;
	}

	var api = {

		VAZIO: VAZIO,

		FORMATOS: [
			{ id: "percentual", rotulo: "Porcentagem (P1 / P2 = 50%)" },
			{ id: "numero", rotulo: "Número" },
			{ id: "decimal", rotulo: "Decimal" }
		],

		GRAFICOS: [
			{ id: "nenhum", rotulo: "Sem gráfico" },
			{ id: "barras", rotulo: "Barras horizontais" },
			{ id: "colunas", rotulo: "Colunas" },
			{ id: "pizza", rotulo: "Pizza" },
			{ id: "linha", rotulo: "Linha" }
		],

		novoFiltro: function (fonteId) {
			return prepararFiltro({ campo: "", operador: "", valor: "", valor2: "" }, fonteId);
		},

		novaDimensao: function (fonteId) {
			return prepararDimensao({ campo: "", transformacao: { tipo: "valor" } }, [fonteId]);
		},

		novoValor: function (fonteId) {
			return prepararAgregacao({ agregacao: "contagem", campo: "", rotulo: "", percentualDoTotal: false }, fonteId);
		},

		novaParcela: function (n, fonteId) {
			var p = { rotulo: "Parcela " + n, fonte: fonteId || "rastreadores", agregacao: "contagem", campo: "", filtros: [] };
			return api.prepararParcela(p, n);
		},

		prepararParcela: function (p, n) {
			p.id = "P" + n;
			if (!campos.fonte(p.fonte)) { p.fonte = "rastreadores"; }
			prepararAgregacao(p, p.fonte);
			p.filtros = (p.filtros || []).map(function (f) { return prepararFiltro(f, p.fonte); });
			return p;
		},

		/** Definicao → estado do editor. */
		paraEditor: function (def) {
			var d = motor.normalizar(clonar(def) || {});
			var e = {
				id: d.id,
				nome: d.nome,
				descricao: d.descricao,
				tipo: d.tipo,
				grafico: { tipo: d.grafico.tipo },

				parcelas: d.parcelas || [
					{ rotulo: "Numerador", fonte: "rastreadores", agregacao: "contagem", filtros: [] },
					{ rotulo: "Denominador", fonte: "rastreadores", agregacao: "contagem", filtros: [] }
				],
				formula: d.formula || "P1 / P2",
				formato: d.formato || "percentual",
				casas: d.casas === undefined ? 1 : d.casas,
				usarAgrupamento: !!d.agrupamento,
				agrupamento: d.agrupamento || { campo: "", transformacao: { tipo: "valor" } },
				usarMetas: !!d.metas,
				metas: d.metas ? {
					sentido: d.metas.sentido,
					verde: d.metas.verde === null ? "" : String(d.metas.verde),
					amarelo: d.metas.amarelo === null || d.metas.amarelo === undefined ? "" : String(d.metas.amarelo)
				} : { sentido: "maior", verde: "", amarelo: "" },

				fonte: d.fonte || "rastreadores",
				filtros: d.filtros || [],
				linhas: d.linhas && d.linhas.length ? d.linhas : [{ campo: "", transformacao: { tipo: "valor" } }],
				usarColunas: !!d.colunas,
				colunas: d.colunas || { campo: "", transformacao: { tipo: "valor" } },
				valores: d.valores || [{ agregacao: "contagem", campo: "", rotulo: "", percentualDoTotal: true }],
				ordenacao: d.tipo === "tabela" && d.ordenacao ? d.ordenacao : { por: "valor", sentido: "desc" },
				limite: d.limite || 0,
				mostrarTotal: d.mostrarTotal !== false,

				campos: d.campos || (campos.fonte(d.fonte || "rastreadores") || { colunasPadrao: [] }).colunasPadrao.slice(),
				ordenacaoLista: d.tipo === "lista" && d.ordenacao ? d.ordenacao : { campo: "", sentido: "asc" }
			};
			return api.atualizar(e);
		},

		/**
		 * Recalcula as listas auxiliares depois de qualquer mudanca de
		 * estrutura (fonte, campo, agregacao, tipo...). Idempotente.
		 */
		atualizar: function (e) {
			e.parcelas = (e.parcelas || []).map(function (p, i) { return api.prepararParcela(p, i + 1); });

			var fontesParcelas = e.parcelas.map(function (p) { return p.fonte; })
				.filter(function (x, i, a) { return a.indexOf(x) === i; });
			if (!fontesParcelas.length) { fontesParcelas = ["rastreadores"]; }
			prepararDimensao(e.agrupamento, fontesParcelas);
			e._variaveis = e.parcelas.map(function (p) { return p.id; }).join(", ");

			if (!campos.fonte(e.fonte)) { e.fonte = "rastreadores"; }
			e.filtros = (e.filtros || []).map(function (f) { return prepararFiltro(f, e.fonte); });
			e.linhas = (e.linhas || []).slice(0, 2).map(function (dm) { return prepararDimensao(dm, [e.fonte]); });
			prepararDimensao(e.colunas, [e.fonte]);
			e.valores = (e.valores || []).map(function (v) { return prepararAgregacao(v, e.fonte); });
			e._podeMaisLinhas = e.linhas.length < 2;

			var todos = listaCampos(e.fonte).slice(1);
			e._camposFonte = todos;
			e.campos = (e.campos || []).filter(function (id) { return todos.some(function (c) { return c.id === id; }); });
			e._camposOrdenacao = [{ id: "", rotulo: "(sem ordenação)" }].concat(todos);
			if (!e._camposOrdenacao.some(function (c) { return c.id === e.ordenacaoLista.campo; })) { e.ordenacaoLista.campo = ""; }

			e._metrica = e.tipo === "metrica";
			e._tabela = e.tipo === "tabela";
			e._lista = e.tipo === "lista";
			e._unidadeMeta = e.formato === "percentual" ? "%" : "";
			return e;
		},

		/** Estado do editor → definicao (so o esquema). */
		paraDefinicao: function (e) {
			var def = {
				id: e.id,
				nome: e.nome,
				descricao: e.descricao,
				tipo: e.tipo,
				grafico: { tipo: e.grafico && e.grafico.tipo }
			};
			if (e.tipo === "metrica") {
				def.parcelas = e.parcelas;
				def.formula = e.formula;
				def.formato = e.formato;
				def.casas = e.casas;
				def.agrupamento = e.usarAgrupamento ? e.agrupamento : null;
				def.metas = e.usarMetas ? e.metas : null;
			}
			if (e.tipo === "tabela") {
				def.fonte = e.fonte;
				def.filtros = e.filtros;
				def.linhas = e.linhas.filter(function (l) { return l.campo; });
				def.colunas = e.usarColunas ? e.colunas : null;
				def.valores = e.valores;
				def.ordenacao = e.ordenacao;
				def.limite = Number(e.limite) > 0 ? Number(e.limite) : null;
				def.mostrarTotal = e.mostrarTotal;
			}
			if (e.tipo === "lista") {
				def.fonte = e.fonte;
				def.filtros = e.filtros;
				def.campos = e.campos;
				def.ordenacao = e.ordenacaoLista && e.ordenacaoLista.campo ? e.ordenacaoLista : null;
				def.limite = Number(e.limite) > 0 ? Number(e.limite) : null;
			}
			var saida = motor.normalizar(clonar(def));
			if (e.id === undefined || e.id === null) { delete saida.id; }
			return saida;
		},

		/* ================================================================
		 * Assistente
		 * ================================================================ */

		/** Respostas iniciais do passo a passo. */
		novoAssistente: function () {
			return api.atualizarAssistente({
				tipo: "metrica",
				modoMetrica: "proporcao",
				fonte: "rastreadores",
				condicoes: [],
				filtros: [],
				calculo: { agregacao: "contagem", campo: "" },
				agrupar: { campo: "", transformacao: { tipo: "valor" } },
				percentualDoTotal: true,
				cruzar: false,
				colunas: { campo: "", transformacao: { tipo: "valor" } },
				campos: [],
				ordenarPor: "",
				sentido: "desc",
				abrirPorGrupo: false,
				grupoMetrica: { campo: "", transformacao: { tipo: "valor" } },
				usarMeta: false,
				meta: { sentido: "maior", verde: "", amarelo: "" },
				grafico: "barras",
				rotuloNumerador: "",
				rotuloDenominador: "",
				nome: "",
				descricao: ""
			});
		},

		atualizarAssistente: function (w) {
			if (!campos.fonte(w.fonte)) { w.fonte = "rastreadores"; }
			w._fonteDescricao = campos.fonte(w.fonte).descricao;
			w.condicoes = w.condicoes.map(function (f) { return prepararFiltro(f, w.fonte); });
			w.filtros = w.filtros.map(function (f) { return prepararFiltro(f, w.fonte); });
			prepararAgregacao(w.calculo, w.fonte);
			prepararDimensao(w.agrupar, [w.fonte]);
			prepararDimensao(w.colunas, [w.fonte]);
			prepararDimensao(w.grupoMetrica, [w.fonte]);
			var todos = listaCampos(w.fonte).slice(1);
			w._camposFonte = todos;
			w.campos = (w.campos || []).filter(function (id) { return todos.some(function (c) { return c.id === id; }); });
			if (!w.campos.length) { w.campos = campos.fonte(w.fonte).colunasPadrao.slice(); }
			w._camposOrdenacao = [{ id: "", rotulo: "(sem ordenação)" }].concat(todos);
			w._metrica = w.tipo === "metrica";
			w._tabela = w.tipo === "tabela";
			w._lista = w.tipo === "lista";
			w._proporcao = w._metrica && w.modoMetrica === "proporcao";
			w._valor = w._metrica && w.modoMetrica === "valor";
			w._unidadeMeta = w._proporcao ? "%" : "";
			return w;
		},

		/** Sugestao de nome a partir das respostas (o usuario pode trocar). */
		sugerirNome: function (w) {
			var fonte = campos.fonte(w.fonte).rotulo;
			if (w.tipo === "metrica" && w.modoMetrica === "proporcao") {
				var cond = w.condicoes.filter(function (f) { return f.campo; }).map(function (f) {
					var c = campos.campo(w.fonte, f.campo);
					var op = campos.OPERADORES[f.operador];
					return (c ? c.rotulo : f.campo) + (op && op.valores === 0 ? (f.operador === "falso" ? " (não)" : "") : " " + (op ? op.rotulo : "") + " " + f.valor);
				}).join(" e ");
				return "% de " + fonte.toLowerCase() + (cond ? " com " + cond.toLowerCase() : "");
			}
			if (w.tipo === "metrica") {
				var ag = campos.AGREGACOES[w.calculo.agregacao];
				var cc = campos.campo(w.fonte, w.calculo.campo);
				return (ag ? ag.rotulo : "Total") + (cc ? " de " + cc.rotulo.toLowerCase() : "") + " — " + fonte;
			}
			if (w.tipo === "tabela") {
				var g = campos.campo(w.fonte, w.agrupar.campo);
				var t = w.agrupar.transformacao || {};
				var detalhe = t.tipo === "primeiros" ? " (" + t.n + " primeiros caracteres)"
					: (t.tipo === "mes" ? " (mês)" : (t.tipo === "ano" ? " (ano)" : (t.tipo === "faixa" ? " (faixas de " + t.n + ")" : "")));
				return fonte + " por " + (g ? g.rotulo.toLowerCase() : "grupo") + detalhe;
			}
			return "Lista de " + fonte.toLowerCase();
		},

		/** Respostas do assistente → definicao completa. */
		doAssistente: function (w) {
			var base = w.filtros.filter(function (f) { return f.campo; });
			var def = { nome: w.nome || api.sugerirNome(w), descricao: w.descricao, tipo: w.tipo, grafico: { tipo: w.grafico || "nenhum" } };

			if (w.tipo === "metrica") {
				if (w.modoMetrica === "proporcao") {
					var cond = w.condicoes.filter(function (f) { return f.campo; });
					def.parcelas = [
						{ rotulo: w.rotuloNumerador || "Atendem à condição", fonte: w.fonte, agregacao: "contagem", filtros: base.concat(cond) },
						{ rotulo: w.rotuloDenominador || "Total", fonte: w.fonte, agregacao: "contagem", filtros: base }
					];
					def.formula = "P1 / P2";
					def.formato = "percentual";
					def.casas = 1;
				} else {
					def.parcelas = [{
						rotulo: w.rotuloNumerador || (campos.AGREGACOES[w.calculo.agregacao] || {}).rotulo || "Valor",
						fonte: w.fonte, agregacao: w.calculo.agregacao, campo: w.calculo.campo, filtros: base
					}];
					def.formula = "P1";
					def.formato = w.calculo.agregacao === "media" ? "decimal" : "numero";
					def.casas = w.calculo.agregacao === "media" ? 1 : 0;
				}
				def.agrupamento = w.abrirPorGrupo && w.grupoMetrica.campo ? w.grupoMetrica : null;
				def.metas = w.usarMeta && w.meta.verde !== "" ? w.meta : null;
				if (!def.agrupamento && def.grafico.tipo !== "nenhum" && def.parcelas.length < 2) { def.grafico.tipo = "nenhum"; }
			}

			if (w.tipo === "tabela") {
				def.fonte = w.fonte;
				def.filtros = base;
				def.linhas = [w.agrupar];
				def.colunas = w.cruzar && w.colunas.campo ? w.colunas : null;
				def.valores = [{ agregacao: w.calculo.agregacao, campo: w.calculo.campo, percentualDoTotal: !!w.percentualDoTotal && w.calculo.agregacao !== "media" }];
				def.ordenacao = { por: "valor", sentido: "desc" };
				def.mostrarTotal = true;
			}

			if (w.tipo === "lista") {
				def.fonte = w.fonte;
				def.filtros = base;
				def.campos = w.campos;
				def.ordenacao = w.ordenarPor ? { campo: w.ordenarPor, sentido: w.sentido } : null;
				def.grafico = { tipo: "nenhum" };
			}
			var saida = motor.normalizar(clonar(def));
			delete saida.id;
			return saida;
		},

		/** Passo do assistente pronto para seguir? Devolve a mensagem do que falta, ou "". */
		faltaNoPasso: function (w, passo) {
			if (passo === "dados" && !campos.fonte(w.fonte)) { return "Escolha a fonte dos dados."; }
			if (passo === "calculo") {
				if (w.tipo === "metrica" && w.modoMetrica === "proporcao" && !w.condicoes.some(function (f) { return f.campo; })) {
					return "Diga qual condição conta no numerador.";
				}
				if ((w.tipo === "tabela" || (w.tipo === "metrica" && w.modoMetrica === "valor")) &&
					w.calculo._precisaCampo && !w.calculo.campo) {
					return "Escolha o campo do cálculo.";
				}
				if (w.tipo === "tabela" && !w.agrupar.campo) { return "Escolha por qual campo agrupar."; }
				if (w.tipo === "lista" && !w.campos.length) { return "Escolha as colunas."; }
			}
			return "";
		}
	};

	return api;
});
