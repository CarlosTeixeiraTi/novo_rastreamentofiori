/**
 * Carrega um modulo UI5 (sap.ui.define) dentro do Node, para os testes das
 * regras puras rodarem sem navegador e sem dependencia nenhuma.
 */
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import vm from "vm";

const cache = new Map();

export function carregar(caminho) {
	const absoluto = resolve(caminho);
	if (cache.has(absoluto)) { return cache.get(absoluto); }

	let exportado = null;
	const contexto = {
		console,
		Intl,
		Date,
		Math,
		JSON,
		Number,
		String,
		Object,
		Array,
		isFinite,
		isNaN,
		sap: {
			ui: {
				define: function (deps, fabrica) {
					const f = typeof deps === "function" ? deps : fabrica;
					const lista = Array.isArray(deps) ? deps : [];
					const resolvidas = lista.map((d) => carregar(resolve(dirname(absoluto), d + ".js")));
					exportado = f.apply(null, resolvidas);
				}
			}
		}
	};
	contexto.globalThis = contexto;
	vm.createContext(contexto);
	vm.runInContext(readFileSync(absoluto, "utf8"), contexto, { filename: absoluto });

	cache.set(absoluto, exportado);
	return exportado;
}
