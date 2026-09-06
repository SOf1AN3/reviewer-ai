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
};

const LATEX_ENVIRONMENTS = [
  "equation", "equation*", "align", "align*", "aligned",
  "gather", "gather*", "multline", "multline*",
  "eqnarray", "eqnarray*",
  "matrix", "pmatrix", "bmatrix", "vmatrix", "Vmatrix",
  "cases", "dcases", "rcases",
  "split", "subequations",
  "figure", "figure*", "table", "table*",
  "tabular", "tabular*",
  "itemize", "enumerate", "description",
  "abstract", "proof", "lemma", "theorem", "corollary",
  "definition", "example", "remark", "note",
  "thebibliography",
];

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

function removeEnvironments(text: string): string {
  let result = text;
  for (const env of LATEX_ENVIRONMENTS) {
    const escaped = env.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\\\begin\\{${escaped}\\}[\\s\\S]*?\\\\end\\{${escaped}\\}`, "g");
    result = result.replace(re, "");
  }
  return result;
}

function removeCommands(text: string): string {
  const commands = [
    "textbf", "textit", "textsc", "textsf", "texttt", "textsl", "textrm",
    "emph", "underline", "boldsymbol", "mathbf", "mathit", "mathsf",
    "mathtt", "mathrm", "mathcal", "mathfrak", "mathbb",
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
    "footnotesize", "scriptsize",
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

function convertMathFractions(text: string): string {
  return text.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
}

function convertMathFunctions(text: string): string {
  const funcs = [
    "sin", "cos", "tan", "cot", "sec", "csc",
    "arcsin", "arccos", "arctan",
    "sinh", "cosh", "tanh",
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

function convertMathSymbols(text: string): string {
  let result = text;
  for (const [cmd, symbol] of Object.entries(MATH_SYMBOLS)) {
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}\\s*\\*?`, "g");
    result = result.replace(re, symbol);
  }
  return result;
}

function convertSubscriptsSuperscripts(text: string): string {
  let result = text;
  result = result.replace(/\^\\{([^{}]*)\}/g, "^$1");
  result = result.replace(/_\\{([^{}]*)\}/g, "_$1");
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
  result = removeEnvironments(result);
  result = convertMathFractions(result);
  result = convertMathFunctions(result);
  result = convertMathSymbols(result);
  result = convertSubscriptsSuperscripts(result);
  result = removeCommands(result);
  result = removeBraces(result);
  result = cleanWhitespace(result);
  return result;
}
