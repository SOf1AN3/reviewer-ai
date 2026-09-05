const MATH_SYMBOLS: Record<string, string> = {
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
  "\\epsilon": "ε", "\\zeta": "ζ", "\\eta": "η", "\\theta": "θ",
  "\\iota": "ι", "\\kappa": "κ", "\\lambda": "λ", "\\mu": "μ",
  "\\nu": "ν", "\\xi": "ξ", "\\pi": "π", "\\rho": "ρ",
  "\\sigma": "σ", "\\tau": "τ", "\\upsilon": "υ", "\\phi": "φ",
  "\\chi": "χ", "\\psi": "ψ", "\\omega": "ω",
  "\\Gamma": "Γ", "\\Delta": "Δ", "\\Theta": "Θ", "\\Lambda": "Λ",
  "\\Xi": "Ξ", "\\Pi": "Π", "\\Sigma": "Σ", "\\Phi": "Φ",
  "\\Psi": "Ψ", "\\Omega": "Ω",
  "\\leq": "≤", "\\geq": "≥", "\\neq": "≠", "\\approx": "≈",
  "\\sim": "∼", "\\simeq": "≃", "\\cong": "≅", "\\equiv": "≡",
  "\\times": "×", "\\div": "÷", "\\pm": "±", "\\mp": "∓",
  "\\cdot": "·", "\\circ": "∘", "\\bullet": "•",
  "\\leftarrow": "←", "\\rightarrow": "→", "\\leftrightarrow": "↔",
  "\\Leftarrow": "⇐", "\\Rightarrow": "⇒", "\\Leftrightarrow": "⇔",
  "\\sum": "∑", "\\prod": "∏", "\\int": "∫", "\\oint": "∮",
  "\\infty": "∞", "\\partial": "∂", "\\nabla": "∇",
  "\\forall": "∀", "\\exists": "∃", "\\nexists": "∄",
  "\\in": "∈", "\\notin": "∉", "\\subset": "⊂", "\\supset": "⊃",
  "\\subseteq": "⊆", "\\supseteq": "⊇", "\\cup": "∪", "\\cap": "∩",
  "\\emptyset": "∅", "\\varnothing": "∅",
  "\\sqrt": "√", "\\log": "log", "\\ln": "ln",
  "\\sin": "sin", "\\cos": "cos", "\\tan": "tan",
  "\\lim": "lim", "\\max": "max", "\\min": "min",
  "\\mathbb{R}": "ℝ", "\\mathbb{N}": "ℕ", "\\mathbb{Z}": "ℤ",
  "\\mathbb{Q}": "ℚ", "\\mathbb{C}": "ℂ",
  "\\mathbb{H}": "ℍ",
  "\\langle": "⟨", "\\rangle": "⟩",
  "\\lfloor": "⌊", "\\rfloor": "⌋",
  "\\lceil": "⌈", "\\rceil": "⌉",
  "\\ldots": "…", "\\cdots": "⋯", "\\vdots": "⋮", "\\ddots": "⋱",
  "\\prime": "′", "\\dagger": "†", "\\ddagger": "‡",
  "\\star": "⋆", "\\ast": "∗",
  "\\le": "≤", "\\ge": "≥", "\\ne": "≠",
  "\\to": "→", "\\gets": "←",
  "\\mapsto": "↦", "\\hookrightarrow": "↪", "\\hookleftarrow": "↤",
  "\\longrightarrow": "longrightarrow", "\\longleftarrow": "longleftarrow",
  "\\quad": "  ", "\\qquad": "    ",
  "\\,": " ", "\\;": " ", "\\!": "",
  "\\hspace{1em}": " ", "\\hspace{2em}": "  ",
  "\\text{": "", "\\textrm{": "", "\\textit{": "", "\\textbf{": "",
  "\\mathrm{": "", "\\mathit{": "", "\\mathbf{": "",
};

const MATH_ENVIRONMENTS = new Set([
  "equation", "equation*", "align", "align*", "aligned",
  "gather", "gather*", "multline", "multline*",
  "eqnarray", "eqnarray*",
  "split", "subequations",
  "math", "displaymath",
]);

const TABLE_ENVIRONMENTS = new Set([
  "tabular", "tabular*", "array", "matrix",
  "pmatrix", "bmatrix", "vmatrix", "Vmatrix",
  "cases", "dcases", "rcases",
]);

const REMOVE_ENVIRONMENTS = new Set([
  "figure", "figure*",
  "thebibliography",
]);

const KEEP_ENVIRONMENTS = new Set([
  "itemize", "enumerate", "description",
  "abstract", "proof", "lemma", "theorem", "corollary",
  "definition", "example", "remark", "note",
  "table", "table*",
]);

function removeComments(text: string): string {
  return text.replace(/(?<!\\)%[^\n]*/g, "");
}

function removeDocumentStructure(text: string): string {
  const commands = [
    "documentclass", "usepackage", "input", "include",
    "bibliographystyle", "bibliography",
    "maketitle", "tableofcontents",
    "begin{document}", "end{document}",
  ];
  let result = text;
  for (const cmd of commands) {
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\\\${escaped}(?:\\[[^\\]]*\\])?(?:\\{[^}]*\\})?`, "g");
    result = result.replace(re, "");
  }
  return result;
}

function removeNewCommands(text: string): string {
  let result = text;
  result = result.replace(/\\newcommand\s*\{[^}]*\}\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, "");
  result = result.replace(/\\renewcommand\s*\{[^}]*\}\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, "");
  result = result.replace(/\\DeclareMathOperator\s*\{[^}]*\}\s*\{[^}]*\}/g, "");
  return result;
}

function convertMathSymbols(text: string): string {
  let result = text;
  for (const [cmd, symbol] of Object.entries(MATH_SYMBOLS)) {
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}\\s*\\*?`, "g");
    result = result.replace(re, symbol);
  }
  return result;
}

function convertMathFractions(text: string): string {
  let result = text;
  let prev = "";
  let iterations = 0;
  while (result !== prev && iterations < 20) {
    prev = result;
    result = result.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
    iterations++;
  }
  return result;
}

function convertMathFunctions(text: string): string {
  const funcs = [
    "arcsin", "arccos", "arctan",
    "sinh", "cosh", "tanh",
    "sin", "cos", "tan", "cot", "sec", "csc",
    "log", "ln", "exp",
    "lim", "limsup", "liminf",
    "max", "min", "sup", "inf", "dim", "ker",
    "det", "Tr", "arg",
  ];
  let result = text;
  for (const fn of funcs) {
    const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\\\${escaped}\\s*\\*?`, "g");
    result = result.replace(re, fn + " ");
  }
  return result;
}

function cleanMathContent(content: string): string {
  let result = content;
  result = result.replace(/\\nonumber/g, "");
  result = result.replace(/\\notag/g, "");
  result = result.replace(/\\label\{[^}]*\}/g, "");
  result = result.replace(/\\tag\{[^}]*\}/g, "");
  result = result.replace(/\\(?:left|right)\s*([(){}[\]|.!?])/g, "$1");
  result = result.replace(/\\(?:left|right)/g, "");
  result = convertMathFractions(result);
  result = convertMathFunctions(result);
  result = convertMathSymbols(result);
  result = result.replace(/\^\\{([^{}]*)\}/g, "^$1");
  result = result.replace(/_\\{([^{}]*)\}/g, "_$1");
  result = result.replace(/\^(\w)/g, "^$1");
  result = result.replace(/_(\w)/g, "_$1");
  result = result.replace(/\\\\/g, " ");
  result = result.replace(/\\,/g, " ");
  result = result.replace(/\\;/g, " ");
  result = result.replace(/\\!/g, "");
  result = result.replace(/\{([^{}]*)\}/g, "$1");
  return result.trim();
}

function cleanTableContent(content: string): string {
  let result = content;
  result = result.replace(/\\hline/g, "");
  result = result.replace(/\\cline\{[^}]*\}/g, "");
  result = result.replace(/\\toprule|\\midrule|\\bottomrule/g, "");
  result = result.replace(/\\label\{[^}]*\}/g, "");
  result = convertMathSymbols(result);
  result = convertMathFunctions(result);
  result = convertMathFractions(result);
  result = result.replace(/\\\\/g, "\n");
  result = result.replace(/&/g, " | ");
  result = result.replace(/\{([^{}]*)\}/g, "$1");
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

function extractEnvironmentContent(text: string): string {
  const allEnvs = [
    ...MATH_ENVIRONMENTS,
    ...TABLE_ENVIRONMENTS,
    ...REMOVE_ENVIRONMENTS,
    ...KEEP_ENVIRONMENTS,
  ];

  let result = text;
  for (const env of allEnvs) {
    const escaped = env.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\\\begin\\{${escaped}\\}(?:\\[[^\\]]*\\])?([\\s\\S]*?)\\\\end\\{${escaped}\\}`, "g");

    result = result.replace(re, (_match, content: string) => {
      if (REMOVE_ENVIRONMENTS.has(env)) {
        return "";
      }
      if (MATH_ENVIRONMENTS.has(env)) {
        return cleanMathContent(content);
      }
      if (TABLE_ENVIRONMENTS.has(env)) {
        return cleanTableContent(content);
      }
      return cleanMathContent(content);
    });
  }
  return result;
}

function removeCommands(text: string): string {
  const commands = [
    "textbf", "textit", "textsc", "textsf", "texttt", "textsl", "textrm",
    "emph", "underline", "boldsymbol", "mathbf", "mathit", "mathsf",
    "mathtt", "mathrm", "mathcal", "mathfrak",
    "small", "large", "Large", "LARGE", "huge", "Huge",
    "tiny", "footnotesize", "scriptsize", "normalsize",
    "bfseries", "itshape", "scshape", "sffamily", "ttfamily",
    "centering", "raggedright", "raggedleft",
    "noindent", "indent", "item",
    "newpage", "clearpage", "pagebreak", "linebreak",
    "caption", "label", "ref", "eqref", "cite",
    "citep", "citet", "citealp", "citealt", "citeauthor", "citeyear",
    "footnote", "marginpar",
    "includegraphics", "includegraphics*",
    "href", "url",
  ];
  let result = text;
  for (const cmd of commands) {
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\\\${escaped}(?:\\[[^\\]]*\\])?(?:\\{[^}]*\\})`, "g");
    result = result.replace(re, "");
  }
  return result;
}

function removeBraces(text: string): string {
  let result = text;
  let prev = "";
  let iterations = 0;
  while (result !== prev && iterations < 10) {
    prev = result;
    result = result.replace(/\{([^{}]*)\}/g, "$1");
    iterations++;
  }
  return result;
}

function cleanWhitespace(text: string): string {
  let result = text;
  result = result.replace(/[ \t]+/g, " ");
  result = result.replace(/ *\n */g, "\n");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/^\s+|\s+$/gm, "");
  return result.trim();
}

export function cleanLatexText(text: string): string {
  let result = text;
  result = removeComments(result);
  result = removeDocumentStructure(result);
  result = removeNewCommands(result);
  result = extractEnvironmentContent(result);
  result = convertMathFractions(result);
  result = convertMathFunctions(result);
  result = convertMathSymbols(result);
  result = removeCommands(result);
  result = removeBraces(result);
  result = cleanWhitespace(result);
  return result;
}
