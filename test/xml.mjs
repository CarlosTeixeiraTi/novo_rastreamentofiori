/**
 * Validador XML minimo, consciente de aspas.
 *
 * A primeira versao usava regex com [^>]* e reprovava ate as views
 * originais do projeto: no UI5 o caractere `>` aparece DENTRO de atributo
 * o tempo todo — `{i18n>chave}`, `{= ${x} > 0 }`. Scanner com estado
 * resolve; regex nao resolve.
 */
export const XMLValidator = {
	validate(xml) {
		const pilha = [];
		let i = 0, linha = 1;

		const contar = (ate) => {
			for (let k = i; k < ate; k++) { if (xml[k] === "\n") { linha++; } }
		};

		while (i < xml.length) {
			const abre = xml.indexOf("<", i);
			if (abre < 0) { break; }
			contar(abre);
			i = abre;

			if (xml.startsWith("<!--", i)) {
				const fim = xml.indexOf("-->", i);
				if (fim < 0) { return { err: { msg: "comentário não fechado", line: linha } }; }
				contar(fim); i = fim + 3; continue;
			}
			if (xml.startsWith("<?", i) || xml.startsWith("<!", i)) {
				const fim = xml.indexOf(">", i);
				if (fim < 0) { return { err: { msg: "declaração não fechada", line: linha } }; }
				contar(fim); i = fim + 1; continue;
			}

			// percorre a tag respeitando aspas
			let j = i + 1, aspa = null, fim = -1;
			while (j < xml.length) {
				const c = xml[j];
				if (aspa) {
					if (c === aspa) { aspa = null; }
				} else if (c === '"' || c === "'") {
					aspa = c;
				} else if (c === ">") {
					fim = j; break;
				}
				j++;
			}
			if (fim < 0) { return { err: { msg: "tag não fechada com >", line: linha } }; }

			const conteudo = xml.slice(i + 1, fim);
			const fechamento = conteudo.startsWith("/");
			const sozinha = conteudo.endsWith("/");
			const nome = conteudo.replace(/^\//, "").trim().split(/[\s/>]/)[0];

			if (fechamento) {
				const topo = pilha.pop();
				if (topo !== nome) {
					return { err: { msg: `</${nome}> fecha <${topo || "nada"}>`, line: linha } };
				}
			} else if (!sozinha) {
				pilha.push(nome);
			}

			contar(fim); i = fim + 1;
		}

		if (pilha.length) {
			return { err: { msg: `tag não fechada: <${pilha[pilha.length - 1]}>`, line: linha } };
		}
		return true;
	}
};
