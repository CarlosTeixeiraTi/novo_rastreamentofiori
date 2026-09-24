/**
 * Estado compartilhado da frota.
 *
 * Uma carga, um modelo. Hoje cada uma das tres telas refaz as mesmas
 * chamadas e monta o seu proprio `dashboard`, e por isso elas divergem
 * entre si. Aqui a carga acontece uma vez e todas as telas leem do mesmo
 * modelo `frota` — se um numero mudar, muda em todas ao mesmo tempo.
 *
 * O recorte por prefixo de LOCAL_INSTALACAO e aplicado AQUI, num lugar so:
 * trocar o prefixo na Sala de Controle recalcula tudo o que as outras
 * telas mostram, sem cada uma ter de saber filtrar.
 */
sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/base/EventProvider",
	"../service/Backend",
	"./regras/prefixo",
	"./regras/arvore",
	"./regras/silencio",
	"./regras/confianca",
	"./regras/zonas",
	"./regras/indicadores"
], function (JSONModel, EventProvider, Backend, prefixo, arvore, silencio, confianca, zonas, indicadores) {
	"use strict";

	var EVENTO_ATUALIZADO = "atualizado";

	var Frota = {
		_modelo: null,
		_bruto: null,
		_eventos: new EventProvider(),

		/**
		 * Avisa quando os dados da frota foram (re)calculados: carga
		 * inicial, botao Atualizar e troca de prefixo.
		 *
		 * As telas NAO devem usar `attachPropertyChange` do JSONModel para
		 * isso: esse evento so dispara quando a mudanca vem de um controle
		 * com binding two-way, nunca de `setProperty` feito por codigo.
		 * Era por isso que a Sala de Controle abria com o mapa vazio na
		 * primeira vez — a carga terminava e ninguem era avisado.
		 */
		aoAtualizar: function (fn, ouvinte) {
			this._eventos.attachEvent(EVENTO_ATUALIZADO, fn, ouvinte);
		},

		pararDeOuvir: function (fn, ouvinte) {
			this._eventos.detachEvent(EVENTO_ATUALIZADO, fn, ouvinte);
		},

		/** true depois que a primeira carga terminou. */
		pronto: function () {
			return !!this._bruto;
		},

		modelo: function () {
			if (!this._modelo) {
				this._modelo = new JSONModel({
					carregando: true,
					simulado: false,
					erro: null,
					prefixo: null,
					prefixos: [],
					resumo: {},
					porFamilia: [],
					conferencia: { veiculos: [], porFamilia: [], resumo: {} },
					indicadores: {},
					piloto: {},
					ativos: [],
					zonas: [],
					gateways: [],
					divergentes: [],
					movimentacoes: [],
					notas: [],
					ordens: [],
					semanal: [],
					backend: null,
					atualizadoEm: null
				});
				this._modelo.setSizeLimit(5000);
			}
			return this._modelo;
		},

		/** Carrega tudo. As falhas individuais nao derrubam a tela. */
		carregar: function () {
			var that = this;
			var m = this.modelo();
			m.setProperty("/carregando", true);

			function tolerante(promessa, recuo) {
				return promessa.catch(function () { return recuo; });
			}

			return Promise.all([
				tolerante(Backend.equipamentos(), []),
				tolerante(Backend.localizacaoAtual(), []),
				tolerante(Backend.veiculos(), []),
				tolerante(Backend.zonas(), []),
				tolerante(Backend.gateways(), []),
				tolerante(Backend.notas(), []),
				tolerante(Backend.ordens(), []),
				tolerante(Backend.rastreio(), []),
				tolerante(Backend.valorGerado(), null),
				tolerante(Backend.valorGeradoSemanal(), [])
			]).then(function (r) {
				that._bruto = {
					equipamentos: r[0] || [],
					rastreados: r[1] || [],
					veiculos: r[2] || [],
					zonas: r[3] || [],
					gateways: r[4] || [],
					notas: r[5] || [],
					ordens: r[6] || [],
					leituras: r[7] || [],
					valorGerado: r[8],
					semanal: r[9] || []
				};
				return that._carregarArvores();
			}).then(function () {
				m.setProperty("/simulado", Backend.estaSimulado());
				m.setProperty("/atualizadoEm", new Date());
				that.recalcular();
				m.setProperty("/carregando", false);
				return that._bruto;
			});
		},

		/**
		 * A arvore exige UMA chamada por veiculo: nao ha endpoint que
		 * aceite varios locais. E desenho da API do cliente, nao escolha
		 * daqui — fica registrado como pedido de backend no README.
		 */
		_carregarArvores: function () {
			var that = this;
			var veiculos = arvore.veiculosUnicos(this._bruto.veiculos);
			this._bruto.veiculosUnicos = veiculos;

			return Promise.all(veiculos.map(function (v) {
				var chave = v.local || v.nome;
				return Backend.arvoreDoLocal(chave)
					.then(function (mapa) { return { chave: chave, mapa: mapa || {} }; })
					.catch(function () { return { chave: chave, mapa: {} }; });
			})).then(function (lista) {
				var porLocal = {};
				lista.forEach(function (x) { porLocal[x.chave] = x.mapa; });
				that._bruto.arvorePorLocal = porLocal;
			});
		},

		definirPrefixo: function (valor) {
			this.modelo().setProperty("/prefixo", valor || null);
			this.recalcular();
		},

		/** Reaplica o recorte e recalcula tudo o que dele depende. */
		recalcular: function () {
			if (!this._bruto) { return; }
			var m = this.modelo();
			var b = this._bruto;
			var recorte = m.getProperty("/prefixo");
			var agora = Date.now();

			/* --- indice dos rastreados, por codigo normalizado --- */
			var porCodigo = {};
			var comTag = {};
			(b.rastreados || []).forEach(function (r) {
				var k = prefixo.chave(r.identificador);
				if (!k) { return; }
				porCodigo[k] = r;
				comTag[k] = true;
			});

			/* --- prefixos existentes: so de quem tem rastreador --- */
			var contagem = prefixo.contar(b.equipamentos, comTag);
			m.setProperty("/prefixos", contagem.prefixos);
			m.setProperty("/totalRastreadores", contagem.total);

			/* --- equipamentos do recorte --- */
			var porEquipamento = {};
			(b.equipamentos || []).forEach(function (e) {
				var k = prefixo.chave(e.EQUIPAMENTO);
				if (k) { porEquipamento[k] = e; }
			});

			var ativos = [];
			Object.keys(porCodigo).forEach(function (k) {
				var r = porCodigo[k];
				var eq = porEquipamento[k];
				var local = (eq && eq.LOCAL_INSTALACAO) || r.localInstalacao || null;
				if (!prefixo.casa(local, recorte)) { return; }

				var estado = silencio.avaliar(r.ultimaPosicaoAnalisada || r.updatedAt, r.grupoAtual, agora);
				ativos.push({
					codigo: k,
					codigoOriginal: (eq && eq.EQUIPAMENTO) || r.identificador,
					descricao: (eq && eq.DESC_EQUIPAMENTO) || r.descEquipamento || null,
					identificacaoTecnica: eq ? eq.IDENTIFICACAO_TECNICA : null,
					centro: (eq && eq.CENTRO_LOCALIZACAO) || r.centro_localizacao || null,
					local: local,
					descLocal: (eq && eq.DESC_LOCAL_INSTALACAO) || null,
					prefixo: prefixo.de(local),
					oficina: r.oficina || null,
					nota: r.nota || null,
					ordem: r.ordem || null,
					gateway: r.gateway || null,
					grupoAtual: r.grupoAtual || null,
					grupoAnterior: r.grupoAnterior || null,
					familia: arvore.familiaDe((eq && eq.DESC_EQUIPAMENTO) || r.descEquipamento),
					instalado: arvore.estaInstalado(r.grupoAtual),
					veiculo: arvore.veiculoDoGrupo(r.grupoAtual),
					dias: estado.dias,
					limite: estado.limite,
					mudo: estado.mudo,
					silencioTexto: silencio.descrever(estado.dias),
					confiancaBruta: r.confianca,
					amostras: r.amostrasAnalisadas || null,
					tipoDominante: r.tipoDominante || null,
					noSap: !!eq,
					ultimaAtualizacao:
						r.ultimaPosicaoAnalisada || r.updatedAt || null
				});
			});
			ativos.sort(function (a, b2) { return String(a.codigo).localeCompare(String(b2.codigo)); });
			m.setProperty("/ativos", ativos);

			/* --- conferencia contra a arvore, so dos veiculos do recorte --- */
			var veiculos = (b.veiculosUnicos || []).filter(function (v) {
				return prefixo.casa(v.local, recorte);
			});
			var rastreadosDoRecorte = (b.rastreados || []).filter(function (r) {
				var k = prefixo.chave(r.identificador);
				var eq = porEquipamento[k];
				var local = (eq && eq.LOCAL_INSTALACAO) || r.localInstalacao;
				return prefixo.casa(local, recorte);
			});
			var conferencia = arvore.compararFrota(veiculos, b.arvorePorLocal, rastreadosDoRecorte);
			m.setProperty("/conferencia", conferencia);
			m.setProperty("/porFamilia", conferencia.porFamilia);

			/* --- cercas e gateways --- */
			var cercas = zonas.preparar(b.zonas);
			var antenas = zonas.prepararGateways(b.gateways);
			m.setProperty("/zonas", cercas);
			m.setProperty("/gateways", antenas);

			/* --- divergencias de cadastro --- */
			var leiturasPorTag = {};
			(b.leituras || []).forEach(function (l) {
				var k = prefixo.chave(l.identificador);
				if (!k) { return; }
				(leiturasPorTag[k] = leiturasPorTag[k] || []).push(l);
			});
			this._leiturasPorTag = leiturasPorTag;

			var notasPorEq = agrupar(b.notas, "equipamento");
			var ordensPorEq = agrupar(b.ordens, "equipamento");
			this._notasPorEq = notasPorEq;
			this._ordensPorEq = ordensPorEq;

			var divergentes = [];
			ativos.forEach(function (a) {
				var aval = confianca.avaliar({
					leituras: leiturasPorTag[a.codigo] || [],
					localAtual: a.local,
					notas: notasPorEq[a.codigo] || [],
					ordens: ordensPorEq[a.codigo] || [],
					amostras: a.amostras,
					tipoDominante: a.tipoDominante
				});
				a.confianca = aval.nivel;
				if (aval.cadastroSuspeito) {
					divergentes.push({
						identificador: a.codigoOriginal,
						descEquipamento: a.descricao,
						localInstalacao: a.local,
						distanciaM: aval.deslocamento.distanciaM,
						gateways: aval.deslocamento.gateways
					});
				}
			});
			m.setProperty("/divergentes", divergentes);

			/* --- movimentacoes recentes --- */
			var movimentacoes = ativos.filter(function (a) {
				return a.grupoAnterior && a.grupoAtual && a.grupoAnterior !== a.grupoAtual;
			}).slice(0, 10).map(function (a) {
				return {
					codigo: a.codigoOriginal, descricao: a.descricao,
					de: a.grupoAnterior, para: a.grupoAtual,
					oficina: a.oficina, quando: a.silencioTexto
				};
			});
			m.setProperty("/movimentacoes", movimentacoes);
			var ativosHabilitados = ativos.filter(function (a) {
				return a.grupoAtual !== "Tags Digitais Não Habilitadas";
			});
			/* --- indicadores --- */
			var comunicando = ativosHabilitados.filter(function (a) {
				return !a.mudo;
			}).length;
			var resultados = indicadores.calcular({
				arvore: { comRastreador: conferencia.resumo.comRastreador, naArvore: conferencia.resumo.naArvore },
				rastreadores: { comunicando: comunicando, total: ativosHabilitados.length },
				gateways: { ativos: antenas.filter(function (g) { return g.ativo; }).length, total: antenas.length }
			});
			m.setProperty("/indicadores", resultados);
			m.setProperty("/piloto", indicadores.avancoDoPiloto(
				{
					rastreadores: ativosHabilitados.length,
					gateways: antenas.length
				},
				null
			));

			m.setProperty("/resumo", {
				rastreadores: ativosHabilitados.length,
				comunicando: comunicando,
				mudos: ativosHabilitados.length - comunicando,
				naArvore: conferencia.resumo.naArvore,
				comRastreador: conferencia.resumo.comRastreador,
				cobertura: conferencia.resumo.cobertura,
				gatewaysAtivos: antenas.filter(function (g) { return g.ativo; }).length,
				gatewaysTotal: antenas.length,
				divergentes: divergentes.length,
				efetividade: resultados.efetividade ? resultados.efetividade.valor : null
			});

			m.setProperty("/notas", b.notas || []);
			m.setProperty("/ordens", b.ordens || []);
			m.setProperty("/semanal", b.semanal || []);
			m.setProperty("/backend", b.valorGerado || null);

			this._eventos.fireEvent(EVENTO_ATUALIZADO, { prefixo: recorte });
		},

		/** Contexto para a tela de relatorios. */
		contextoRelatorios: function () {
			var m = this.modelo();
			var comTag = {};
			(m.getProperty("/ativos") || []).forEach(function (a) { comTag[a.codigo] = true; });
			return {
				conferencia: m.getProperty("/conferencia"),
				rastreados: (this._bruto && this._bruto.rastreados) || [],
				divergentes: m.getProperty("/divergentes"),
				notas: m.getProperty("/notas"),
				gateways: m.getProperty("/gateways"),
				codigosComRastreador: comTag,
				agora: Date.now()
			};
		},

		/** Ficha completa de um equipamento. */
		detalhe: function (codigo) {
			var k = prefixo.chave(codigo);
			var m = this.modelo();
			var ativo = (m.getProperty("/ativos") || []).filter(function (a) { return a.codigo === k; })[0];
			if (!ativo) { return null; }

			var leituras = (this._leiturasPorTag || {})[k] || [];
			var notas = (this._notasPorEq || {})[k] || [];
			var ordens = (this._ordensPorEq || {})[k] || [];

			var aval = confianca.avaliar({
				leituras: leituras,
				localAtual: ativo.local,
				notas: notas,
				ordens: ordens,
				amostras: ativo.amostras,
				tipoDominante: ativo.tipoDominante
			});
			var vistos = {};

			var ordenadas = leituras
				.filter(function (l) {

					if (!l.recebidoEm || l.recebidoEm === "N/A") {
						return false;
					}

					if (!l.tipoComunicacao || l.tipoComunicacao === "N/A") {
						return false;
					}

					var chave = [
						l.recebidoEm,
						l.grupo,
						l.gateway,
						l.tipoComunicacao
					].join("|");

					if (vistos[chave]) {
						return false;
					}

					vistos[chave] = true;
					return true;

				})
				.sort(function (a, b) {

					function paraTimestamp(v) {

						if (!v) {
							return 0;
						}

						var partes = String(v).match(
							/^(\d{2})\/(\d{2})(?:\/(\d{4}))?,?\s*(\d{2}):(\d{2})(?::(\d{2}))?$/
						);

						if (!partes) {
							return 0;
						}

						return new Date(
							Number(partes[3] || 2026),
							Number(partes[2]) - 1,
							Number(partes[1]),
							Number(partes[4]),
							Number(partes[5]),
							Number(partes[6] || 0)
						).getTime();
					}

					return paraTimestamp(b.recebidoEm) -
						paraTimestamp(a.recebidoEm);

				});



			var historico = ordenadas.slice(0, 18).map(function (l, i, todas) {
				var anterior = todas[i + 1];
				return {
					recebidoEm: l.recebidoEm,
					grupo: l.grupo,
					gateway: l.gateway,
					comunicacao: l.tipoComunicacao === "BT" ? "Bluetooth" : (l.tipoComunicacao === "LR" ? "LoRa" : l.tipoComunicacao),
					mudou: !!(anterior && anterior.grupo !== l.grupo)
				};
			});

			var arvoreDoVeiculo = [];
			var conf = m.getProperty("/conferencia") || { veiculos: [] };
			if (ativo.veiculo) {
				var v = (conf.veiculos || []).filter(function (x) {
					return String(x.nome || "").toUpperCase() === ativo.veiculo;
				})[0];
				if (v) { arvoreDoVeiculo = v.linhas; }
			}

			return {
				ativo: ativo,
				confianca: aval,
				historico: historico,
				notas: notas,
				ordens: ordens,
				arvore: arvoreDoVeiculo,
				posicao: confianca.posicaoMediana(leituras)
			};
		}
	};

	function agrupar(lista, campo) {
		var mapa = {};
		(lista || []).forEach(function (item) {
			var k = prefixo.chave(item[campo]);
			if (!k) { return; }
			(mapa[k] = mapa[k] || []).push(item);
		});
		return mapa;
	}

	return Frota;
});
