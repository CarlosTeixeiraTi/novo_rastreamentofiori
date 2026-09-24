/**
 * Verificacao estatica: XML valido, controller de cada view existente,
 * chave de i18n usada e declarada, e modulo referenciado no sap.ui.define
 * resolvendo para um arquivo real.
 *
 * Existe porque nao ha como rodar `ui5 serve` neste ambiente: e a rede de
 * seguranca possivel antes de subir de verdade.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { XMLValidator } from "./xml.mjs";

let erros = 0;
const falha = (m) => { erros++; console.log("  ERRO:", m); };

const views = readdirSync("webapp/view").filter((f) => f.endsWith(".view.xml"));
const controllers = readdirSync("webapp/controller");
const i18n = readFileSync("webapp/i18n/i18n.properties", "utf8");
const chavesI18n = new Set(i18n.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => l.split("=")[0].trim()));

const NOVAS = ["App", "SalaDeControle", "Mapa", "Catalogo", "Equipamento", "Embarcados", "Indicadores", "Manutencao", "Relatorios"];

for (const arquivo of views) {
	const xml = readFileSync("webapp/view/" + arquivo, "utf8");
	const v = XMLValidator.validate(xml);
	if (v !== true) { falha(`${arquivo}: XML inválido — ${v.err.msg} (linha ${v.err.line})`); continue; }

	const nome = arquivo.replace(".view.xml", "");
	if (!NOVAS.includes(nome)) { continue; }

	const m = xml.match(/controllerName="([^"]+)"/);
	if (!m) { falha(`${arquivo}: sem controllerName`); continue; }
	const ctrl = m[1].split(".").pop() + ".controller.js";
	if (!controllers.includes(ctrl)) { falha(`${arquivo}: controller ${ctrl} não existe`); }

	for (const [, chave] of xml.matchAll(/\{i18n>([\w.]+)\}/g)) {
		if (!chavesI18n.has(chave)) { falha(`${arquivo}: chave i18n ausente — ${chave}`); }
	}
}

// modulos referenciados existem
const js = [];
const varrer = (dir) => readdirSync(dir, { withFileTypes: true }).forEach((e) => {
	const p = dir + "/" + e.name;
	if (e.isDirectory()) { varrer(p); } else if (e.name.endsWith(".js")) { js.push(p); }
});
["webapp/controller", "webapp/model", "webapp/service"].forEach(varrer);

for (const arquivo of js) {
	const conteudo = readFileSync(arquivo, "utf8");
	try { new Function(conteudo); } catch (e) { falha(`${arquivo}: sintaxe — ${e.message}`); continue; }

	const def = conteudo.match(/sap\.ui\.define\(\s*\[([\s\S]*?)\]/);
	if (!def) { continue; }
	for (const [, dep] of def[1].matchAll(/"([^"]+)"/g)) {
		if (!dep.startsWith(".")) { continue; }
		const base = arquivo.split("/").slice(0, -1).join("/");
		const alvo = new URL(dep + ".js", "file:///" + base + "/").pathname.replace(/^\//, "");
		if (!existsSync(alvo)) { falha(`${arquivo}: dependência não resolve — ${dep}`); }
	}
}

// manifest: toda view alvo existe
const manifest = JSON.parse(readFileSync("webapp/manifest.json", "utf8"));
for (const [nome, alvo] of Object.entries(manifest["sap.ui5"].routing.targets)) {
	if (!alvo.viewName) { continue; }
	const caminho = "webapp/view/" + alvo.viewName.split(".").pop() + ".view.xml";
	if (!existsSync(caminho)) { falha(`manifest: alvo ${nome} aponta para ${caminho}, que não existe`); }
}

// mock: todo arquivo que o Backend pede existe
const backend = readFileSync("webapp/service/Backend.js", "utf8");
for (const [, nome] of backend.matchAll(/obter\("[^"]+",\s*"([^"]+)"\)/g)) {
	if (!existsSync("webapp/localService/mock/" + nome + ".json")) {
		falha(`mock ausente: ${nome}.json`);
	}
}

console.log(`\nvalidação: ${views.length} views, ${js.length} módulos, ${chavesI18n.size} chaves i18n · ${erros} erro(s)`);
process.exit(erros ? 1 : 0);
