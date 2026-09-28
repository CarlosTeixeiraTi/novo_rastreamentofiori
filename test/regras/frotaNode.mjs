/**
 * Roda o model/Frota.js DE VERDADE no Node, sobre as fixtures de
 * localService/mock, e devolve o snapshot do modelo "frota" — exatamente o
 * que as telas e os relatorios personalizados leem.
 *
 * Os unicos substitutos sao o JSONModel (um objeto com get/setProperty), o
 * EventProvider e o Backend (que le os arquivos .json direto do disco).
 */
import { readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import vm from "vm";

const RAIZ_MOCK = "webapp/localService/mock/";

class JSONModel {
	constructor(dados) { this._d = dados || {}; }
	setSizeLimit() {}
	getData() { return this._d; }
	getProperty(caminho) {
		return String(caminho).split("/").filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), this._d);
	}
	setProperty(caminho, valor) {
		const partes = String(caminho).split("/").filter(Boolean);
		let o = this._d;
		partes.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; });
		o[partes[partes.length - 1]] = valor;
	}
}

class EventProvider {
	constructor() { this._h = {}; }
	attachEvent(n, fn, ctx) { (this._h[n] = this._h[n] || []).push([fn, ctx]); }
	detachEvent(n, fn) { this._h[n] = (this._h[n] || []).filter((x) => x[0] !== fn); }
	fireEvent(n, p) { (this._h[n] || []).forEach(([fn, ctx]) => fn.call(ctx, { getParameters: () => p })); }
}

const ler = (nome) => {
	const arq = RAIZ_MOCK + nome + ".json";
	return existsSync(arq) ? JSON.parse(readFileSync(arq, "utf8")) : [];
};

const Backend = {
	estaSimulado: () => true,
	equipamentos: async () => ler("Equipamentos"),
	localizacaoAtual: async () => ler("LocalizacaoAtual"),
	veiculos: async () => ler("Veiculo"),
	zonas: async () => ler("Zonas"),
	gateways: async () => ler("Gateway"),
	notas: async () => ler("NotasReforma"),
	ordens: async () => ler("OrdensRastreio"),
	rastreio: async () => ler("Rastreio-dados"),
	valorGerado: async () => ler("ValorGerado"),
	valorGeradoSemanal: async () => ler("ValorGeradoSemanal"),
	arvoreDoLocal: async (local) => {
		const d = ler("equipamentos-local");
		return d[local] !== undefined ? d[local] : d;
	}
};

const EXTERNOS = {
	"sap/ui/model/json/JSONModel": JSONModel,
	"sap/ui/base/EventProvider": EventProvider
};

const cache = new Map();
function carregar(caminho) {
	const abs = resolve(caminho);
	if (cache.has(abs)) { return cache.get(abs); }
	let exportado = null;
	const ctx = {
		console, Intl, Date, Math, JSON, Number, String, Object, Array, Promise, isFinite, isNaN, setTimeout,
		sap: {
			ui: {
				define: (deps, fabrica) => {
					const lista = Array.isArray(deps) ? deps : [];
					const f = typeof deps === "function" ? deps : fabrica;
					exportado = f.apply(null, lista.map((d) => {
						if (EXTERNOS[d]) { return EXTERNOS[d]; }
						if (d.endsWith("service/Backend")) { return Backend; }
						return carregar(resolve(dirname(abs), d + ".js"));
					}));
				}
			}
		}
	};
	ctx.globalThis = ctx;
	vm.createContext(ctx);
	vm.runInContext(readFileSync(abs, "utf8"), ctx, { filename: abs });
	cache.set(abs, exportado);
	return exportado;
}

/** Snapshot do modelo "frota" apos a carga, com o recorte de prefixo pedido. */
export async function snapshotDaFrota(prefixo) {
	const Frota = carregar("webapp/model/Frota.js");
	await Frota.carregar();
	if (prefixo) { Frota.definirPrefixo(prefixo); }
	// copia profunda: o teste nao deve enxergar mutacoes posteriores
	return JSON.parse(JSON.stringify(Frota.modelo().getData()));
}
