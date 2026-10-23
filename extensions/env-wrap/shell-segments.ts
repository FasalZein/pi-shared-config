// Command parser that env-wrap uses. Extracted from the live shell-guard.ts by
// scripts/sync-from-live.sh; do not edit here.

/** dynamic: the word holds a command substitution (its text shows "_" there). */
type Word = { text: string; start: number; end: number; dynamic?: boolean };
/** depth: subshell nesting, for cd tracking. stdin: input comes from a pipe or a `<` redirect. */
type Segment = { words: Word[]; source: string; depth: number; stdin: boolean };

const SHELLS = new Set(["sh", "bash", "zsh", "dash"]);
const KEYWORDS = new Set(["if", "then", "else", "elif", "do", "while", "until", "!", "{", "}"]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** Split a command string into simple commands (word lists), like a shell. */
export function parseSegments(source: string, baseDepth = 0): Segment[] {
	const segments: Segment[] = [];
	let words: Word[] = [];
	let word: Word | undefined;
	const pendingHeredocs: { tag: string; strip: boolean }[] = [];
	let depth = baseDepth;
	let stdin = false;
	const add = (ch: string, at: number) => {
		if (!word) word = { text: "", start: at, end: at };
		word.text += ch;
		word.end = at + 1;
	};
	const endWord = () => {
		if (word) words.push(word);
		word = undefined;
	};
	const endSegment = () => {
		endWord();
		if (words.length) {
			segments.push({ words, source, depth, stdin });
			stdin = false;
		}
		words = [];
	};
	// Returns the index of the matching close of a `$(` that opens at i.
	const closeParen = (i: number) => {
		let depth = 1;
		let quote = "";
		for (let j = i; j < source.length; j++) {
			const c = source[j];
			if (quote) {
				if (c === "\\" && quote === '"') j++;
				else if (c === quote) quote = "";
			} else if (c === "'" || c === '"') quote = c;
			else if (c === "\\") j++;
			else if (c === "(") depth++;
			else if (c === ")" && --depth === 0) return j;
		}
		return source.length;
	};
	const substitution = (i: number) => {
		// `$(...)` or backticks: parse the body as its own command list.
		if (source[i] === "`") {
			const close = source.indexOf("`", i + 1);
			const end = close < 0 ? source.length : close;
			segments.push(...parseSegments(source.slice(i + 1, end), depth + 1));
			add("_", i);
			word!.dynamic = true;
			return end;
		}
		const end = closeParen(i + 2);
		segments.push(...parseSegments(source.slice(i + 2, end), depth + 1));
		add("_", i);
		word!.dynamic = true;
		return end;
	};

	for (let i = 0; i < source.length; i++) {
		const c = source[i];
		if (c === "\\") {
			if (source[i + 1] !== "\n") add(source[i + 1] ?? "", i);
			i++;
		} else if (c === "'") {
			const close = source.indexOf("'", i + 1);
			const end = close < 0 ? source.length : close;
			add("", i);
			word!.text += source.slice(i + 1, end);
			word!.end = end + 1;
			i = end;
		} else if (c === '"') {
			add("", i);
			let j = i + 1;
			for (; j < source.length && source[j] !== '"'; j++) {
				if (source[j] === "\\") add(source[++j] ?? "", j);
				else if (source[j] === "`" || (source[j] === "$" && source[j + 1] === "(")) j = substitution(j);
				else add(source[j], j);
			}
			word!.end = j + 1;
			i = j;
		} else if (c === "`" || (c === "$" && source[i + 1] === "(")) {
			i = substitution(i);
		} else if (c === "#" && !word) {
			while (i + 1 < source.length && source[i + 1] !== "\n") i++;
		} else if (c === "<" && source[i + 1] === "<" && source[i + 2] !== "<") {
			// Heredoc: remember the tag; its body starts after the next newline.
			endWord();
			stdin = true;
			let j = i + 2;
			const strip = source[j] === "-";
			if (strip) j++;
			while (source[j] === " " || source[j] === "\t") j++;
			const tagMatch = /^(['"]?)([^\s'";&|<>()]+)\1/.exec(source.slice(j));
			if (tagMatch) {
				pendingHeredocs.push({ tag: tagMatch[2], strip });
				j += tagMatch[0].length;
			}
			i = j - 1;
		} else if (c === ">" || c === "<") {
			// Redirection: drop the operator, a leading fd number, and the target.
			if (word && /^\d+$/.test(word.text)) word = undefined;
			endWord();
			if (c === "<") stdin = true;
			let j = i + 1;
			if (source[j] === ">" || source[j] === "&" || source[j] === "|") j++;
			while (source[j] === " " || source[j] === "\t") j++;
			while (j < source.length && !/[\s;&|()<>]/.test(source[j])) j++;
			i = j - 1;
		} else if (c === "&" && source[i + 1] === ">") {
			endWord();
			let j = i + 2;
			if (source[j] === ">") j++;
			while (source[j] === " " || source[j] === "\t") j++;
			while (j < source.length && !/[\s;&|()<>]/.test(source[j])) j++;
			i = j - 1;
		} else if (c === "\n") {
			endSegment();
			for (const { tag, strip } of pendingHeredocs.splice(0)) {
				// Skip body lines up to the line that holds only the tag.
				while (i < source.length) {
					const next = source.indexOf("\n", i + 1);
					const lineEnd = next < 0 ? source.length : next;
					const line = source.slice(i + 1, lineEnd);
					i = lineEnd;
					if ((strip ? line.replace(/^\t+/, "") : line).trim() === tag) break;
				}
			}
		} else if (";&|()".includes(c)) {
			endSegment();
			if (c === "|") {
				// `||` is a list operator; `|` and `|&` feed the next command.
				if (source[i + 1] === "|") i++;
				else {
					stdin = true;
					if (source[i + 1] === "&") i++;
				}
			}
			if (c === "(") depth++;
			else if (c === ")") depth = Math.max(baseDepth, depth - 1);
		} else if (c === " " || c === "\t") {
			endWord();
		} else {
			add(c, i);
		}
	}
	endSegment();
	return segments;
}
