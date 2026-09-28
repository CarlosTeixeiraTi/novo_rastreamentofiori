/**
 * Motor dos relatorios personalizados.
 *
 * O usuario declara o relatorio (um objeto JSON, gravado no backend) e este
 * modulo calcula o resultado a partir do snapshot da frota. Tres tipos:
 *
 *   metrica  parcelas P1..Pn (fonte + filtros + agregacao) combinadas por
 *            uma formula ("P1 / P2"), com formato, metas e, opcionalmente,
 *            aberta por um agrupamento (uma linha por prefixo, por exemplo)
 *   tabela   tabela dinamica: 1 ou 2 niveis de linhas, coluna cruzada
 *            opcional, um ou mais valores, % do total, total, top N
 *   lista    extracao filtrada com as colunas escolhidas
 *
 * A formula e interpretada aqui, sem eval: so numeros, P1..Pn, + - * / ( )
 * e as funcoes min, max, abs. Divisao por zero devolve null ("nao medido"),
 * nunca 0% — mesma regra dos indicadores.
 *
 * Todo resultado sai no mesmo formato de tabela ({ colunas, linhas }), que a
 * tela mostra, o grafico desenha e o Excel exporta. Cada linha carrega
 * `_alvo`, que `itens()` usa para devolver os registros por tras do numero
 * (drill-down).
 *
 * Modulo puro: roda no Node (test/regras).
 */
sap.ui.define([
	"./campos"
], function (campos) {
	"use strict";

	var VERSAO = 1;
	var TIPOS = ["metrica", "tabela", "lista"];
	var DIA_MS = 86400000;

	/* ================================================================
	 * Utilitarios
	 * ================================================================ */

	function vazio(v) {
		return v === null || v === undefined || v === "";
	}

	function clonar(o) {
		return JSON.parse(JSON.stringify(o === undefined ? null : o));
	}

	/** Data de "2026-09-02", "2026-09-19T14:32:00" ou "19/09/2026[, 14:32]". */
	function paraData(v) {
		if (vazio(v)) { return null; }
		if (v instanceof Date) { return isNaN(v) ? null : v.getTime(); }
		if (typeof v === "number") { return v; }
		var s = String(v).trim();
		var br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
		if (br) {
			return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]),
				Number(br[4] || 0), Number(br[5] || 0), Number(br[6] || 0)).getTime();
		}
		var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
		if (iso) {
			return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]),
				Number(iso[4] || 0), Number(iso[5] || 0), Number(iso[6] || 0)).getTime();
		}
		return null;
	}

	function doisDigitos(n) {
		return (n < 10 ? "0" : "") + n;
	}

	/** Numero digitado pelo usuario: aceita "12,5" e "12.5". */
	function paraNumero(v) {
		if (vazio(v)) { return null; }
		if (typeof v === "number") { return isFinite(v) ? v : null; }
		var n = Number(String(v).trim().replace(/\s/g, "").replace(",", "."));
		return isFinite(n) ? n : null;
	}

	function normalizarTexto(v) {
		return String(vazio(v) ? "" : v)
			.normalize("NFD").replace(/[̀-ͯ]/g, "")
			.trim().toUpperCase();
	}

	function formatarNumero(v, casas) {
		if (v === null || v === undefined || !isFinite(v)) { return "—"; }
		var c = casas === undefined || casas === null ? (Number.isInteger(v) ? 0 : 2) : casas;
		return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }).format(v);
	}

	function formatarValor(v, formato, casas) {
		if (v === null || v === undefined || !isFinite(v)) { return "não medido"; }
		if (formato === "percentual") {
			return formatarNumero(v * 100, casas === undefined || casas === null ? 1 : casas) + "%";
		}
		if (formato === "decimal") { return formatarNumero(v, casas === undefined || casas === null ? 2 : casas); }
		return formatarNumero(v, casas === undefined || casas === null ? (Number.isInteger(v) ? 0 : 2) : casas);
	}

	/* ================================================================
	 * Filtros
	 * ================================================================ */

	function comparavel(tipo, v) {
		if (tipo === "data") { return paraData(v); }
		if (tipo === "numero" || tipo === "percentual") { return paraNumero(v); }
		if (tipo === "booleano") { return v === true || v === "true"; }
		return normalizarTexto(v);
	}

	/**
	 * Valor digitado num filtro de percentual: o usuario pensa em "90" (%),
	 * o campo guarda 0.9. Acima de 1 e tratado como porcentagem.
	 */
	function valorDoFiltro(tipo, v) {
		if (tipo === "percentual") {
			var n = paraNumero(v);
			return n === null ? null : (Math.abs(n) > 1 ? n / 100 : n);
		}
		return comparavel(tipo, v);
	}

	function passaFiltro(linha, filtro, tipo, agora) {
		var bruto = linha[filtro.campo];
		var op = filtro.operador;

		if (op === "vazio") { return vazio(bruto); }
		if (op === "naoVazio") { return !vazio(bruto); }
		if (op === "verdadeiro") { return bruto === true; }
		if (op === "falso") { return bruto !== true; }

		var v = comparavel(tipo, bruto);

		if (op === "em") {
			var lista = String(filtro.valor || "").split(/[;,]/).map(function (x) { return comparavel(tipo, x); })
				.filter(function (x) { return x !== null && x !== ""; });
			return lista.indexOf(v) >= 0;
		}
		if (op === "ultimosDias") {
			var dias = paraNumero(filtro.valor);
			if (v === null || dias === null) { return false; }
			return v >= agora - dias * DIA_MS && v <= agora;
		}

		var alvo = valorDoFiltro(tipo, filtro.valor);

		if (op === "contem") { return String(v).indexOf(alvo) >= 0; }
		if (op === "naoContem") { return String(v).indexOf(alvo) < 0; }
		if (op === "comecaCom") { return String(v).indexOf(alvo) === 0; }
		if (op === "igual") { return v === alvo; }
		if (op === "diferente") { return v !== alvo; }

		if (v === null || alvo === null) { return false; }
		if (op === "maior") { return v > alvo; }
		if (op === "maiorIgual") { return v >= alvo; }
		if (op === "menor") { return v < alvo; }
		if (op === "menorIgual") { return v <= alvo; }
		if (op === "entre") {
			var ate = valorDoFiltro(tipo, filtro.valor2);
			if (ate === null) { return false; }
			var fim = tipo === "data" ? ate + DIA_MS - 1 : ate;
			return v >= Math.min(alvo, fim) && v <= Math.max(alvo, fim);
		}
		return true;
	}

	/** Filtros combinados com E. Filtro incompleto e ignorado (a validacao avisa). */
	function filtrar(linhas, filtros, fonteId, agora) {
		var validos = (filtros || []).filter(function (f) {
			return f && f.campo && f.operador && campos.campo(fonteId, f.campo);
		});
		if (!validos.length) { return linhas; }
		return linhas.filter(function (l) {
			return validos.every(function (f) {
				return passaFiltro(l, f, campos.campo(fonteId, f.campo).tipo, agora);
			});
		});
	}

	/* ================================================================
	 * Agregacao
	 * ================================================================ */

	function agregar(linhas, agregacao, campoId, tipo) {
		var ag = agregacao || "contagem";
		if (ag === "contagem") { return linhas.length; }

		var valores = linhas.map(function (l) { return l[campoId]; });

		if (ag === "contagemDistinta") {
			var vistos = {};
			valores.forEach(function (v) { if (!vazio(v)) { vistos[String(v)] = true; } });
			return Object.keys(vistos).length;
		}
		if (ag === "verdadeiros") {
			return valores.filter(function (v) { return v === true; }).length;
		}

		var nums = valores.map(function (v) {
			return tipo === "data" ? paraData(v) : paraNumero(v);
		}).filter(function (v) { return v !== null; });

		if (ag === "soma") { return nums.reduce(function (s, v) { return s + v; }, 0); }
		if (!nums.length) { return null; }
		if (ag === "media") { return nums.reduce(function (s, v) { return s + v; }, 0) / nums.length; }
		if (ag === "minimo") { return Math.min.apply(null, nums); }
		if (ag === "maximo") { return Math.max.apply(null, nums); }
		return null;
	}

	/* ================================================================
	 * Agrupamento
	 * ================================================================ */

	/** Chave de grupo: { chave (texto exibido), ordem (para ordenar) }. */
	function chaveDeGrupo(valor, tipo, transf) {
		var t = (transf && transf.tipo) || "valor";
		var n = paraNumero(transf && transf.n);

		if (vazio(valor)) { return { chave: "(vazio)", ordem: "￿" }; }

		if (tipo === "booleano") {
			return { chave: valor === true ? "Sim" : "Não", ordem: valor === true ? 0 : 1 };
		}
		if (t === "primeiros" && n) {
			var p = String(valor).slice(0, n);
			return { chave: p, ordem: p };
		}
		if (t === "ultimos" && n) {
			var u = String(valor).slice(-n);
			return { chave: u, ordem: u };
		}
		if (t === "faixa" && n) {
			var num = paraNumero(valor);
			if (num === null) { return { chave: "(vazio)", ordem: Infinity }; }
			var ini = Math.floor(num / n) * n;
			return { chave: formatarNumero(ini, 0) + " – " + formatarNumero(ini + n - (Number.isInteger(n) ? 1 : 0), 0), ordem: ini };
		}
		if (tipo === "data") {
			var ts = paraData(valor);
			if (ts === null) { return { chave: "(vazio)", ordem: Infinity }; }
			var d = new Date(ts);
			if (t === "ano") { return { chave: String(d.getFullYear()), ordem: d.getFullYear() }; }
			if (t === "mes") {
				return { chave: doisDigitos(d.getMonth() + 1) + "/" + d.getFullYear(), ordem: d.getFullYear() * 100 + d.getMonth() };
			}
			var dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
			return {
				chave: doisDigitos(dia.getDate()) + "/" + doisDigitos(dia.getMonth() + 1) + "/" + dia.getFullYear(),
				ordem: dia.getTime()
			};
		}
		if (tipo === "percentual") {
			var pc = paraNumero(valor);
			return { chave: formatarValor(pc, "percentual", 0), ordem: pc };
		}
		if (tipo === "numero") {
			var nn = paraNumero(valor);
			return { chave: formatarNumero(nn), ordem: nn };
		}
		return { chave: String(valor), ordem: normalizarTexto(valor) };
	}

	function compararOrdem(a, b) {
		if (typeof a === "number" && typeof b === "number") { return a - b; }
		return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
	}

	/** Agrupa linhas por uma lista de dimensoes. Devolve [{ chaves, ordens, linhas }]. */
	function agrupar(linhas, dimensoes, fonteId) {
		var grupos = {};
		var lista = [];
		linhas.forEach(function (l) {
			var chaves = [];
			var ordens = [];
			dimensoes.forEach(function (dim) {
				var c = campos.campo(fonteId, dim.campo);
				var k = chaveDeGrupo(l[dim.campo], c ? c.tipo : "texto", dim.transformacao);
				chaves.push(k.chave);
				ordens.push(k.ordem);
			});
			var id = JSON.stringify(chaves);
			if (!grupos[id]) {
				grupos[id] = { chaves: chaves, ordens: ordens, linhas: [] };
				lista.push(grupos[id]);
			}
			grupos[id].linhas.push(l);
		});
		return lista;
	}

	function rotuloDimensao(fonteId, dim) {
		var c = campos.campo(fonteId, dim.campo);
		var rot = c ? c.rotulo : dim.campo;
		var t = dim.transformacao || {};
		if (t.tipo === "primeiros") { return rot + " (" + t.n + " primeiros)"; }
		if (t.tipo === "ultimos") { return rot + " (" + t.n + " últimos)"; }
		if (t.tipo === "faixa") { return rot + " (faixas de " + t.n + ")"; }
		if (t.tipo === "mes") { return rot + " (mês)"; }
		if (t.tipo === "ano") { return rot + " (ano)"; }
		if (t.tipo === "dia") { return rot + " (dia)"; }
		return rot;
	}

	/* ================================================================
	 * Formula
	 * ================================================================ */

	var FUNCOES = {
		min: function (a) { return Math.min.apply(null, a); },
		max: function (a) { return Math.max.apply(null, a); },
		abs: function (a) { return Math.abs(a[0]); }
	};

	function tokenizar(texto) {
		var tokens = [];
		var s = String(texto || "");
		var i = 0;
		while (i < s.length) {
			var c = s[i];
			if (/\s/.test(c)) { i++; continue; }
			var num = s.slice(i).match(/^\d+(?:\.\d+)?/);
			if (num) { tokens.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
			var id = s.slice(i).match(/^[A-Za-z_]\w*/);
			if (id) {
				var nome = id[0];
				if (/^[Pp]\d+$/.test(nome)) {
					tokens.push({ t: "var", v: nome.toUpperCase() });
				} else if (FUNCOES[nome.toLowerCase()]) {
					tokens.push({ t: "fn", v: nome.toLowerCase() });
				} else {
					throw new Error("Termo desconhecido na fórmula: \"" + nome + "\". Use P1, P2… e as funções min, max, abs.");
				}
				i += nome.length;
				continue;
			}
			if ("+-*/(),".indexOf(c) >= 0) { tokens.push({ t: c }); i++; continue; }
			throw new Error("Caractere inválido na fórmula: \"" + c + "\". Use ponto para decimais (0.4).");
		}
		return tokens;
	}

	/**
	 * Descida recursiva. Gera uma arvore; `avaliar` percorre a arvore com os
	 * valores das parcelas. null se propaga: qualquer parcela nao medida ou
	 * divisao por zero torna o resultado "nao medido".
	 */
	function compilar(texto) {
		var tokens = tokenizar(texto);
		var pos = 0;
		var variaveis = {};

		function ver() { return tokens[pos]; }
		function pegar(tipo) {
			var tk = tokens[pos];
			if (!tk || tk.t !== tipo) {
				throw new Error(tk ? "Fórmula inválida perto de \"" + (tk.v !== undefined ? tk.v : tk.t) + "\"." : "Fórmula incompleta.");
			}
			pos++;
			return tk;
		}

		function expressao() {
			var no = termo();
			while (ver() && (ver().t === "+" || ver().t === "-")) {
				var op = tokens[pos++].t;
				no = { op: op, a: no, b: termo() };
			}
			return no;
		}
		function termo() {
			var no = fator();
			while (ver() && (ver().t === "*" || ver().t === "/")) {
				var op = tokens[pos++].t;
				no = { op: op, a: no, b: fator() };
			}
			return no;
		}
		function fator() {
			var tk = ver();
			if (!tk) { throw new Error("Fórmula incompleta."); }
			if (tk.t === "-") { pos++; return { op: "neg", a: fator() }; }
			if (tk.t === "+") { pos++; return fator(); }
			if (tk.t === "num") { pos++; return { num: tk.v }; }
			if (tk.t === "var") { pos++; variaveis[tk.v] = true; return { variavel: tk.v }; }
			if (tk.t === "fn") {
				pos++;
				pegar("(");
				var args = [expressao()];
				while (ver() && ver().t === ",") { pos++; args.push(expressao()); }
				pegar(")");
				return { fn: tk.v, args: args };
			}
			if (tk.t === "(") {
				pos++;
				var dentro = expressao();
				pegar(")");
				return dentro;
			}
			throw new Error("Fórmula inválida perto de \"" + tk.t + "\".");
		}

		if (!tokens.length) { throw new Error("Informe a fórmula (ex.: P1 / P2)."); }
		var arvoreFormula = expressao();
		if (pos < tokens.length) {
			var sobra = tokens[pos];
			throw new Error("Fórmula inválida perto de \"" + (sobra.v !== undefined ? sobra.v : sobra.t) + "\".");
		}

		function avaliar(no, valores) {
			if (no.num !== undefined) { return no.num; }
			if (no.variavel) {
				var v = valores[no.variavel];
				return v === undefined || v === null || !isFinite(v) ? null : v;
			}
			if (no.fn) {
				var args = no.args.map(function (x) { return avaliar(x, valores); });
				if (args.some(function (x) { return x === null; })) { return null; }
				return FUNCOES[no.fn](args);
			}
			var a = avaliar(no.a, valores);
			if (a === null) { return null; }
			if (no.op === "neg") { return -a; }
			var b = avaliar(no.b, valores);
			if (b === null) { return null; }
			if (no.op === "+") { return a + b; }
			if (no.op === "-") { return a - b; }
			if (no.op === "*") { return a * b; }
			if (no.op === "/") { return b === 0 ? null : a / b; }
			return null;
		}

		return {
			variaveis: Object.keys(variaveis).sort(),
			avaliar: function (valores) { return avaliar(arvoreFormula, valores || {}); }
		};
	}

	/** "P1 / P2" → "11 / 87" com os valores das parcelas no lugar. */
	function contaComValores(formula, valores) {
		return String(formula || "").replace(/\b[Pp](\d+)\b/g, function (m, n) {
			var v = valores["P" + n];
			return v === null || v === undefined ? "?" : formatarNumero(v);
		}).replace(/\s+/g, " ").trim();
	}

	/* ================================================================
	 * Metas
	 * ================================================================ */

	/**
	 * Metas em unidade de exibicao (90 = 90% para metrica percentual).
	 * sentido "maior": quanto maior melhor; "menor": quanto menor melhor.
	 */
	function farol(valor, metas, formato) {
		if (!metas || vazio(metas.verde) || valor === null || valor === undefined || !isFinite(valor)) { return "None"; }
		var v = formato === "percentual" ? valor * 100 : valor;
		var verde = paraNumero(metas.verde);
		var amarelo = vazio(metas.amarelo) ? verde : paraNumero(metas.amarelo);
		if (verde === null) { return "None"; }
		if (metas.sentido === "menor") {
			if (v <= verde) { return "Success"; }
			return v <= amarelo ? "Warning" : "Error";
		}
		if (v >= verde) { return "Success"; }
		return v >= amarelo ? "Warning" : "Error";
	}

	var ROTULO_FAROL = { Success: "Dentro da meta", Warning: "Atenção", Error: "Fora da meta", None: "" };

	/* ================================================================
	 * Normalizacao e validacao da definicao
	 * ================================================================ */

	function normalizarFiltros(lista) {
		return (lista || []).map(function (f) {
			var saida = { campo: f.campo || "", operador: f.operador || "" };
			if (!vazio(f.valor)) { saida.valor = String(f.valor); }
			if (!vazio(f.valor2)) { saida.valor2 = String(f.valor2); }
			return saida;
		});
	}

	function normalizarDimensao(d) {
		if (!d || !d.campo) { return null; }
		var t = d.transformacao || {};
		var saida = { campo: d.campo, transformacao: { tipo: t.tipo || "valor" } };
		if (!vazio(t.n)) { saida.transformacao.n = paraNumero(t.n); }
		return saida;
	}

	/**
	 * Devolve so as propriedades do esquema, com padroes preenchidos. E o
	 * que vai para o backend: nada de estado de tela gravado junto.
	 */
	function normalizar(def) {
		var d = def || {};
		var tipo = TIPOS.indexOf(d.tipo) >= 0 ? d.tipo : "metrica";
		var saida = {
			versao: VERSAO,
			nome: String(d.nome || "").trim(),
			descricao: String(d.descricao || "").trim(),
			tipo: tipo,
			grafico: { tipo: (d.grafico && d.grafico.tipo) || "nenhum" }
		};
		if (d.id !== undefined && d.id !== null) { saida.id = d.id; }

		if (tipo === "metrica") {
			saida.parcelas = (d.parcelas || []).map(function (p, i) {
				return {
					id: "P" + (i + 1),
					rotulo: String(p.rotulo || "").trim() || ("Parcela " + (i + 1)),
					fonte: p.fonte || "rastreadores",
					agregacao: p.agregacao || "contagem",
					campo: p.agregacao && p.agregacao !== "contagem" ? (p.campo || "") : "",
					filtros: normalizarFiltros(p.filtros)
				};
			});
			saida.formula = String(d.formula || "").trim();
			saida.formato = ["percentual", "numero", "decimal"].indexOf(d.formato) >= 0 ? d.formato : "numero";
			saida.casas = vazio(d.casas) ? (saida.formato === "percentual" ? 1 : 0) : Math.max(0, Math.min(4, paraNumero(d.casas) || 0));
			saida.agrupamento = normalizarDimensao(d.agrupamento);
			saida.metas = d.metas && !vazio(d.metas.verde) ? {
				sentido: d.metas.sentido === "menor" ? "menor" : "maior",
				verde: paraNumero(d.metas.verde),
				amarelo: vazio(d.metas.amarelo) ? null : paraNumero(d.metas.amarelo)
			} : null;
		}

		if (tipo === "tabela") {
			saida.fonte = d.fonte || "rastreadores";
			saida.filtros = normalizarFiltros(d.filtros);
			saida.linhas = (d.linhas || []).map(normalizarDimensao).filter(Boolean).slice(0, 2);
			saida.colunas = normalizarDimensao(d.colunas);
			saida.valores = (d.valores && d.valores.length ? d.valores : [{ agregacao: "contagem" }]).map(function (v) {
				return {
					agregacao: v.agregacao || "contagem",
					campo: v.agregacao && v.agregacao !== "contagem" ? (v.campo || "") : "",
					rotulo: String(v.rotulo || "").trim(),
					percentualDoTotal: !!v.percentualDoTotal
				};
			});
			saida.ordenacao = {
				por: d.ordenacao && d.ordenacao.por === "valor" ? "valor" : "grupo",
				sentido: d.ordenacao && d.ordenacao.sentido === "desc" ? "desc" : "asc"
			};
			saida.limite = vazio(d.limite) ? null : Math.max(1, paraNumero(d.limite) || 1);
			saida.mostrarTotal = d.mostrarTotal !== false;
		}

		if (tipo === "lista") {
			saida.fonte = d.fonte || "rastreadores";
			saida.filtros = normalizarFiltros(d.filtros);
			saida.campos = (d.campos || []).filter(Boolean);
			saida.ordenacao = d.ordenacao && d.ordenacao.campo ? {
				campo: d.ordenacao.campo,
				sentido: d.ordenacao.sentido === "desc" ? "desc" : "asc"
			} : null;
			saida.limite = vazio(d.limite) ? null : Math.max(1, paraNumero(d.limite) || 1);
			saida.grafico = { tipo: "nenhum" };
		}
		return saida;
	}

	function validarFiltros(fonteId, filtros, onde, erros) {
		(filtros || []).forEach(function (f, i) {
			var nome = onde + ", filtro " + (i + 1);
			var c = campos.campo(fonteId, f.campo);
			if (!c) { erros.push(nome + ": escolha o campo."); return; }
			var op = campos.OPERADORES[f.operador];
			if (!op || op.tipos.indexOf(c.tipo) < 0) { erros.push(nome + ": escolha a condição."); return; }
			if (op.valores >= 1 && vazio(f.valor)) { erros.push(nome + ": informe o valor."); return; }
			if (op.valores >= 2 && vazio(f.valor2)) { erros.push(nome + ": informe o segundo valor."); return; }
			if (op.valores >= 1 && f.operador !== "em" && ["numero", "percentual"].indexOf(c.tipo) >= 0 && paraNumero(f.valor) === null) {
				erros.push(nome + ": \"" + f.valor + "\" não é um número.");
			}
			if (op.valores >= 1 && c.tipo === "data" && f.operador !== "ultimosDias" && paraData(f.valor) === null) {
				erros.push(nome + ": \"" + f.valor + "\" não é uma data (use 31/12/2026).");
			}
		});
	}

	function validarAgregacao(fonteId, agregacao, campoId, onde, erros) {
		var ag = campos.AGREGACOES[agregacao];
		if (!ag) { erros.push(onde + ": escolha o cálculo."); return; }
		if (!ag.campo) { return; }
		var c = campos.campo(fonteId, campoId);
		if (!c) { erros.push(onde + ": escolha o campo para \"" + ag.rotulo.toLowerCase() + "\"."); return; }
		if (ag.tipos.indexOf(c.tipo) < 0) {
			erros.push(onde + ": \"" + ag.rotulo + "\" não se aplica ao campo \"" + c.rotulo + "\".");
		}
	}

	function validarDimensao(fonteIds, dim, onde, erros) {
		if (!dim) { return; }
		fonteIds.forEach(function (f) {
			var c = campos.campo(f, dim.campo);
			if (!c) {
				erros.push(onde + ": o campo \"" + dim.campo + "\" não existe em " + campos.fonte(f).rotulo + ".");
				return;
			}
			var t = campos.TRANSFORMACOES[(dim.transformacao || {}).tipo || "valor"];
			if (!t || t.tipos.indexOf(c.tipo) < 0) {
				erros.push(onde + ": o agrupamento escolhido não se aplica a \"" + c.rotulo + "\".");
			} else if (t.parametro && !(paraNumero(dim.transformacao.n) > 0)) {
				erros.push(onde + ": informe " + t.parametro.toLowerCase() + ".");
			}
		});
	}

	/** Lista de mensagens; vazia quando o relatorio pode ser calculado. */
	function validar(defBruta) {
		var def = normalizar(defBruta);
		var erros = [];
		if (!def.nome) { erros.push("Dê um nome ao relatório."); }

		if (def.tipo === "metrica") {
			if (!def.parcelas.length) { erros.push("Inclua pelo menos uma parcela."); }
			def.parcelas.forEach(function (p) {
				var onde = p.id + " (" + p.rotulo + ")";
				if (!campos.fonte(p.fonte)) { erros.push(onde + ": escolha a fonte de dados."); return; }
				validarAgregacao(p.fonte, p.agregacao, p.campo, onde, erros);
				validarFiltros(p.fonte, p.filtros, onde, erros);
			});
			try {
				var f = compilar(def.formula);
				f.variaveis.forEach(function (v) {
					if (!def.parcelas.some(function (p) { return p.id === v; })) {
						erros.push("A fórmula usa " + v + ", mas só existem " + def.parcelas.length + " parcela(s).");
					}
				});
			} catch (e) {
				erros.push(e.message);
			}
			validarDimensao(def.parcelas.map(function (p) { return p.fonte; }).filter(function (x, i, a) {
				return campos.fonte(x) && a.indexOf(x) === i;
			}), def.agrupamento, "Agrupamento", erros);
			if (def.metas && def.metas.verde === null) { erros.push("Meta: o valor de \"verde\" precisa ser número."); }
		}

		if (def.tipo === "tabela") {
			if (!campos.fonte(def.fonte)) { erros.push("Escolha a fonte de dados."); return erros; }
			validarFiltros(def.fonte, def.filtros, "Filtro", erros);
			if (!def.linhas.length) { erros.push("Escolha pelo menos um campo para as linhas."); }
			def.linhas.forEach(function (l, i) { validarDimensao([def.fonte], l, "Linha " + (i + 1), erros); });
			validarDimensao([def.fonte], def.colunas, "Colunas", erros);
			def.valores.forEach(function (v, i) { validarAgregacao(def.fonte, v.agregacao, v.campo, "Valor " + (i + 1), erros); });
		}

		if (def.tipo === "lista") {
			if (!campos.fonte(def.fonte)) { erros.push("Escolha a fonte de dados."); return erros; }
			validarFiltros(def.fonte, def.filtros, "Filtro", erros);
			if (!def.campos.length) { erros.push("Escolha pelo menos uma coluna."); }
			def.campos.forEach(function (c) {
				if (!campos.campo(def.fonte, c)) { erros.push("A coluna \"" + c + "\" não existe nesta fonte."); }
			});
		}
		return erros;
	}

	/* ================================================================
	 * Execucao
	 * ================================================================ */

	function tipoDeColuna(campo) {
		if (!campo) { return "texto"; }
		if (campo.equipamento) { return "equipamento"; }
		if (campo.tipo === "numero") { return "numero"; }
		if (campo.tipo === "percentual") { return "percentual"; }
		return "texto";
	}

	function rotuloValor(fonteId, v) {
		if (v.rotulo) { return v.rotulo; }
		if (v.agregacao === "contagem") { return "Quantidade"; }
		var c = campos.campo(fonteId, v.campo);
		var ag = campos.AGREGACOES[v.agregacao];
		return (ag ? ag.rotulo : v.agregacao) + " de " + (c ? c.rotulo : v.campo);
	}

	/** Tipo do resultado de uma agregacao: media de percentual continua percentual. */
	function tipoDoValor(fonteId, v) {
		var c = campos.campo(fonteId, v.campo);
		if (c && c.tipo === "percentual" && ["media", "minimo", "maximo"].indexOf(v.agregacao) >= 0) { return "percentual"; }
		return "numero";
	}

	function calcularParcelas(def, d, agora) {
		var porParcela = {};
		def.parcelas.forEach(function (p) {
			var linhas = filtrar(campos.linhas(p.fonte, d), p.filtros, p.fonte, agora);
			var c = campos.campo(p.fonte, p.campo);
			porParcela[p.id] = {
				linhas: linhas,
				tipoCampo: c ? c.tipo : null
			};
		});
		return porParcela;
	}

	function executarMetrica(def, d, agora) {
		var formula = compilar(def.formula);
		var dados = calcularParcelas(def, d, agora);

		function valoresDe(filtroLinhas) {
			var valores = {};
			def.parcelas.forEach(function (p) {
				var linhas = filtroLinhas ? filtroLinhas(p, dados[p.id].linhas) : dados[p.id].linhas;
				valores[p.id] = agregar(linhas, p.agregacao, p.campo, dados[p.id].tipoCampo);
			});
			return valores;
		}

		var valores = valoresDe(null);
		var valor = formula.avaliar(valores);
		var texto = formatarValor(valor, def.formato, def.casas);
		var conta = contaComValores(def.formula, valores) + " = " + texto;

		var parcelas = def.parcelas.map(function (p) {
			return {
				id: p.id, rotulo: p.rotulo, valor: valores[p.id],
				texto: formatarNumero(valores[p.id]),
				fonte: campos.fonte(p.fonte).rotulo,
				quantidade: dados[p.id].linhas.length
			};
		});

		var resultado = {
			tipo: "metrica",
			valor: valor,
			texto: texto,
			conta: conta,
			formula: def.formula,
			farol: farol(valor, def.metas, def.formato),
			parcelas: parcelas,
			colunas: [],
			linhas: []
		};
		resultado.farolTexto = ROTULO_FAROL[resultado.farol];

		var tipoResultado = def.formato === "percentual" ? "percentual" : "numero";
		var colunaResultado = { chave: "resultado", rotulo: "Resultado", tipo: tipoResultado, casas: def.casas, formato: def.formato };
		var colunasParcelas = def.parcelas.map(function (p) {
			return { chave: p.id, rotulo: p.id + " · " + p.rotulo, tipo: "numero", drill: true };
		});

		if (def.agrupamento) {
			var dim = def.agrupamento;
			var chaves = {};
			var ordemDe = {};
			def.parcelas.forEach(function (p) {
				var c = campos.campo(p.fonte, dim.campo);
				dados[p.id].linhas.forEach(function (l) {
					var k = chaveDeGrupo(l[dim.campo], c ? c.tipo : "texto", dim.transformacao);
					(chaves[k.chave] = chaves[k.chave] || {});
					ordemDe[k.chave] = k.ordem;
				});
			});
			var lista = Object.keys(chaves).sort(function (a, b) { return compararOrdem(ordemDe[a], ordemDe[b]); });

			resultado.colunas = [{ chave: "grupo", rotulo: rotuloDimensao(def.parcelas[0].fonte, dim), tipo: "texto" }]
				.concat(colunasParcelas).concat([colunaResultado]);

			resultado.linhas = lista.map(function (chave) {
				var v = valoresDe(function (p, linhas) {
					var c = campos.campo(p.fonte, dim.campo);
					return linhas.filter(function (l) {
						return chaveDeGrupo(l[dim.campo], c ? c.tipo : "texto", dim.transformacao).chave === chave;
					});
				});
				var r = formula.avaliar(v);
				var linha = { grupo: chave, resultado: r, _alvo: { grupo: [chave] }, _farol: farol(r, def.metas, def.formato) };
				def.parcelas.forEach(function (p) { linha[p.id] = v[p.id]; });
				return linha;
			});

			var total = { grupo: "Total", resultado: valor, _alvo: {}, _total: true, _farol: resultado.farol };
			def.parcelas.forEach(function (p) { total[p.id] = valores[p.id]; });
			resultado.linhas.push(total);

			resultado.grafico = {
				tipo: def.grafico.tipo,
				titulo: def.nome,
				medida: "Resultado",
				percentual: def.formato === "percentual",
				categorias: lista,
				series: [{
					nome: "Resultado",
					valores: resultado.linhas.filter(function (l) { return !l._total; }).map(function (l) { return l.resultado; })
				}]
			};
		} else {
			resultado.colunas = colunasParcelas.concat([colunaResultado]);
			var unica = { resultado: valor, _alvo: {}, _farol: resultado.farol };
			def.parcelas.forEach(function (p) { unica[p.id] = valores[p.id]; });
			resultado.linhas = [unica];
			resultado.grafico = {
				tipo: def.grafico.tipo,
				titulo: def.nome,
				medida: "Valor",
				percentual: false,
				categorias: def.parcelas.map(function (p) { return p.id + " · " + p.rotulo; }),
				series: [{ nome: "Valor", valores: def.parcelas.map(function (p) { return valores[p.id]; }) }]
			};
		}
		return resultado;
	}

	function executarTabela(def, d, agora) {
		var fonteId = def.fonte;
		var linhas = filtrar(campos.linhas(fonteId, d), def.filtros, fonteId, agora);
		var grupos = agrupar(linhas, def.linhas, fonteId);
		var tiposValor = def.valores.map(function (v) {
			var c = campos.campo(fonteId, v.campo);
			return c ? c.tipo : null;
		});

		function calcularValores(ls) {
			return def.valores.map(function (v, i) { return agregar(ls, v.agregacao, v.campo, tiposValor[i]); });
		}

		// colunas cruzadas: valores distintos do campo de coluna
		var chavesColuna = [];
		var tipoCampoColuna = null;
		if (def.colunas) {
			var cc = campos.campo(fonteId, def.colunas.campo);
			tipoCampoColuna = cc ? cc.tipo : "texto";
			var vistas = {};
			linhas.forEach(function (l) {
				var k = chaveDeGrupo(l[def.colunas.campo], tipoCampoColuna, def.colunas.transformacao);
				if (!vistas[k.chave]) { vistas[k.chave] = k; chavesColuna.push(k); }
			});
			chavesColuna.sort(function (a, b) { return compararOrdem(a.ordem, b.ordem); });
		}

		function naColuna(ls, chave) {
			return ls.filter(function (l) {
				return chaveDeGrupo(l[def.colunas.campo], tipoCampoColuna, def.colunas.transformacao).chave === chave;
			});
		}

		var totalGeral = calcularValores(linhas);

		// --- colunas da tabela de saida ---
		var colunas = def.linhas.map(function (dim, i) {
			return { chave: "g" + i, rotulo: rotuloDimensao(fonteId, dim), tipo: "texto" };
		});
		def.valores.forEach(function (v, i) {
			var rot = rotuloValor(fonteId, v);
			var tipo = tipoDoValor(fonteId, v);
			if (def.colunas) {
				chavesColuna.forEach(function (k, j) {
					colunas.push({
						chave: "c" + j + "_v" + i,
						rotulo: (def.valores.length > 1 ? rot + " · " : "") + k.chave,
						tipo: tipo, drill: true, _coluna: k.chave
					});
				});
				colunas.push({ chave: "t_v" + i, rotulo: (def.valores.length > 1 ? rot + " · " : "") + "Total", tipo: tipo, drill: true, _total: true });
			} else {
				colunas.push({ chave: "v" + i, rotulo: rot, tipo: tipo, drill: true });
			}
			if (v.percentualDoTotal) {
				colunas.push({ chave: "p_v" + i, rotulo: "% do total" + (def.valores.length > 1 ? " · " + rot : ""), tipo: "percentual", casas: 1 });
			}
		});

		function montarLinha(chaves, ls, alvo) {
			var saida = { _alvo: alvo };
			chaves.forEach(function (k, i) { saida["g" + i] = k; });
			var vals = calcularValores(ls);
			def.valores.forEach(function (v, i) {
				if (def.colunas) {
					chavesColuna.forEach(function (k, j) {
						saida["c" + j + "_v" + i] = agregar(naColuna(ls, k.chave), v.agregacao, v.campo, tiposValor[i]);
					});
					saida["t_v" + i] = vals[i];
				} else {
					saida["v" + i] = vals[i];
				}
				if (v.percentualDoTotal) {
					saida["p_v" + i] = totalGeral[i] ? vals[i] / totalGeral[i] : null;
				}
			});
			saida._ordemValor = vals[0];
			return saida;
		}

		var saidaLinhas = grupos.map(function (g) {
			var linha = montarLinha(g.chaves, g.linhas, { grupo: g.chaves });
			linha._ordens = g.ordens;
			linha._linhas = g.linhas;
			return linha;
		});

		// --- ordenacao ---
		var fator = def.ordenacao.sentido === "desc" ? -1 : 1;
		saidaLinhas.sort(function (a, b) {
			if (def.ordenacao.por === "valor") {
				var va = a._ordemValor === null ? -Infinity : a._ordemValor;
				var vb = b._ordemValor === null ? -Infinity : b._ordemValor;
				if (va !== vb) { return (va - vb) * fator; }
			}
			for (var i = 0; i < a._ordens.length; i++) {
				var c = compararOrdem(a._ordens[i], b._ordens[i]);
				if (c !== 0) { return c * (def.ordenacao.por === "grupo" ? fator : 1); }
			}
			return 0;
		});

		// --- top N: o restante vira "Outros", para o total continuar batendo ---
		if (def.limite && saidaLinhas.length > def.limite) {
			var resto = saidaLinhas.slice(def.limite);
			saidaLinhas = saidaLinhas.slice(0, def.limite);
			var linhasResto = resto.reduce(function (acc, l) { return acc.concat(l._linhas); }, []);
			var chavesOutros = def.linhas.map(function (x, i) { return i === 0 ? "Outros (" + resto.length + ")" : ""; });
			var outros = montarLinha(chavesOutros, linhasResto, { grupos: resto.map(function (l) { return l._alvo.grupo; }) });
			outros._outros = true;
			saidaLinhas.push(outros);
		}

		saidaLinhas.forEach(function (l) { delete l._linhas; delete l._ordens; delete l._ordemValor; });

		if (def.mostrarTotal) {
			var total = montarLinha(def.linhas.map(function (x, i) { return i === 0 ? "Total" : ""; }), linhas, {});
			delete total._ordemValor;
			total._total = true;
			saidaLinhas.push(total);
		}

		// --- grafico ---
		var semTotal = saidaLinhas.filter(function (l) { return !l._total; });
		var categorias = semTotal.map(function (l) {
			return def.linhas.map(function (x, i) { return l["g" + i]; }).filter(Boolean).join(" · ");
		});
		var series;
		if (def.colunas) {
			series = chavesColuna.map(function (k, j) {
				return { nome: k.chave, valores: semTotal.map(function (l) { return l["c" + j + "_v0"]; }) };
			});
		} else {
			series = def.valores.map(function (v, i) {
				return { nome: rotuloValor(fonteId, v), valores: semTotal.map(function (l) { return l["v" + i]; }) };
			});
		}

		return {
			tipo: "tabela",
			fonte: campos.fonte(fonteId).rotulo,
			registros: linhas.length,
			colunas: colunas,
			linhas: saidaLinhas,
			grafico: {
				tipo: def.grafico.tipo,
				titulo: def.nome,
				medida: rotuloValor(fonteId, def.valores[0]),
				percentual: tipoDoValor(fonteId, def.valores[0]) === "percentual",
				empilhado: !!def.colunas,
				categorias: categorias,
				series: series
			}
		};
	}

	function ordenarLinhas(linhas, campoId, tipo, sentido) {
		var fator = sentido === "desc" ? -1 : 1;
		return linhas.slice().sort(function (a, b) {
			var va = comparavel(tipo, a[campoId]);
			var vb = comparavel(tipo, b[campoId]);
			if (va === vb) { return 0; }
			if (va === null || va === "") { return 1; }
			if (vb === null || vb === "") { return -1; }
			return compararOrdem(va, vb) * fator;
		});
	}

	function executarLista(def, d, agora) {
		var fonteId = def.fonte;
		var linhas = filtrar(campos.linhas(fonteId, d), def.filtros, fonteId, agora);
		var total = linhas.length;
		if (def.ordenacao) {
			var c = campos.campo(fonteId, def.ordenacao.campo);
			if (c) { linhas = ordenarLinhas(linhas, c.id, c.tipo, def.ordenacao.sentido); }
		}
		if (def.limite) { linhas = linhas.slice(0, def.limite); }

		var colunas = def.campos.map(function (id) {
			var c = campos.campo(fonteId, id);
			return { chave: id, rotulo: c ? c.rotulo : id, tipo: tipoDeColuna(c), tipoCampo: c ? c.tipo : "texto" };
		});
		return {
			tipo: "lista",
			fonte: campos.fonte(fonteId).rotulo,
			registros: total,
			colunas: colunas,
			linhas: linhas.map(function (l) {
				var saida = { _alvo: {} };
				colunas.forEach(function (c) {
					var v = l[c.chave];
					if (c.tipoCampo === "booleano") { v = v === true ? "Sim" : "Não"; }
					if (c.tipoCampo === "data") { v = vazio(v) ? "" : chaveDeGrupo(v, "data", { tipo: "dia" }).chave; }
					saida[c.chave] = v;
				});
				return saida;
			}),
			grafico: { tipo: "nenhum", categorias: [], series: [] }
		};
	}

	/* ================================================================
	 * Drill-down: os registros por tras de um numero
	 * ================================================================ */

	function listaDeRegistros(fonteId, linhas, titulo, arquivo, extras) {
		var f = campos.fonte(fonteId);
		var ids = f.colunasPadrao.slice();
		(extras || []).forEach(function (x) { if (x && ids.indexOf(x) < 0 && campos.campo(fonteId, x)) { ids.push(x); } });
		var colunas = ids.map(function (id) {
			var c = campos.campo(fonteId, id);
			var col = { chave: id, rotulo: c.rotulo, tipo: tipoDeColuna(c) };
			if (c.tipo === "percentual" || c.tipo === "numero") { col.largura = "8rem"; }
			return col;
		});
		return {
			titulo: titulo,
			arquivo: arquivo,
			colunas: colunas,
			linhas: linhas.map(function (l) {
				var saida = {};
				ids.forEach(function (id) {
					var c = campos.campo(fonteId, id);
					var v = l[id];
					if (c.tipo === "booleano") { v = v === true ? "Sim" : "Não"; }
					if (c.tipo === "data") { v = vazio(v) ? "" : chaveDeGrupo(v, "data", { tipo: "dia" }).chave; }
					saida[id] = v;
				});
				return saida;
			})
		};
	}

	function casaGrupo(linha, dims, fonteId, chaves) {
		return dims.every(function (dim, i) {
			if (chaves[i] === undefined || chaves[i] === "") { return true; }
			var c = campos.campo(fonteId, dim.campo);
			return chaveDeGrupo(linha[dim.campo], c ? c.tipo : "texto", dim.transformacao).chave === chaves[i];
		});
	}

	/**
	 * Registros por tras de uma celula. Devolve a definicao de uma lista no
	 * formato de regras/detalhamentos (abre no mesmo popup, com EXCEL e link
	 * para a ficha), ou null quando a celula nao tem registros (resultado de
	 * formula, % do total).
	 *
	 * alvo: { grupo?: [chaves], grupos?: [[chaves]...], coluna?: chave, parcela?: "P1" }
	 */
	function itens(defBruta, d, alvo, opcoes) {
		var def = normalizar(defBruta);
		var agora = (opcoes && opcoes.agora) || Date.now();
		var a = alvo || {};
		var sufixo = [];

		if (def.tipo === "metrica") {
			var p = def.parcelas.filter(function (x) { return x.id === a.parcela; })[0];
			if (!p) { return null; }
			var ls = filtrar(campos.linhas(p.fonte, d), p.filtros, p.fonte, agora);
			if (def.agrupamento && a.grupo && a.grupo.length) {
				ls = ls.filter(function (l) { return casaGrupo(l, [def.agrupamento], p.fonte, a.grupo); });
				sufixo.push(a.grupo[0]);
			}
			return listaDeRegistros(p.fonte, ls,
				def.nome + " · " + p.id + " " + p.rotulo + (sufixo.length ? " · " + sufixo.join(" · ") : ""),
				def.nome + "_" + p.id,
				[p.campo, def.agrupamento && def.agrupamento.campo].concat((p.filtros || []).map(function (f) { return f.campo; })));
		}

		if (def.tipo === "tabela") {
			var fonteId = def.fonte;
			var linhas = filtrar(campos.linhas(fonteId, d), def.filtros, fonteId, agora);
			if (a.grupos) {
				linhas = linhas.filter(function (l) {
					return a.grupos.some(function (g) { return casaGrupo(l, def.linhas, fonteId, g); });
				});
				sufixo.push("Outros");
			} else if (a.grupo) {
				linhas = linhas.filter(function (l) { return casaGrupo(l, def.linhas, fonteId, a.grupo); });
				sufixo = sufixo.concat(a.grupo.filter(Boolean));
			}
			if (def.colunas && a.coluna !== undefined) {
				var cc = campos.campo(fonteId, def.colunas.campo);
				linhas = linhas.filter(function (l) {
					return chaveDeGrupo(l[def.colunas.campo], cc ? cc.tipo : "texto", def.colunas.transformacao).chave === a.coluna;
				});
				sufixo.push(a.coluna);
			}
			var extras = def.linhas.map(function (x) { return x.campo; })
				.concat(def.colunas ? [def.colunas.campo] : [])
				.concat(def.valores.map(function (v) { return v.campo; }));
			return listaDeRegistros(fonteId, linhas,
				def.nome + (sufixo.length ? " · " + sufixo.join(" · ") : " · todos"),
				def.nome, extras);
		}
		return null;
	}

	/* ================================================================
	 * Modelos prontos
	 * ================================================================ */

	var HABILITADO = { campo: "habilitado", operador: "verdadeiro" };

	var MODELOS = [
		{
			modelo: "disponibilidade",
			nome: "Disponibilidade dos rastreadores",
			descricao: "Rastreadores habilitados que estão comunicando, sobre o total habilitado. Mesmo número do indicador.",
			tipo: "metrica",
			parcelas: [
				{ rotulo: "Rastreadores comunicando", fonte: "rastreadores", agregacao: "contagem", filtros: [HABILITADO, { campo: "comunicando", operador: "verdadeiro" }] },
				{ rotulo: "Total de rastreadores", fonte: "rastreadores", agregacao: "contagem", filtros: [HABILITADO] }
			],
			formula: "P1 / P2", formato: "percentual", casas: 1,
			metas: { sentido: "maior", verde: 90, amarelo: 80 },
			grafico: { tipo: "nenhum" }
		},
		{
			modelo: "sem-comunicacao",
			nome: "Rastreadores sem comunicação (%)",
			descricao: "Rastreadores mudos sobre o total — o complemento da disponibilidade.",
			tipo: "metrica",
			parcelas: [
				{ rotulo: "Quantidade de rastreadores mudos", fonte: "rastreadores", agregacao: "contagem", filtros: [HABILITADO, { campo: "mudo", operador: "verdadeiro" }] },
				{ rotulo: "Quantidade total de rastreadores", fonte: "rastreadores", agregacao: "contagem", filtros: [HABILITADO] }
			],
			formula: "P1 / P2", formato: "percentual", casas: 1,
			metas: { sentido: "menor", verde: 10, amarelo: 20 },
			grafico: { tipo: "nenhum" }
		},
		{
			modelo: "por-localidade",
			nome: "Rastreadores por localidade",
			descricao: "Contagem de rastreadores pelos 4 primeiros caracteres do local de instalação, com a participação de cada um.",
			tipo: "tabela",
			fonte: "rastreadores",
			filtros: [],
			linhas: [{ campo: "local", transformacao: { tipo: "primeiros", n: 4 } }],
			colunas: null,
			valores: [{ agregacao: "contagem", rotulo: "Rastreadores", percentualDoTotal: true }],
			ordenacao: { por: "valor", sentido: "desc" },
			mostrarTotal: true,
			grafico: { tipo: "barras" }
		},
		{
			modelo: "disponibilidade-por-prefixo",
			nome: "Disponibilidade por prefixo",
			descricao: "A disponibilidade aberta por prefixo do local de instalação, com meta.",
			tipo: "metrica",
			parcelas: [
				{ rotulo: "Comunicando", fonte: "rastreadores", agregacao: "contagem", filtros: [HABILITADO, { campo: "comunicando", operador: "verdadeiro" }] },
				{ rotulo: "Total", fonte: "rastreadores", agregacao: "contagem", filtros: [HABILITADO] }
			],
			formula: "P1 / P2", formato: "percentual", casas: 1,
			agrupamento: { campo: "prefixo", transformacao: { tipo: "valor" } },
			metas: { sentido: "maior", verde: 90, amarelo: 80 },
			grafico: { tipo: "colunas" }
		},
		{
			modelo: "cobertura-por-familia",
			nome: "Cobertura da árvore por família",
			descricao: "Componentes com rastreador sobre o que a árvore SAP declara, por família (limitado a 100%).",
			tipo: "metrica",
			parcelas: [
				{ rotulo: "Com rastreador", fonte: "veiculoFamilia", agregacao: "soma", campo: "comRastreador", filtros: [] },
				{ rotulo: "Na árvore SAP", fonte: "veiculoFamilia", agregacao: "soma", campo: "naArvore", filtros: [] }
			],
			formula: "min(P1 / P2, 1)", formato: "percentual", casas: 1,
			agrupamento: { campo: "familia", transformacao: { tipo: "valor" } },
			metas: { sentido: "maior", verde: 90, amarelo: 70 },
			grafico: { tipo: "barras" }
		},
		{
			modelo: "situacao-por-prefixo",
			nome: "Situação × prefixo",
			descricao: "Tabela cruzada: quantos rastreadores em cada situação, por prefixo.",
			tipo: "tabela",
			fonte: "rastreadores",
			filtros: [HABILITADO],
			linhas: [{ campo: "situacao", transformacao: { tipo: "valor" } }],
			colunas: { campo: "prefixo", transformacao: { tipo: "valor" } },
			valores: [{ agregacao: "contagem", rotulo: "Rastreadores" }],
			ordenacao: { por: "valor", sentido: "desc" },
			limite: 10,
			mostrarTotal: true,
			grafico: { tipo: "colunas" }
		},
		{
			modelo: "notas-por-oficina",
			nome: "Notas abertas por oficina",
			descricao: "Notas YA por oficina, separando as de equipamentos com e sem rastreador.",
			tipo: "tabela",
			fonte: "notas",
			filtros: [],
			linhas: [{ campo: "oficina", transformacao: { tipo: "valor" } }],
			colunas: { campo: "temRastreador", transformacao: { tipo: "valor" } },
			valores: [{ agregacao: "contagem", rotulo: "Notas" }],
			ordenacao: { por: "valor", sentido: "desc" },
			mostrarTotal: true,
			grafico: { tipo: "barras" }
		},
		{
			modelo: "mudos-30-dias",
			nome: "Rastreadores mudos há mais de 30 dias",
			descricao: "Lista para ação de campo: quem está calado há mais tempo aparece primeiro.",
			tipo: "lista",
			fonte: "rastreadores",
			filtros: [HABILITADO, { campo: "dias", operador: "maior", valor: "30" }],
			campos: ["equipamento", "descricao", "local", "situacao", "gateway", "dias", "ultimaAtualizacao"],
			ordenacao: { campo: "dias", sentido: "desc" }
		}
	];

	/* ================================================================
	 * API
	 * ================================================================ */

	var api = {
		VERSAO: VERSAO,
		TIPOS: TIPOS,
		MODELOS: MODELOS,

		normalizar: normalizar,
		validar: validar,
		compilar: compilar,
		farol: farol,
		formatarValor: formatarValor,
		formatarNumero: formatarNumero,
		paraData: paraData,
		itens: itens,

		/** Um modelo pronto, como definicao nova (sem id). */
		modelo: function (id) {
			var m = MODELOS.filter(function (x) { return x.modelo === id; })[0];
			if (!m) { return null; }
			var def = normalizar(clonar(m));
			delete def.id;
			return def;
		},

		/** Definicao vazia de um tipo, pronta para o editor. */
		novo: function (tipo) {
			if (tipo === "tabela") {
				return normalizar({
					tipo: "tabela", fonte: "rastreadores",
					linhas: [{ campo: "prefixo", transformacao: { tipo: "valor" } }],
					valores: [{ agregacao: "contagem", percentualDoTotal: true }],
					grafico: { tipo: "barras" }
				});
			}
			if (tipo === "lista") {
				return normalizar({ tipo: "lista", fonte: "rastreadores", campos: campos.fonte("rastreadores").colunasPadrao.slice() });
			}
			return normalizar({
				tipo: "metrica",
				parcelas: [
					{ rotulo: "Numerador", fonte: "rastreadores", agregacao: "contagem", filtros: [] },
					{ rotulo: "Denominador", fonte: "rastreadores", agregacao: "contagem", filtros: [] }
				],
				formula: "P1 / P2", formato: "percentual"
			});
		},

		/**
		 * Calcula o relatorio. Nunca lanca: erro de definicao volta em
		 * `erros`, para a pre-visualizacao mostrar em vez de quebrar.
		 */
		executar: function (defBruta, d, opcoes) {
			var erros = validar(defBruta);
			if (erros.length) { return { erros: erros }; }
			var def = normalizar(defBruta);
			var agora = (opcoes && opcoes.agora) || Date.now();
			try {
				var r;
				if (def.tipo === "metrica") { r = executarMetrica(def, d || {}, agora); }
				if (def.tipo === "tabela") { r = executarTabela(def, d || {}, agora); }
				if (def.tipo === "lista") { r = executarLista(def, d || {}, agora); }
				r.erros = [];
				r.nome = def.nome;
				r.descricao = def.descricao;
				return r;
			} catch (e) {
				return { erros: [e.message] };
			}
		},

		/** Tabela do resultado no formato do exportador (RelatorioPopup.exportar). */
		paraExportacao: function (def, resultado) {
			var r = resultado || {};
			var nome = (def && def.nome) || "Relatorio";
			var colunas = (r.colunas || []).map(function (c) {
				return { chave: c.chave, rotulo: c.rotulo, tipo: c.tipo === "equipamento" ? "equipamento" : c.tipo };
			});
			var linhas = (r.linhas || []).map(function (l) {
				var saida = {};
				colunas.forEach(function (c) { saida[c.chave] = l[c.chave]; });
				return saida;
			});
			if (r.tipo === "metrica" && !(def && def.agrupamento)) {
				colunas.push({ chave: "conta", rotulo: "Conta" });
				if (linhas[0]) { linhas[0].conta = r.conta; }
			}
			if (r.tipo === "metrica" && def && def.metas) {
				colunas.push({ chave: "situacaoMeta", rotulo: "Meta" });
				(r.linhas || []).forEach(function (l, i) { linhas[i].situacaoMeta = ROTULO_FAROL[l._farol] || ""; });
			}
			return { titulo: nome, arquivo: nome, colunas: colunas, linhas: linhas };
		},

		rotuloFarol: function (estado) {
			return ROTULO_FAROL[estado] || "";
		},

		/** Texto curto que descreve a definicao (lista de relatorios). */
		resumir: function (defBruta) {
			var def = normalizar(defBruta);
			if (def.tipo === "metrica") {
				return "Métrica · " + def.parcelas.length + " parcela(s) · " + def.formula +
					(def.agrupamento ? " · por " + rotuloDimensao(def.parcelas[0] ? def.parcelas[0].fonte : "rastreadores", def.agrupamento) : "");
			}
			if (def.tipo === "tabela") {
				return "Tabela · " + (campos.fonte(def.fonte) || {}).rotulo + " · " +
					def.linhas.map(function (l) { return rotuloDimensao(def.fonte, l); }).join(" › ") +
					(def.colunas ? " × " + rotuloDimensao(def.fonte, def.colunas) : "");
			}
			return "Lista · " + (campos.fonte(def.fonte) || {}).rotulo + " · " + def.campos.length + " coluna(s)";
		}
	};

	return api;
});
