/**
 * Aba "Personalizados" da tela de Relatorios: biblioteca, resultado, editor
 * completo e assistente passo a passo.
 *
 * E um conjunto de metodos misturado ao controller de Relatorios (ver
 * Relatorios.controller.js), para a aba padrao continuar legivel sozinha.
 * `this` e sempre o controller.
 *
 *   - regras/relatorioPersonalizado  calcula (puro, testado)
 *   - regras/editorRelatorio         estado do editor e do assistente (puro, testado)
 *   - service/RelatoriosSalvos       grava (API_Hana /relatorios, ou navegador no modo simulado)
 *   - service/ResultadoRelatorio     desenha numero, tabela e grafico
 */
sap.ui.define([
	"sap/ui/core/Fragment",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/util/File",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/SelectDialog",
	"sap/m/StandardListItem",
	"sap/m/Dialog",
	"sap/m/Input",
	"sap/m/Label",
	"sap/m/Button",
	"sap/m/VBox",
	"../BaseController",
	"../../model/regras/relatorioPersonalizado",
	"../../model/regras/editorRelatorio",
	"../../model/regras/campos",
	"../../service/RelatoriosSalvos",
	"../../service/ResultadoRelatorio",
	"../../service/RelatorioPopup"
], function (Fragment, JSONModel, Filter, FilterOperator, File, MessageBox, MessageToast, SelectDialog,
	StandardListItem, Dialog, Input, Label, Button, VBox, BaseController, motor, editor, campos, Salvos,
	ResultadoRelatorio, RelatorioPopup) {
	"use strict";

	var PASTA = "br.com.smartpcm.rastreamento.zrastreio.view.personalizados.";

	function clonar(o) {
		return JSON.parse(JSON.stringify(o));
	}

	return {

		/* ================================================================
		 * Biblioteca e resultado
		 * ================================================================ */

		_iniciarPersonalizados: function () {
			this._pers = new JSONModel({
				lista: [], atual: null, carregando: false, local: Salvos.local(),
				erroLista: "", podeExportar: false, rodape: ""
			});
			this.getView().setModel(this._pers, "pers");
			this._persCarregado = false;
		},

		onTrocarAba: function (evento) {
			if (evento.getParameter("key") === "personalizados") { this._garantirPersonalizados(); }
		},

		_garantirPersonalizados: function () {
			if (!this._persCarregado) { this._carregarPersonalizados(); }
		},

		onRecarregarPersonalizados: function () {
			this._carregarPersonalizados();
		},

		/** Busca a biblioteca e reabre o relatorio que estava selecionado. */
		_carregarPersonalizados: function (idParaSelecionar) {
			var that = this;
			this._pers.setProperty("/carregando", true);
			this._pers.setProperty("/local", Salvos.local());
			this._pers.setProperty("/erroLista", "");
			return Salvos.listar().then(function (lista) {
				that._persCarregado = true;
				var itens = (lista || []).map(function (r) {
					r._resumo = motor.resumir(r.definicao || {});
					return r;
				});
				that._pers.setProperty("/lista", itens);
				var alvo = idParaSelecionar !== undefined ? idParaSelecionar : (that._pers.getProperty("/atual") || {}).id;
				var achado = itens.filter(function (r) { return r.id === alvo; })[0];
				if (achado) {
					that._mostrarPersonalizado(achado);
				} else {
					that._pers.setProperty("/atual", null);
				}
				that._marcarNaLista(achado ? achado.id : null);
			}).catch(function (erro) {
				that._pers.setProperty("/erroLista", "Não foi possível carregar os relatórios: " + erro.message);
			}).finally(function () {
				that._pers.setProperty("/carregando", false);
			});
		},

		_marcarNaLista: function (id) {
			var lista = this.byId("listaPersonalizados");
			if (!lista) { return; }
			lista.removeSelections(true);
			lista.getItems().forEach(function (item) {
				var ctx = item.getBindingContext("pers");
				if (ctx && ctx.getProperty("id") === id) { lista.setSelectedItem(item); }
			});
		},

		onBuscarPersonalizado: function (evento) {
			var termo = String(evento.getParameter("newValue") || "").trim();
			this.byId("listaPersonalizados").getBinding("items").filter(termo ? [new Filter({
				filters: [
					new Filter("nome", FilterOperator.Contains, termo),
					new Filter("descricao", FilterOperator.Contains, termo),
					new Filter("autor", FilterOperator.Contains, termo)
				],
				and: false
			})] : []);
		},

		onSelecionarPersonalizado: function (evento) {
			var ctx = evento.getParameter("listItem").getBindingContext("pers");
			this._mostrarPersonalizado(ctx.getObject());
		},

		/** Calcula e desenha. Chamado tambem quando a frota recarrega ou troca de prefixo. */
		_mostrarPersonalizado: function (registro) {
			if (!registro) { return; }
			var def = motor.normalizar(registro.definicao || {});
			def.nome = registro.nome;
			var r = motor.executar(def, this.dadosDaFrota());
			this._persDef = def;
			this._persResultado = r;
			this._pers.setProperty("/atual", registro);
			this._pers.setProperty("/podeExportar", !(r.erros && r.erros.length));

			var prefixo = this.frota.modelo().getProperty("/prefixo");
			var quando = registro.alteradoEm ? new Date(registro.alteradoEm).toLocaleString("pt-BR") : "";
			this._pers.setProperty("/rodape",
				"Calculado agora sobre " + (prefixo ? "o prefixo " + prefixo : "todos os prefixos") +
				(registro.autor ? " · criado por " + registro.autor : "") +
				(registro.alteradoPor && registro.alteradoPor !== registro.autor ? " · alterado por " + registro.alteradoPor : "") +
				(quando ? " em " + quando : ""));

			ResultadoRelatorio.desenhar(this.byId("resultadoPersonalizado"), def, r, this._opcoesDoResultado(def));
		},

		_recalcularPersonalizado: function () {
			var atual = this._pers && this._pers.getProperty("/atual");
			if (atual) { this._mostrarPersonalizado(atual); }
			if (this._edAberto()) { this._edPrevia(); }
			if (this._wzAberto()) { this._wzPrevia(); }
		},

		/** Clique num numero do resultado → registros por tras dele. */
		_opcoesDoResultado: function (def) {
			var that = this;
			return {
				aoDetalhar: function (alvo) {
					var lista = motor.itens(def, that.dadosDaFrota(), alvo);
					if (!lista) {
						MessageToast.show("Este valor é calculado pela fórmula — clique numa parcela para ver os registros.");
						return;
					}
					that.abrirDetalhamento(lista);
				},
				opcoesCelula: this._opcoesDoPopup()
			};
		},

		/** Ao ir para a ficha, fecha tambem o editor e o assistente. */
		abrirFicha: function (codigo) {
			if (this._edAberto()) { this._dlgEditor.close(); }
			if (this._wzAberto()) { this._dlgAssistente.close(); }
			BaseController.prototype.abrirFicha.call(this, codigo);
		},

		onExportarPersonalizado: function () {
			if (!this._persDef || !this._persResultado) { return; }
			RelatorioPopup.exportar(motor.paraExportacao(this._persDef, this._persResultado));
		},

		onEditarPersonalizado: function () {
			var reg = this._pers.getProperty("/atual");
			if (reg) { this._abrirEditor(Object.assign(clonar(reg.definicao), { nome: reg.nome }), reg); }
		},

		onDuplicarPersonalizado: function () {
			var reg = this._pers.getProperty("/atual");
			if (!reg) { return; }
			var def = clonar(reg.definicao);
			def.nome = reg.nome + " (cópia)";
			delete def.id;
			this._abrirEditor(def, null);
		},

		onExportarDefinicao: function () {
			var reg = this._pers.getProperty("/atual");
			if (!reg) { return; }
			var nome = String(reg.nome).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_");
			File.save(Salvos.paraArquivo(reg), "relatorio_" + nome, "json", "application/json", "utf-8");
		},

		onExcluirPersonalizado: function () {
			var reg = this._pers.getProperty("/atual");
			if (!reg) { return; }
			var that = this;
			MessageBox.confirm("Excluir o relatório \"" + reg.nome + "\"? Ele some para todos os usuários.", {
				title: "Excluir relatório",
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
				emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (acao) {
					if (acao !== MessageBox.Action.DELETE) { return; }
					Salvos.excluir(reg).then(function () {
						MessageToast.show("Relatório excluído.");
						that._pers.setProperty("/atual", null);
						that._carregarPersonalizados(null);
					}).catch(function (erro) {
						MessageBox.error(erro.message);
					});
				}
			});
		},

		/* ---------- criar ---------- */

		onCriar: function (evento) {
			var chave = evento.getParameter("item").getKey();
			if (chave === "assistente") { this.onAbrirAssistente(); }
			if (chave === "editor") { this._abrirEditor(motor.novo("metrica"), null); }
			if (chave === "modelo") { this.onEscolherModelo(); }
			if (chave === "importar") { this._importarDefinicao(); }
		},

		onEscolherModelo: function () {
			var that = this;
			if (!this._dlgModelos) {
				this._dlgModelos = new SelectDialog({
					title: "Começar de um modelo pronto",
					noDataText: "Nenhum modelo",
					items: {
						path: "modelos>/",
						template: new StandardListItem({
							title: "{modelos>nome}",
							description: "{modelos>descricao}",
							info: "{modelos>_tipo}",
							wrapping: true,
							icon: "{= ${modelos>tipo} === 'metrica' ? 'sap-icon://kpi-managing-my-area' : (${modelos>tipo} === 'tabela' ? 'sap-icon://pivot' : 'sap-icon://list') }"
						})
					},
					confirm: function (e) {
						var item = e.getParameter("selectedItem");
						if (!item) { return; }
						that._abrirEditor(motor.modelo(item.getBindingContext("modelos").getProperty("modelo")), null);
					},
					search: function (e) {
						var termo = e.getParameter("value");
						e.getSource().getBinding("items").filter(termo ? [new Filter("nome", FilterOperator.Contains, termo)] : []);
					}
				});
				this._dlgModelos.setModel(new JSONModel(motor.MODELOS.map(function (m) {
					return Object.assign({}, m, { _tipo: { metrica: "Métrica", tabela: "Tabela", lista: "Lista" }[m.tipo] });
				})), "modelos");
				this.getView().addDependent(this._dlgModelos);
			}
			this._dlgModelos.open();
		},

		_importarDefinicao: function () {
			var that = this;
			var entrada = document.createElement("input");
			entrada.type = "file";
			entrada.accept = ".json,application/json";
			entrada.onchange = function () {
				var arquivo = entrada.files && entrada.files[0];
				if (!arquivo) { return; }
				var leitor = new FileReader();
				leitor.onload = function () {
					try {
						that._abrirEditor(Salvos.deArquivo(String(leitor.result)), null);
					} catch (e) {
						MessageBox.error(e.message);
					}
				};
				leitor.readAsText(arquivo, "utf-8");
			};
			entrada.click();
		},

		/* ---------- gravar (editor e assistente) ---------- */

		/** Garante um nome de autor antes da primeira gravacao. */
		_pedirAutor: function () {
			var atual = Salvos.autor();
			if (atual) { return Promise.resolve(atual); }
			var that = this;
			return new Promise(function (resolver, rejeitar) {
				var campo = new Input({ placeholder: "Seu nome", width: "100%", maxLength: 100 });
				var dlg = new Dialog({
					title: "Quem está salvando?",
					contentWidth: "24rem",
					content: [new VBox({
						items: [
							new Label({ text: "O nome fica registrado como autor do relatório.", wrapping: true }),
							campo
						]
					}).addStyleClass("sapUiSmallMargin")],
					beginButton: new Button({
						text: "Continuar", type: "Emphasized",
						press: function () {
							var nome = String(campo.getValue() || "").trim();
							if (!nome) { campo.setValueState("Error"); return; }
							Salvos.lembrarAutor(nome);
							dlg.close();
							resolver(nome);
						}
					}),
					endButton: new Button({ text: "Cancelar", press: function () { dlg.close(); rejeitar(new Error("cancelado")); } }),
					afterClose: function () { dlg.destroy(); }
				});
				that.getView().addDependent(dlg);
				dlg.open();
			});
		},

		_salvarDefinicao: function (def, registro) {
			var erros = motor.validar(def);
			if (erros.length) {
				MessageBox.warning("Antes de salvar, ajuste:\n\n• " + erros.join("\n• "), { title: "Relatório incompleto" });
				return Promise.reject(new Error("invalido"));
			}
			var that = this;
			return this._pedirAutor().then(function () {
				return Salvos.salvar(def, registro);
			}).then(function (salvo) {
				MessageToast.show(Salvos.local() ? "Relatório salvo neste navegador." : "Relatório salvo.");
				that.byId("abasRelatorios").setSelectedKey("personalizados");
				that._tela.setProperty("/aba", "personalizados");
				return that._carregarPersonalizados(salvo.id).then(function () { return salvo; });
			}).catch(function (erro) {
				if (erro.message === "cancelado") { throw erro; }
				if (erro.status === 409) {
					MessageBox.warning(erro.message + "\n\nA lista foi recarregada. Abra o relatório de novo para ver a versão atual antes de alterar.",
						{ title: "Alteração simultânea" });
					that._carregarPersonalizados();
				} else {
					MessageBox.error(erro.message, { title: "Não foi possível salvar" });
				}
				throw erro;
			});
		},

		/* ================================================================
		 * Editor completo
		 * ================================================================ */

		_modelosComuns: function (dialogo) {
			dialogo.setModel(new JSONModel(campos.listaFontes()), "fontes");
			dialogo.setModel(new JSONModel({ formatos: editor.FORMATOS, graficos: editor.GRAFICOS }), "opcoes");
		},

		_edAberto: function () {
			return !!(this._dlgEditor && this._dlgEditor.isOpen());
		},

		_abrirEditor: function (def, registro) {
			var that = this;
			var estado = editor.paraEditor(def);
			estado._titulo = registro ? "Editar relatório" : "Novo relatório";
			var prefixo = this.frota.modelo().getProperty("/prefixo");
			estado._recorte = prefixo ? "Recorte: " + prefixo : "Recorte: todos os prefixos";
			this._edRegistro = registro || null;
			this._edModelo = new JSONModel(estado);
			this._edModelo.setSizeLimit(1000);

			var pronto = this._dlgEditor ? Promise.resolve(this._dlgEditor) : Fragment.load({
				id: this.getView().getId(),
				name: PASTA + "Editor",
				controller: this
			}).then(function (dlg) {
				that._dlgEditor = dlg;
				that.getView().addDependent(dlg);
				that._modelosComuns(dlg);
				return dlg;
			});

			return pronto.then(function (dlg) {
				dlg.setModel(that._edModelo, "ed");
				dlg.open();
				that._edPrevia();
			});
		},

		/** Modelo "ed" de quem disparou: editor ou assistente. */
		_estadoDe: function (controle) {
			var modelo = controle && controle.getModel("ed");
			return { modelo: modelo, assistente: !!(modelo && modelo === this._wzModelo) };
		},

		_reatualizar: function (alvo) {
			var d = alvo.modelo.getData();
			if (alvo.assistente) {
				editor.atualizarAssistente(d);
				alvo.modelo.refresh(true);
				this._wzValidar();
				this._agendarPrevia(true);
			} else {
				editor.atualizar(d);
				alvo.modelo.refresh(true);
				this._agendarPrevia(false);
			}
		},

		/** Mudanca de estrutura (fonte, campo, operador, calculo, tipo...). */
		onEdEstrutura: function (evento) {
			var that = this;
			var alvo = this._estadoDe(evento.getSource());
			if (!alvo.modelo) { return; }
			// deixa o binding two-way gravar a selecao antes de recalcular as listas
			setTimeout(function () { that._reatualizar(alvo); }, 0);
		},

		/** Mudanca de valor (texto, numero): so recalcula a pre-visualizacao. */
		onEdMudou: function (evento) {
			var alvo = this._estadoDe(evento.getSource());
			if (alvo.assistente) {
				this._wzValidar();
			}
			this._agendarPrevia(alvo.assistente);
		},

		_agendarPrevia: function (assistente) {
			var that = this;
			clearTimeout(this._timerPrevia);
			this._timerPrevia = setTimeout(function () {
				if (assistente) { that._wzPrevia(); } else { that._edPrevia(); }
			}, 250);
		},

		onEdAdicionar: function (evento) {
			var fonte = evento.getSource();
			var alvo = this._estadoDe(fonte);

			if (!alvo.modelo) {
				return;
			}

			var lista = fonte.data("lista");
			var item = fonte.data("item");
			var ctx = fonte.getBindingContext("ed");

			if (!lista || !item) {
				return;
			}

			var caminho = lista.indexOf("/") === 0
				? lista
				: (ctx ? ctx.getPath() : "") + "/" + lista;

			var d = alvo.modelo.getData();
			var arr = alvo.modelo.getProperty(caminho);

			if (!Array.isArray(arr)) {
				arr = [];
			}

			var fonteDados =
				(ctx && lista.indexOf("/") !== 0)
					? (ctx.getObject().fonte || d.fonte)
					: d.fonte;

			switch (item) {
				case "filtro":
					arr.push(editor.novoFiltro(fonteDados));
					break;

				case "dimensao":
					arr.push(editor.novaDimensao(d.fonte));
					break;

				case "valor":
					arr.push(editor.novoValor(d.fonte));
					break;

				case "parcela":
					var ultima = arr[arr.length - 1];

					arr.push(
						editor.novaParcela(
							arr.length + 1,
							ultima ? ultima.fonte : "rastreadores"
						)
					);
					break;
			}

			alvo.modelo.setProperty(caminho, arr);
			this._reatualizar(alvo);
		},

		/** Remove o item da lista a que o botao pertence (filtro, parcela, nivel, valor). */
		onEdRemoverItem: function (evento) {
			var fonte = evento.getSource();
			var alvo = this._estadoDe(fonte);
			var ctx = fonte.getBindingContext("ed");
			if (!alvo.modelo || !ctx) { return; }
			var caminho = ctx.getPath();
			var partes = caminho.split("/");
			var indice = Number(partes.pop());
			var pai = partes.join("/");
			var arr = alvo.modelo.getProperty(pai);
			if (!Array.isArray(arr) || isNaN(indice)) { return; }
			if (pai === "/parcelas" && arr.length === 1) {
				MessageToast.show("A métrica precisa de pelo menos uma parcela.");
				return;
			}
			arr.splice(indice, 1);
			alvo.modelo.setProperty(pai, arr);
			this._reatualizar(alvo);
		},

		onEdFormulaPronta: function (evento) {
			this._edModelo.setProperty("/formula", evento.getSource().data("formula"));
			this._edPrevia();
		},

		_edPrevia: function () {
			if (!this._edModelo || !this.byId("previaEditor")) { return; }
			var def = editor.paraDefinicao(this._edModelo.getData());
			var r = motor.executar(def, this.dadosDaFrota());
			ResultadoRelatorio.desenhar(this.byId("previaEditor"), def, r,
				Object.assign(this._opcoesDoResultado(def), { compacto: true }));
		},

		onEdSalvar: function () {
			var that = this;
			var def = editor.paraDefinicao(this._edModelo.getData());
			this._edModelo.setProperty("/_salvando", true);
			this._salvarDefinicao(def, this._edRegistro).then(function () {
				that._dlgEditor.close();
			}).catch(function () { /* mensagem ja exibida */ }).finally(function () {
				that._edModelo.setProperty("/_salvando", false);
			});
		},

		onEdCancelar: function () {
			this._dlgEditor.close();
		},

		onEdFechou: function () {
			clearTimeout(this._timerPrevia);
		},

		/* ================================================================
		 * Assistente passo a passo
		 * ================================================================ */

		_wzAberto: function () {
			return !!(this._dlgAssistente && this._dlgAssistente.isOpen());
		},

		onAbrirAssistente: function () {
			var that = this;
			this._wzModelo = new JSONModel(editor.novoAssistente());
			this._wzModelo.setSizeLimit(1000);

			var pronto = this._dlgAssistente ? Promise.resolve(this._dlgAssistente) : Fragment.load({
				id: this.getView().getId(),
				name: PASTA + "Assistente",
				controller: this
			}).then(function (dlg) {
				that._dlgAssistente = dlg;
				that.getView().addDependent(dlg);
				that._modelosComuns(dlg);
				return dlg;
			});

			return pronto.then(function (dlg) {
				dlg.setModel(that._wzModelo, "ed");
				var wizard = that.byId("wizardRelatorio");
				wizard.discardProgress(that.byId("wzPassoTipo"), false);
				that._wzValidar();
				dlg.open();
			});
		},

		onWzTipo: function (evento) {
			var tipos = ["metrica", "tabela", "lista"];
			this._wzModelo.setProperty("/tipo", tipos[evento.getParameter("selectedIndex")] || "metrica");
			this._wzModelo.setProperty("/grafico", this._wzModelo.getProperty("/tipo") === "tabela" ? "barras" : "nenhum");
			this._reatualizar({ modelo: this._wzModelo, assistente: true });
		},

		onWzModoMetrica: function (evento) {
			this._wzModelo.setProperty("/modoMetrica", evento.getParameter("selectedIndex") === 1 ? "valor" : "proporcao");
			this._reatualizar({ modelo: this._wzModelo, assistente: true });
		},

		onWzMudou: function (evento) {
			var fonte = evento.getSource();
			// Select de fonte muda a estrutura; o resto e so valor
			if (fonte.isA && fonte.isA("sap.m.Select")) {
				this.onEdEstrutura(evento);
				return;
			}
			this._wzValidar();
			this._agendarPrevia(true);
		},

		/** Libera o "proximo" do passo de calculo so quando ele esta completo. */
		_wzValidar: function () {
			var w = this._wzModelo.getData();
			var falta = editor.faltaNoPasso(w, "calculo");
			this._wzModelo.setProperty("/_falta", falta);
			this._wzModelo.setProperty("/_nomeSugerido", editor.sugerirNome(w));
			var wizard = this.byId("wizardRelatorio");
			var passo = this.byId("wzPassoCalculo");
			if (!wizard || !passo) { return; }
			if (falta) { wizard.invalidateStep(passo); } else { wizard.validateStep(passo); }
		},

		_wzPrevia: function () {
			if (!this._wzModelo || !this.byId("previaAssistente")) { return; }
			var def = editor.doAssistente(this._wzModelo.getData());
			var r = motor.executar(def, this.dadosDaFrota());
			ResultadoRelatorio.desenhar(this.byId("previaAssistente"), def, r,
				Object.assign(this._opcoesDoResultado(def), { compacto: true }));
		},

		/** Chegou ao ultimo passo: sugere o nome e mostra a pre-visualizacao. */
		onWzPassoNome: function () {
			if (!this._wzModelo.getProperty("/nome")) {
				this._wzModelo.setProperty("/nome", editor.sugerirNome(this._wzModelo.getData()));
			}
			this._wzPrevia();
		},

		onWzConcluir: function () {
			var that = this;
			var def = editor.doAssistente(this._wzModelo.getData());
			this._salvarDefinicao(def, null).then(function () {
				that._dlgAssistente.close();
			}).catch(function () { /* mensagem ja exibida */ });
		},

		onWzParaEditor: function () {
			var def = editor.doAssistente(this._wzModelo.getData());
			this._dlgAssistente.close();
			this._abrirEditor(def, null);
		},

		onWzCancelar: function () {
			this._dlgAssistente.close();
		},

		onWzFechou: function () {
			clearTimeout(this._timerPrevia);
		}
	};
});
