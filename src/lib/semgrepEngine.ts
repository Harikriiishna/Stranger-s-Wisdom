export type SemgrepSeverity = 'ERROR' | 'WARNING' | 'INFO';

export type SemgrepLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'java'
  | 'yaml'
  | 'generic';

export interface SemgrepRuleMetadata {
  cwe?: string | string[];
  owasp?: string | string[];
  category?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  technology?: string[];
  references?: string[];
  [key: string]: unknown;
}

export interface SemgrepPatternClause {
  pattern?: string;
  'pattern-regex'?: string;
  'pattern-not'?: string;
  'pattern-inside'?: string;
  'pattern-not-inside'?: string;
  'pattern-either'?: SemgrepPatternClause[];
  patterns?: SemgrepPatternClause[];
  'metavariable-regex'?: {
    metavariable: string;
    regex: string;
  };
  'metavariable-pattern'?: {
    metavariable: string;
    pattern?: string;
    'pattern-regex'?: string;
  };
}

export interface SemgrepRule extends SemgrepPatternClause {
  id: string;
  languages: string[];
  severity: SemgrepSeverity;
  message: string;
  fix?: string;
  mode?: 'search' | 'taint' | 'secrets';
  metadata?: SemgrepRuleMetadata;
  'pattern-sources'?: SemgrepPatternClause[];
  'pattern-sanitizers'?: SemgrepPatternClause[];
  'pattern-sinks'?: SemgrepPatternClause[];
  yamlSource?: string;
}

export interface TaintTraceStep {
  kind: 'source' | 'propagation' | 'sink';
  line: number;
  column: number;
  variable?: string;
  snippet: string;
}

export interface SemgrepFinding {
  ruleId: string;
  severity: SemgrepSeverity;
  message: string;
  file: string;
  language: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  startOffset: number;
  endOffset: number;
  matchedCode: string;
  lineText: string;
  metavariables: Record<string, string>;
  fixSuggestion?: string;
  entropy?: number;
  taintTrace?: TaintTraceStep[];
  metadata?: SemgrepRuleMetadata;
}

export interface SemgrepScanSummary {
  totalFindings: number;
  errors: number;
  warnings: number;
  infos: number;
  fixable: number;
  filesScanned: number;
  rulesEvaluated: number;
  durationMs: number;
}

export interface SemgrepScanResult {
  findings: SemgrepFinding[];
  summary: SemgrepScanSummary;
  parseErrors: string[];
}

interface Token {
  kind: 'ident' | 'number' | 'string' | 'punct' | 'ellipsis' | 'metavar' | 'restmetavar';
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

const LINE_COMMENT_START_LANGS = new Set(['python', 'yaml']);

export function detectLanguageFromFilename(filename: string): SemgrepLanguage {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.mts')) {
    return 'typescript';
  }
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return 'javascript';
  }
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
  return 'generic';
}

function buildLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function offsetToLineCol(lineStarts: number[], offset: number): { line: number; column: number } {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStarts[mid] <= offset) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const lineIdx = Math.max(0, hi);
  return {
    line: lineIdx + 1,
    column: offset - lineStarts[lineIdx] + 1,
  };
}

function getLineText(source: string, lineStarts: number[], lineNumber: number): string {
  const start = lineStarts[lineNumber - 1] ?? 0;
  const nextStart = lineStarts[lineNumber] ?? source.length;
  return source.slice(start, nextStart).replace(/\r?\n$/, '');
}

export function tokenizeSource(
  input: string,
  options: { isPattern?: boolean; language?: string } = {}
): Token[] {
  const tokens: Token[] = [];
  const lineStarts = buildLineStarts(input);
  const hashComments = options.language ? LINE_COMMENT_START_LANGS.has(options.language) : false;
  let i = 0;
  const n = input.length;

  const pushToken = (kind: Token['kind'], value: string, start: number, end: number) => {
    const pos = offsetToLineCol(lineStarts, start);
    tokens.push({ kind, value, start, end, line: pos.line, column: pos.column });
  };

  while (i < n) {
    const ch = input[i];
    const next = input[i + 1];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Comments (only skipped in source, or # / // comments)
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && input[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n - 1 && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i = Math.min(n, i + 2);
      continue;
    }
    if (ch === '#' && (hashComments || (!options.isPattern && input.slice(i, i + 2) !== '#!'))) {
      if (hashComments) {
        while (i < n && input[i] !== '\n') i++;
        continue;
      }
    }

    // Ellipsis operator in Semgrep patterns
    if (options.isPattern && input.startsWith('...', i)) {
      pushToken('ellipsis', '...', i, i + 3);
      i += 3;
      continue;
    }

    // Rest metavariable ($...ARGS)
    if (options.isPattern && input.startsWith('$...', i)) {
      let j = i + 4;
      while (j < n && /[A-Z0-9_]/.test(input[j])) j++;
      if (j > i + 4) {
        pushToken('restmetavar', input.slice(i, j), i, j);
        i = j;
        continue;
      }
    }

    // Standard metavariable ($VAR or $_)
    if (options.isPattern && ch === '$' && i + 1 < n && /[A-Z_]/.test(input[i + 1])) {
      let j = i + 2;
      while (j < n && /[A-Z0-9_]/.test(input[j])) j++;
      pushToken('metavar', input.slice(i, j), i, j);
      i = j;
      continue;
    }

    // Strings & template literals
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (input[j] === '\\') {
          j += 2;
          continue;
        }
        if (input[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      pushToken('string', input.slice(i, j), i, j);
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[0-9a-fA-FxXoObB._]/.test(input[j])) j++;
      pushToken('number', input.slice(i, j), i, j);
      i = j;
      continue;
    }

    // Identifiers
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(input[j])) j++;
      pushToken('ident', input.slice(i, j), i, j);
      i = j;
      continue;
    }

    // Multi-char operators
    const three = input.slice(i, i + 3);
    if (three === '===' || three === '!==' || three === '>>>' || three === '**=' || three === '<<=' || three === '>>=') {
      pushToken('punct', three, i, i + 3);
      i += 3;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (
      two === '==' ||
      two === '!=' ||
      two === '<=' ||
      two === '>=' ||
      two === '&&' ||
      two === '||' ||
      two === '??' ||
      two === '?.' ||
      two === '=>' ||
      two === ':=' ||
      two === '::' ||
      two === '->' ||
      two === '+=' ||
      two === '-=' ||
      two === '*=' ||
      two === '/='
    ) {
      pushToken('punct', two, i, i + 2);
      i += 2;
      continue;
    }

    pushToken('punct', ch, i, i + 1);
    i++;
  }

  return tokens;
}

interface RawMatch {
  startTokenIdx: number;
  endTokenIdx: number;
  startOffset: number;
  endOffset: number;
  metavariables: Record<string, string>;
}

const OPEN_DELIMS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const CLOSE_DELIMS = new Set([')', ']', '}']);

function findMatchingDelimiterEnd(tokens: Token[], startIdx: number): number {
  const openVal = tokens[startIdx]?.value;
  const closeVal = OPEN_DELIMS[openVal];
  if (!closeVal) return startIdx;
  let depth = 0;
  for (let i = startIdx; i < tokens.length; i++) {
    if (tokens[i].value === openVal) depth++;
    else if (tokens[i].value === closeVal) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return startIdx;
}

// Consumes one semantic expression / argument unit for a $METAVAR
function captureMetavarSpan(
  source: string,
  tokens: Token[],
  startIdx: number,
  nextPatternToken?: Token
): Array<{ endIdx: number; value: string }> {
  if (startIdx >= tokens.length) return [];
  const first = tokens[startIdx];
  if (CLOSE_DELIMS.has(first.value) || first.value === ',' || first.value === ';') {
    return [];
  }

  const results: Array<{ endIdx: number; value: string }> = [];

  // Option A: If starts with (, [, { capture full balanced group
  if (OPEN_DELIMS[first.value]) {
    const groupEnd = findMatchingDelimiterEnd(tokens, startIdx);
    results.push({
      endIdx: groupEnd,
      value: source.slice(first.start, tokens[groupEnd].end),
    });
    return results;
  }

  // Option B: Chain of identifiers, dots, calls, brackets, or unary prefix (e.g. req.body.name, await fn(), !flag)
  let prefixEnd = startIdx;
  if (
    first.value === '!' ||
    first.value === '-' ||
    first.value === '+' ||
    first.value === 'await' ||
    first.value === 'typeof'
  ) {
    if (startIdx + 1 < tokens.length) {
      prefixEnd = startIdx + 1;
    }
  }

  const head = tokens[prefixEnd];
  if (
    head &&
    (head.kind === 'ident' || head.kind === 'number' || head.kind === 'string')
  ) {
    // Check chained member/call access
    let chainEnd = prefixEnd;
    while (chainEnd + 1 < tokens.length) {
      const after = tokens[chainEnd + 1];
      if (after.value === '.' || after.value === '?.') {
        if (chainEnd + 2 < tokens.length && tokens[chainEnd + 2].kind === 'ident') {
          chainEnd += 2;
          continue;
        }
      }
      if (after.value === '(' || after.value === '[') {
        // Stop chaining if the pattern explicitly expects this delimiter next (e.g., $FN(...))
        if (
          nextPatternToken &&
          nextPatternToken.value === after.value &&
          chainEnd >= prefixEnd
        ) {
          break;
        }
        const closeIdx = findMatchingDelimiterEnd(tokens, chainEnd + 1);
        chainEnd = closeIdx;
        continue;
      }
      break;
    }
    // Single atom fallback first if chainEnd > prefixEnd and pattern continues with '.'
    if (nextPatternToken && nextPatternToken.value === '.' && prefixEnd < chainEnd) {
      results.push({
        endIdx: prefixEnd,
        value: source.slice(first.start, tokens[prefixEnd].end),
      });
    }
    results.push({
      endIdx: chainEnd,
      value: source.slice(first.start, tokens[chainEnd].end),
    });
    // Also try binary expression up to nextPatternToken delimiter if nextPatternToken is punct like ), ,, ;
    if (
      nextPatternToken &&
      (nextPatternToken.value === ')' ||
        nextPatternToken.value === ',' ||
        nextPatternToken.value === ';' ||
        nextPatternToken.value === ']')
    ) {
      let depth = 0;
      let exprEnd = chainEnd;
      for (let k = chainEnd + 1; k < tokens.length && k - startIdx < 32; k++) {
        const tk = tokens[k];
        if (OPEN_DELIMS[tk.value]) {
          depth++;
        } else if (CLOSE_DELIMS.has(tk.value)) {
          if (depth === 0) break;
          depth--;
        } else if (depth === 0 && (tk.value === ',' || tk.value === ';')) {
          break;
        }
        exprEnd = k;
      }
      if (exprEnd > chainEnd) {
        results.push({
          endIdx: exprEnd,
          value: source.slice(first.start, tokens[exprEnd].end),
        });
      }
    }
    return results;
  }

  // Generic single token
  results.push({ endIdx: startIdx, value: source.slice(first.start, first.end) });
  return results;
}

function isStringWildcardMatch(patternToken: Token, sourceToken: Token): boolean {
  if (patternToken.kind !== 'string' || sourceToken.kind !== 'string') return false;
  // Interpolated template literals contain dynamic expressions and must NOT match static "..." wildcards
  if (sourceToken.value.startsWith('`') && /\$\{[^}]+\}/.test(sourceToken.value)) {
    return patternToken.value === sourceToken.value;
  }
  const pBody = patternToken.value.slice(1, -1);
  if (pBody === '...') return true;
  if (pBody.includes('...')) {
    const escaped = pBody
      .split('...')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s\\S]*');
    const regex = new RegExp(`^${escaped}$`);
    const sBody = sourceToken.value.slice(1, -1);
    return regex.test(sBody);
  }
  return patternToken.value === sourceToken.value;
}

function matchPatternTokensAt(
  source: string,
  srcTokens: Token[],
  patTokens: Token[],
  srcIdx: number,
  patIdx: number,
  bindings: Record<string, string>,
  depthLimit = 0
): RawMatch | null {
  if (patIdx >= patTokens.length) {
    return {
      startTokenIdx: srcIdx,
      endTokenIdx: srcIdx - 1,
      startOffset: 0,
      endOffset: 0,
      metavariables: bindings,
    };
  }

  if (depthLimit > 80) return null;

  const pTok = patTokens[patIdx];

  // Semgrep ellipsis `...` or `$...ARGS`
  if (pTok.kind === 'ellipsis' || pTok.kind === 'restmetavar') {
    const nextPat = patTokens[patIdx + 1];
    // Can match 0 tokens
    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    const maxScan = Math.min(srcTokens.length, srcIdx + 120);

    for (let k = srcIdx; k <= maxScan; k++) {
      // Try finishing ellipsis before srcTokens[k]
      if (!nextPat || k < srcTokens.length) {
        const nextBindings = { ...bindings };
        if (pTok.kind === 'restmetavar') {
          const captured =
            k > srcIdx ? source.slice(srcTokens[srcIdx].start, srcTokens[k - 1].end) : '';
          const prev = nextBindings[pTok.value];
          if (prev !== undefined && prev !== captured) {
            // unification mismatch
          } else {
            nextBindings[pTok.value] = captured;
            const sub = matchPatternTokensAt(
              source,
              srcTokens,
              patTokens,
              k,
              patIdx + 1,
              nextBindings,
              depthLimit + 1
            );
            if (sub) return sub;
            // If ellipsis matched 0 tokens and is followed by a separator comma (e.g. `..., shell=True`), allow skipping the extra comma
            if (k === srcIdx && nextPat?.value === ',') {
              const subSkipComma = matchPatternTokensAt(
                source,
                srcTokens,
                patTokens,
                k,
                patIdx + 2,
                nextBindings,
                depthLimit + 1
              );
              if (subSkipComma) return subSkipComma;
            }
          }
        } else {
          const sub = matchPatternTokensAt(
            source,
            srcTokens,
            patTokens,
            k,
            patIdx + 1,
            nextBindings,
            depthLimit + 1
          );
          if (sub) return sub;
          // If ellipsis matched 0 tokens and is followed by a separator comma (e.g. `fn($A, ..., shell=True)`), skip redundant comma
          if (k === srcIdx && nextPat?.value === ',') {
            const subSkipComma = matchPatternTokensAt(
              source,
              srcTokens,
              patTokens,
              k,
              patIdx + 2,
              nextBindings,
              depthLimit + 1
            );
            if (subSkipComma) return subSkipComma;
          }
        }
      }

      if (k >= srcTokens.length) break;
      const cur = srcTokens[k];
      if (cur.value === '(') parenDepth++;
      else if (cur.value === ')') {
        if (parenDepth === 0) break;
        parenDepth--;
      } else if (cur.value === '[') bracketDepth++;
      else if (cur.value === ']') {
        if (bracketDepth === 0) break;
        bracketDepth--;
      } else if (cur.value === '{') braceDepth++;
      else if (cur.value === '}') {
        if (braceDepth === 0) break;
        braceDepth--;
      }
    }
    return null;
  }

  // Optional trailing `, ...` or `, $...ARGS` (Semgrep `fn($A, ...)` also matches 1-arg `fn(x)`)
  if (
    pTok.value === ',' &&
    (patTokens[patIdx + 1]?.kind === 'ellipsis' || patTokens[patIdx + 1]?.kind === 'restmetavar')
  ) {
    const restTok = patTokens[patIdx + 1];
    const skipBindings = { ...bindings };
    let canSkipEmpty = true;
    if (restTok.kind === 'restmetavar') {
      const prev = skipBindings[restTok.value];
      if (prev !== undefined && prev !== '') canSkipEmpty = false;
      else skipBindings[restTok.value] = '';
    }
    if (canSkipEmpty) {
      const skipRes = matchPatternTokensAt(
        source,
        srcTokens,
        patTokens,
        srcIdx,
        patIdx + 2,
        skipBindings,
        depthLimit + 1
      );
      if (skipRes) return skipRes;
    }
  }

  if (srcIdx >= srcTokens.length) return null;

  // Semgrep metavariable `$VAR` or `$_`
  if (pTok.kind === 'metavar') {
    const nextPat = patTokens[patIdx + 1];
    const candidates = captureMetavarSpan(source, srcTokens, srcIdx, nextPat);
    for (const cand of candidates) {
      const nextBindings = { ...bindings };
      if (pTok.value !== '$_') {
        const existing = nextBindings[pTok.value];
        if (existing !== undefined && existing !== cand.value) {
          continue;
        }
        nextBindings[pTok.value] = cand.value;
      }
      const sub = matchPatternTokensAt(
        source,
        srcTokens,
        patTokens,
        cand.endIdx + 1,
        patIdx + 1,
        nextBindings,
        depthLimit + 1
      );
      if (sub) return sub;
    }
    return null;
  }

  const sTok = srcTokens[srcIdx];

  // String with embedded `...` or exact match
  if (pTok.kind === 'string') {
    if (!isStringWildcardMatch(pTok, sTok)) return null;
    return matchPatternTokensAt(
      source,
      srcTokens,
      patTokens,
      srcIdx + 1,
      patIdx + 1,
      bindings,
      depthLimit + 1
    );
  }

  // Exact token equality (allow optional semicolons at end of pattern)
  if (pTok.value === sTok.value) {
    return matchPatternTokensAt(
      source,
      srcTokens,
      patTokens,
      srcIdx + 1,
      patIdx + 1,
      bindings,
      depthLimit + 1
    );
  }

  return null;
}

function findPatternMatches(
  source: string,
  srcTokens: Token[],
  patternStr: string,
  language: string
): RawMatch[] {
  const trimmed = patternStr.trim();
  if (!trimmed) return [];

  // Strip trailing optional semicolon in single-line patterns if code uses none, or keep flexible
  const patTokens = tokenizeSource(trimmed, { isPattern: true, language });
  if (patTokens.length === 0) return [];

  const matches: RawMatch[] = [];
  let i = 0;
  while (i < srcTokens.length) {
    const res = matchPatternTokensAt(source, srcTokens, patTokens, i, 0, {});
    if (res && res.endTokenIdx >= i) {
      const startTok = srcTokens[i];
      const endTok = srcTokens[res.endTokenIdx];
      matches.push({
        startTokenIdx: i,
        endTokenIdx: res.endTokenIdx,
        startOffset: startTok.start,
        endOffset: endTok.end,
        metavariables: res.metavariables,
      });
      i = res.endTokenIdx + 1;
    } else {
      i++;
    }
  }
  return matches;
}

function findRegexMatches(source: string, regexPattern: string): RawMatch[] {
  const matches: RawMatch[] = [];
  try {
    const re = new RegExp(regexPattern, 'gm');
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const meta: Record<string, string> = {};
      if (m.groups) {
        for (const [k, v] of Object.entries(m.groups)) {
          if (v !== undefined) meta[`$${k.toUpperCase()}`] = v;
        }
      }
      matches.push({
        startTokenIdx: -1,
        endTokenIdx: -1,
        startOffset: m.index,
        endOffset: m.index + m[0].length,
        metavariables: meta,
      });
    }
  } catch {
    // invalid regex handled softly
  }
  return matches;
}

function rangesOverlapOrContain(outer: RawMatch, inner: RawMatch): boolean {
  return outer.startOffset <= inner.startOffset && outer.endOffset >= inner.endOffset;
}

function evaluateClause(
  clause: SemgrepPatternClause,
  source: string,
  srcTokens: Token[],
  language: string
): RawMatch[] {
  if (clause.pattern) {
    return findPatternMatches(source, srcTokens, clause.pattern, language);
  }
  if (clause['pattern-regex']) {
    return findRegexMatches(source, clause['pattern-regex']);
  }
  if (clause['pattern-either'] && clause['pattern-either'].length > 0) {
    const combined: RawMatch[] = [];
    for (const sub of clause['pattern-either']) {
      combined.push(...evaluateClause(sub, source, srcTokens, language));
    }
    return deduplicateRawMatches(combined);
  }
  if (clause.patterns && clause.patterns.length > 0) {
    // Positive anchor first: pattern, pattern-either, pattern-regex, pattern-inside
    const positives = clause.patterns.filter(
      (c) => c.pattern || c['pattern-regex'] || c['pattern-either'] || c.patterns
    );
    const insides = clause.patterns.filter((c) => c['pattern-inside']);
    const nots = clause.patterns.filter((c) => c['pattern-not']);
    const notInsides = clause.patterns.filter((c) => c['pattern-not-inside']);
    const metaRegexes = clause.patterns.filter((c) => c['metavariable-regex']);
    const metaPatterns = clause.patterns.filter((c) => c['metavariable-pattern']);

    let candidates: RawMatch[] = [];
    if (positives.length > 0) {
      candidates = evaluateClause(positives[0], source, srcTokens, language);
      for (let i = 1; i < positives.length; i++) {
        const nextSet = evaluateClause(positives[i], source, srcTokens, language);
        candidates = candidates.filter((cand) =>
          nextSet.some(
            (other) =>
              other.startOffset <= cand.endOffset &&
              other.endOffset >= cand.startOffset &&
              mergeBindings(cand.metavariables, other.metavariables) !== null
          )
        );
      }
    } else if (insides.length > 0) {
      candidates = findPatternMatches(source, srcTokens, insides[0]['pattern-inside']!, language);
    }

    for (const ins of insides) {
      const containers = findPatternMatches(source, srcTokens, ins['pattern-inside']!, language);
      candidates = candidates.filter((cand) =>
        containers.some(
          (box) =>
            rangesOverlapOrContain(box, cand) &&
            mergeBindings(cand.metavariables, box.metavariables) !== null
        )
      );
      candidates = candidates.map((cand) => {
        const box = containers.find((b) => rangesOverlapOrContain(b, cand));
        return box
          ? {
              ...cand,
              metavariables: { ...box.metavariables, ...cand.metavariables },
            }
          : cand;
      });
    }

    for (const notIns of notInsides) {
      const forbiddenBoxes = findPatternMatches(
        source,
        srcTokens,
        notIns['pattern-not-inside']!,
        language
      );
      candidates = candidates.filter(
        (cand) => !forbiddenBoxes.some((box) => rangesOverlapOrContain(box, cand))
      );
    }

    for (const notClause of nots) {
      const excluded = findPatternMatches(source, srcTokens, notClause['pattern-not']!, language);
      candidates = candidates.filter(
        (cand) =>
          !excluded.some(
            (ex) =>
              ex.startOffset <= cand.startOffset && ex.endOffset >= cand.endOffset ||
              (ex.startOffset >= cand.startOffset && ex.endOffset <= cand.endOffset)
          )
      );
    }

    for (const mvReg of metaRegexes) {
      const spec = mvReg['metavariable-regex']!;
      try {
        const re = new RegExp(spec.regex);
        candidates = candidates.filter((cand) => {
          const val = cand.metavariables[spec.metavariable];
          return val !== undefined && re.test(val);
        });
      } catch {
        candidates = [];
      }
    }

    for (const mvPat of metaPatterns) {
      const spec = mvPat['metavariable-pattern']!;
      candidates = candidates.filter((cand) => {
        const val = cand.metavariables[spec.metavariable];
        if (val === undefined) return false;
        if (spec['pattern-regex']) {
          try {
            return new RegExp(spec['pattern-regex']).test(val);
          } catch {
            return false;
          }
        }
        if (spec.pattern) {
          const subTokens = tokenizeSource(val, { language });
          return findPatternMatches(val, subTokens, spec.pattern, language).length > 0;
        }
        return true;
      });
    }

    return candidates;
  }
  return [];
}

function mergeBindings(
  a: Record<string, string>,
  b: Record<string, string>
): Record<string, string> | null {
  const merged = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (merged[k] !== undefined && merged[k] !== v) return null;
    merged[k] = v;
  }
  return merged;
}

function deduplicateRawMatches(matches: RawMatch[]): RawMatch[] {
  const seen = new Set<string>();
  const out: RawMatch[] = [];
  for (const m of matches) {
    const key = `${m.startOffset}:${m.endOffset}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }
  return out;
}

function interpolateFix(fixTemplate: string, metavariables: Record<string, string>): string {
  let result = fixTemplate;
  const keys = Object.keys(metavariables).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    result = result.split(key).join(metavariables[key]);
  }
  return result;
}

function evaluateTaintRule(
  rule: SemgrepRule,
  source: string,
  srcTokens: Token[],
  lineStarts: number[],
  language: string
): Array<{ match: RawMatch; trace: TaintTraceStep[] }> {
  const sources = rule['pattern-sources'] || [];
  const sanitizers = rule['pattern-sanitizers'] || [];
  const sinks = rule['pattern-sinks'] || [];
  if (sources.length === 0 || sinks.length === 0) return [];

  const sourceMatches: RawMatch[] = [];
  for (const clause of sources) {
    sourceMatches.push(...evaluateClause(clause, source, srcTokens, language));
  }

  const sinkMatches: RawMatch[] = [];
  for (const clause of sinks) {
    sinkMatches.push(...evaluateClause(clause, source, srcTokens, language));
  }

  const sanitizerMatches: RawMatch[] = [];
  for (const clause of sanitizers) {
    sanitizerMatches.push(...evaluateClause(clause, source, srcTokens, language));
  }

  if (sourceMatches.length === 0 || sinkMatches.length === 0) return [];

  // Track tainted variable identifiers across lines in order
  const lines = source.split('\n');
  const taintedVars = new Map<string, TaintTraceStep>();
  const sourceLines = new Map<number, TaintTraceStep>();

  for (const sm of sourceMatches) {
    const pos = offsetToLineCol(lineStarts, sm.startOffset);
    const snippet = source.slice(sm.startOffset, sm.endOffset);
    const step: TaintTraceStep = {
      kind: 'source',
      line: pos.line,
      column: pos.column,
      snippet,
    };
    sourceLines.set(pos.line, step);
  }

  const results: Array<{ match: RawMatch; trace: TaintTraceStep[] }> = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const lineText = lines[idx];
    const lineStartOff = lineStarts[idx];
    const lineEndOff = lineStartOff + lineText.length;

    const lineHasSanitizer = sanitizerMatches.some(
      (san) => san.startOffset >= lineStartOff && san.startOffset <= lineEndOff
    );

    // Check assignment like `const foo = ...`, `let x = ...`, `foo = ...`, `foo := ...`
    const assignMatch = lineText.match(
      /^\s*(?:(?:const|let|var)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::=|=)\s*(.+)$/
    );
    if (assignMatch) {
      const targetVar = assignMatch[1];
      const rhs = assignMatch[2];
      if (lineHasSanitizer) {
        taintedVars.delete(targetVar);
      } else if (sourceLines.has(lineNum)) {
        const srcStep = sourceLines.get(lineNum)!;
        taintedVars.set(targetVar, { ...srcStep, variable: targetVar });
      } else {
        // Propagate if RHS references any tainted var
        for (const [tVar, originStep] of taintedVars.entries()) {
          if (new RegExp(`\\b${tVar}\\b`).test(rhs)) {
            taintedVars.set(targetVar, originStep);
            break;
          }
        }
      }
    }

    // Check sinks on this line
    for (const sink of sinkMatches) {
      if (sink.startOffset >= lineStartOff && sink.startOffset <= lineEndOff) {
        if (lineHasSanitizer) continue;
        const sinkSnippet = source.slice(sink.startOffset, sink.endOffset);
        const sinkPos = offsetToLineCol(lineStarts, sink.startOffset);

        // Direct source inside sink?
        const directSource = sourceMatches.find(
          (sm) => sm.startOffset >= sink.startOffset && sm.endOffset <= sink.endOffset
        );
        if (directSource) {
          const srcPos = offsetToLineCol(lineStarts, directSource.startOffset);
          results.push({
            match: sink,
            trace: [
              {
                kind: 'source',
                line: srcPos.line,
                column: srcPos.column,
                snippet: source.slice(directSource.startOffset, directSource.endOffset),
              },
              {
                kind: 'sink',
                line: sinkPos.line,
                column: sinkPos.column,
                snippet: sinkSnippet,
              },
            ],
          });
          continue;
        }

        // Propagated tainted var referenced inside sink or its metavars
        for (const [tVar, origin] of taintedVars.entries()) {
          if (origin.line > sinkPos.line) continue;
          if (new RegExp(`\\b${tVar}\\b`).test(sinkSnippet)) {
            const trace: TaintTraceStep[] = [origin];
            if (origin.line !== sinkPos.line) {
              trace.push({
                kind: 'propagation',
                line: origin.line,
                column: origin.column,
                variable: tVar,
                snippet: `tainted via ${tVar}`,
              });
            }
            trace.push({
              kind: 'sink',
              line: sinkPos.line,
              column: sinkPos.column,
              variable: tVar,
              snippet: sinkSnippet,
            });
            results.push({ match: sink, trace });
            break;
          }
        }
      }
    }
  }

  return results;
}

export function computeShannonEntropy(input: string): number {
  if (!input) return 0;
  const freq = new Map<string, number>();
  for (const ch of input) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  const len = input.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(2));
}

function maskSecretMatch(raw: string): string {
  if (raw.length <= 10) return `${raw.slice(0, 2)}***`;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

function stripInlineYamlComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) {
      if (inSingle && line[i + 1] === "'") {
        i++;
        continue;
      }
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      if (ch === '"' && line[i - 1] !== '\\') {
        inDouble = !inDouble;
      }
    } else if (ch === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(line[i - 1])) {
        return line.slice(0, i).trimEnd();
      }
    }
  }
  return line;
}

// Lightweight compliant Semgrep YAML parser
export function parseSemgrepYaml(yamlText: string): {
  rules: SemgrepRule[];
  errors: string[];
} {
  const errors: string[] = [];
  const rawLines = yamlText.replace(/\r\n/g, '\n').split('\n');

  interface LineEntry {
    indent: number;
    text: string;
    lineNum: number;
  }

  const lines: LineEntry[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const withoutComment = stripInlineYamlComment(raw);
    const trimmed = withoutComment.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = withoutComment.search(/\S/);
    lines.push({ indent, text: trimmed, lineNum: i + 1 });
  }

  if (lines.length === 0) {
    return { rules: [], errors: ['YAML rule document is empty.'] };
  }

  function parseScalar(val: string): unknown {
    const t = val.trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null' || t === '~') return null;
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    if (t.startsWith('[') && t.endsWith(']')) {
      return t
        .slice(1, -1)
        .split(',')
        .map((item) => parseScalar(item.trim()))
        .filter((x) => x !== '');
    }
    return t;
  }

  let cursor = 0;

  function parseBlockScalar(parentIndent: number, fold: boolean): string {
    // Read raw lines starting from lineNum after current line
    const currentLineNum = lines[cursor - 1].lineNum;
    const collected: string[] = [];
    let blockIndent = -1;
    let rawIdx = currentLineNum; // 0-indexed next line in rawLines

    while (rawIdx < rawLines.length) {
      const r = rawLines[rawIdx];
      const trimmed = r.trim();
      if (!trimmed) {
        collected.push('');
        rawIdx++;
        continue;
      }
      const ind = r.search(/\S/);
      if (ind <= parentIndent) break;
      if (blockIndent === -1) blockIndent = ind;
      collected.push(r.slice(blockIndent));
      rawIdx++;
    }

    // Advance parsed lines cursor past rawIdx
    while (cursor < lines.length && lines[cursor].lineNum <= rawIdx) {
      cursor++;
    }

    while (collected.length > 0 && collected[collected.length - 1] === '') {
      collected.pop();
    }
    return fold ? collected.join(' ').trim() : collected.join('\n');
  }

  function parseNode(expectedIndent: number): unknown {
    if (cursor >= lines.length) return null;
    const first = lines[cursor];
    if (first.indent < expectedIndent) return null;

    if (first.text.startsWith('- ') || first.text === '-') {
      const arr: unknown[] = [];
      const listIndent = first.indent;
      while (cursor < lines.length) {
        const cur = lines[cursor];
        if (cur.indent < listIndent) break;
        if (cur.indent > listIndent) break;
        if (!(cur.text.startsWith('- ') || cur.text === '-')) break;

        const afterDash = cur.text === '-' ? '' : cur.text.slice(2).trim();
        cursor++;

        if (!afterDash) {
          arr.push(parseNode(listIndent + 1));
        } else if (afterDash.includes(':') && !afterDash.startsWith('"') && !afterDash.startsWith("'")) {
          const obj: Record<string, unknown> = {};
          const colonIdx = afterDash.indexOf(':');
          const key = afterDash.slice(0, colonIdx).trim();
          const rest = afterDash.slice(colonIdx + 1).trim();
          if (rest === '|' || rest === '|-') {
            obj[key] = parseBlockScalar(listIndent, false);
          } else if (rest === '>' || rest === '>-') {
            obj[key] = parseBlockScalar(listIndent, true);
          } else if (rest === '') {
            obj[key] = parseNode(listIndent + 2);
          } else {
            obj[key] = parseScalar(rest);
          }
          // Continue parsing remaining keys at listIndent + 2 (or > listIndent)
          while (cursor < lines.length && lines[cursor].indent > listIndent) {
            const sub = lines[cursor];
            if (sub.text.startsWith('- ')) break;
            const cIdx = sub.text.indexOf(':');
            if (cIdx === -1) {
              cursor++;
              continue;
            }
            const subKey = sub.text.slice(0, cIdx).trim();
            const subRest = sub.text.slice(cIdx + 1).trim();
            const subIndent = sub.indent;
            cursor++;
            if (subRest === '|' || subRest === '|-') {
              obj[subKey] = parseBlockScalar(subIndent, false);
            } else if (subRest === '>' || subRest === '>-') {
              obj[subKey] = parseBlockScalar(subIndent, true);
            } else if (subRest === '') {
              obj[subKey] = parseNode(subIndent + 1);
            } else {
              obj[subKey] = parseScalar(subRest);
            }
          }
          arr.push(obj);
        } else {
          arr.push(parseScalar(afterDash));
        }
      }
      return arr;
    }

    // Object map
    const map: Record<string, unknown> = {};
    const mapIndent = first.indent;
    while (cursor < lines.length) {
      const cur = lines[cursor];
      if (cur.indent < mapIndent) break;
      if (cur.text.startsWith('- ')) break;
      const cIdx = cur.text.indexOf(':');
      if (cIdx === -1) {
        errors.push(`Line ${cur.lineNum}: expected "key: value" syntax.`);
        cursor++;
        continue;
      }
      const key = cur.text.slice(0, cIdx).trim();
      const rest = cur.text.slice(cIdx + 1).trim();
      const keyIndent = cur.indent;
      cursor++;
      if (rest === '|' || rest === '|-') {
        map[key] = parseBlockScalar(keyIndent, false);
      } else if (rest === '>' || rest === '>-') {
        map[key] = parseBlockScalar(keyIndent, true);
      } else if (rest === '') {
        map[key] = parseNode(keyIndent + 1);
      } else {
        map[key] = parseScalar(rest);
      }
    }
    return map;
  }

  const parsed = parseNode(0);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { rules: [], errors: ['Top-level YAML must contain a "rules:" list.'] };
  }

  const rootObj = parsed as Record<string, unknown>;
  const rawRules = Array.isArray(rootObj.rules) ? rootObj.rules : [];
  if (rawRules.length === 0) {
    return { rules: [], errors: ['No rules found under top-level "rules:" key.'] };
  }

  const rules: SemgrepRule[] = [];
  for (let i = 0; i < rawRules.length; i++) {
    const r = rawRules[i] as Record<string, unknown>;
    if (!r || typeof r !== 'object') continue;
    const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `custom.rule-${i + 1}`;
    const languages = Array.isArray(r.languages)
      ? r.languages.map(String)
      : typeof r.languages === 'string'
      ? [r.languages]
      : ['generic'];
    const sevRaw = typeof r.severity === 'string' ? r.severity.toUpperCase() : 'WARNING';
    const severity: SemgrepSeverity =
      sevRaw === 'ERROR' || sevRaw === 'CRITICAL' || sevRaw === 'HIGH'
        ? 'ERROR'
        : sevRaw === 'INFO' || sevRaw === 'LOW'
        ? 'INFO'
        : 'WARNING';
    const message =
      typeof r.message === 'string' && r.message.trim()
        ? r.message.trim()
        : `Matched Semgrep rule ${id}`;

    rules.push({
      ...(r as unknown as SemgrepPatternClause),
      id,
      languages,
      severity,
      message,
      fix: typeof r.fix === 'string' ? r.fix : undefined,
      mode:
        r.mode === 'taint' || r.mode === 'secrets' || r.mode === 'search'
          ? r.mode
          : undefined,
      metadata:
        r.metadata && typeof r.metadata === 'object'
          ? (r.metadata as SemgrepRuleMetadata)
          : undefined,
      'pattern-sources': Array.isArray(r['pattern-sources'])
        ? (r['pattern-sources'] as SemgrepPatternClause[])
        : undefined,
      'pattern-sanitizers': Array.isArray(r['pattern-sanitizers'])
        ? (r['pattern-sanitizers'] as SemgrepPatternClause[])
        : undefined,
      'pattern-sinks': Array.isArray(r['pattern-sinks'])
        ? (r['pattern-sinks'] as SemgrepPatternClause[])
        : undefined,
      yamlSource: yamlText,
    });
  }

  return { rules, errors };
}

function ruleMatchesLanguage(rule: SemgrepRule, targetLang: string): boolean {
  const normalized = targetLang.toLowerCase();
  if (rule.languages.includes('generic') || rule.languages.includes('*')) return true;
  if (normalized === 'typescript' && (rule.languages.includes('typescript') || rule.languages.includes('ts') || rule.languages.includes('javascript') || rule.languages.includes('js'))) {
    return true;
  }
  if (normalized === 'javascript' && (rule.languages.includes('javascript') || rule.languages.includes('js'))) {
    return true;
  }
  return rule.languages.map((l) => l.toLowerCase()).includes(normalized);
}

export function scanCodeWithRules(params: {
  code: string;
  filename?: string;
  language?: string;
  rules: SemgrepRule[];
}): SemgrepScanResult {
  const started = Date.now();
  const filename = params.filename || 'snippet.ts';
  const language = params.language || detectLanguageFromFilename(filename);
  const lineStarts = buildLineStarts(params.code);
  const srcTokens = tokenizeSource(params.code, { language });
  const findings: SemgrepFinding[] = [];
  let rulesEvaluated = 0;

  for (const rule of params.rules) {
    if (!ruleMatchesLanguage(rule, language)) continue;
    rulesEvaluated++;

    if (rule.mode === 'taint') {
      const taintMatches = evaluateTaintRule(rule, params.code, srcTokens, lineStarts, language);
      for (const { match, trace } of taintMatches) {
        const startPos = offsetToLineCol(lineStarts, match.startOffset);
        const endPos = offsetToLineCol(lineStarts, match.endOffset);
        const matchedCode = params.code.slice(match.startOffset, match.endOffset);
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: interpolateFix(rule.message, match.metavariables),
          file: filename,
          language,
          startLine: startPos.line,
          startColumn: startPos.column,
          endLine: endPos.line,
          endColumn: endPos.column,
          startOffset: match.startOffset,
          endOffset: match.endOffset,
          matchedCode,
          lineText: getLineText(params.code, lineStarts, startPos.line),
          metavariables: match.metavariables,
          fixSuggestion: rule.fix ? interpolateFix(rule.fix, match.metavariables) : undefined,
          taintTrace: trace,
          metadata: rule.metadata,
        });
      }
      continue;
    }

    const rawMatches = evaluateClause(rule, params.code, srcTokens, language);
    for (const match of rawMatches) {
      const matchedCode = params.code.slice(match.startOffset, match.endOffset);
      let entropy: number | undefined;
      if (rule.mode === 'secrets') {
        const candidateSecret = match.metavariables.$SECRET || matchedCode;
        entropy = computeShannonEntropy(candidateSecret.replace(/["'`\s]/g, ''));
        if (entropy < 3.0 && !matchedCode.includes('BEGIN')) {
          continue;
        }
      }

      const startPos = offsetToLineCol(lineStarts, match.startOffset);
      const endPos = offsetToLineCol(lineStarts, match.endOffset);
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: interpolateFix(rule.message, match.metavariables),
        file: filename,
        language,
        startLine: startPos.line,
        startColumn: startPos.column,
        endLine: endPos.line,
        endColumn: endPos.column,
        startOffset: match.startOffset,
        endOffset: match.endOffset,
        matchedCode: rule.mode === 'secrets' ? maskSecretMatch(matchedCode) : matchedCode,
        lineText: getLineText(params.code, lineStarts, startPos.line),
        metavariables: match.metavariables,
        fixSuggestion: rule.fix ? interpolateFix(rule.fix, match.metavariables) : undefined,
        entropy,
        metadata: rule.metadata,
      });
    }
  }

  findings.sort((a, b) => a.startLine - b.startLine || a.startColumn - b.startColumn);

  const summary: SemgrepScanSummary = {
    totalFindings: findings.length,
    errors: findings.filter((f) => f.severity === 'ERROR').length,
    warnings: findings.filter((f) => f.severity === 'WARNING').length,
    infos: findings.filter((f) => f.severity === 'INFO').length,
    fixable: findings.filter((f) => Boolean(f.fixSuggestion)).length,
    filesScanned: 1,
    rulesEvaluated,
    durationMs: Math.max(1, Date.now() - started),
  };

  return { findings, summary, parseErrors: [] };
}

export function applyAutofixes(
  code: string,
  findings: SemgrepFinding[],
  targetRuleId?: string
): { fixedCode: string; appliedCount: number } {
  const applicable = findings
    .filter(
      (f) =>
        Boolean(f.fixSuggestion) &&
        (!targetRuleId || f.ruleId === targetRuleId) &&
        f.startOffset >= 0 &&
        f.endOffset > f.startOffset
    )
    .sort((a, b) => b.startOffset - a.startOffset);

  let next = code;
  let lastAppliedStart = Infinity;
  let appliedCount = 0;

  for (const f of applicable) {
    if (f.endOffset > lastAppliedStart) continue; // skip overlapping edits
    next = next.slice(0, f.startOffset) + f.fixSuggestion! + next.slice(f.endOffset);
    lastAppliedStart = f.startOffset;
    appliedCount++;
  }

  return { fixedCode: next, appliedCount };
}

export function toSarifReport(
  findings: SemgrepFinding[],
  rules: SemgrepRule[],
  targetName = 'workspace'
): Record<string, unknown> {
  const ruleMap = new Map<string, SemgrepRule>();
  for (const r of rules) ruleMap.set(r.id, r);

  const usedRuleIds = Array.from(new Set(findings.map((f) => f.ruleId)));
  const driverRules = usedRuleIds.map((id) => {
    const r = ruleMap.get(id);
    const level =
      r?.severity === 'ERROR' ? 'error' : r?.severity === 'INFO' ? 'note' : 'warning';
    return {
      id,
      name: id,
      shortDescription: { text: r?.message || id },
      fullDescription: { text: r?.message || id },
      defaultConfiguration: { level },
      properties: {
        tags: [
          r?.metadata?.category || 'security',
          ...(Array.isArray(r?.metadata?.cwe)
            ? r!.metadata!.cwe
            : r?.metadata?.cwe
            ? [r.metadata.cwe]
            : []),
        ],
      },
    };
  });

  const results = findings.map((f) => ({
    ruleId: f.ruleId,
    level: f.severity === 'ERROR' ? 'error' : f.severity === 'INFO' ? 'note' : 'warning',
    message: { text: f.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: f.file,
            uriBaseId: '%SRCROOT%',
          },
          region: {
            startLine: f.startLine,
            startColumn: f.startColumn,
            endLine: f.endLine,
            endColumn: f.endColumn,
            snippet: { text: f.lineText },
          },
        },
      },
    ],
    fixes: f.fixSuggestion
      ? [
          {
            description: { text: `Apply Semgrep autofix: ${f.fixSuggestion}` },
            artifactChanges: [
              {
                artifactLocation: { uri: f.file },
                replacements: [
                  {
                    deletedRegion: {
                      startLine: f.startLine,
                      startColumn: f.startColumn,
                      endLine: f.endLine,
                      endColumn: f.endColumn,
                    },
                    insertedContent: { text: f.fixSuggestion },
                  },
                ],
              },
            ],
          },
        ]
      : undefined,
  }));

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Semgrep OSS Engine',
            informationUri: 'https://github.com/semgrep/semgrep',
            semanticVersion: '1.102.0-compat',
            rules: driverRules,
          },
        },
        invocations: [
          {
            executionSuccessful: true,
            workingDirectory: { uri: targetName },
          },
        ],
        results,
      },
    ],
  };
}

export const BUILTIN_SEMGREP_RULES: SemgrepRule[] = [
  {
    id: 'ts.security.eval-injection',
    languages: ['typescript', 'javascript'],
    severity: 'ERROR',
    message:
      'Avoid passing dynamic argument `$CODE` to eval(). Arbitrary code execution risk.',
    patterns: [
      { pattern: 'eval($CODE)' },
      { 'pattern-not': 'eval("...")' },
    ],
    metadata: {
      cwe: ['CWE-95: Eval Injection'],
      owasp: ['A03:2021 - Injection'],
      category: 'security',
      confidence: 'HIGH',
    },
    yamlSource: `rules:
  - id: ts.security.eval-injection
    languages: [typescript, javascript]
    severity: ERROR
    message: Avoid passing dynamic argument $CODE to eval(). Arbitrary code execution risk.
    patterns:
      - pattern: eval($CODE)
      - pattern-not: eval("...")
    metadata:
      cwe: CWE-95
      owasp: A03:2021 - Injection
      category: security`,
  },
  {
    id: 'ts.security.child-process-exec',
    languages: ['typescript', 'javascript'],
    severity: 'ERROR',
    message:
      'Command injection via shell execution on `$CMD`. Prefer execFile() or spawn() with an argument array.',
    patterns: [
      {
        'pattern-either': [
          { pattern: 'exec($CMD, ...)' },
          { pattern: 'execSync($CMD, ...)' },
          { pattern: 'child_process.exec($CMD, ...)' },
        ],
      },
      { 'pattern-not': 'exec("...", ...)' },
      { 'pattern-not': 'execSync("...", ...)' },
    ],
    fix: 'execFile($CMD, [])',
    metadata: {
      cwe: ['CWE-78: OS Command Injection'],
      owasp: ['A03:2021 - Injection'],
      category: 'security',
      confidence: 'HIGH',
    },
    yamlSource: `rules:
  - id: ts.security.child-process-exec
    languages: [typescript, javascript]
    severity: ERROR
    message: Command injection via shell execution on $CMD. Prefer execFile() or spawn().
    patterns:
      - pattern-either:
          - pattern: exec($CMD, ...)
          - pattern: execSync($CMD, ...)
      - pattern-not: exec("...", ...)
    fix: execFile($CMD, [])`,
  },
  {
    id: 'ts.security.dom-xss-taint',
    languages: ['typescript', 'javascript'],
    severity: 'ERROR',
    mode: 'taint',
    message:
      'Untrusted input flows into DOM sink `$EL.innerHTML = $VAL` without sanitization (DOM XSS).',
    'pattern-sources': [
      { pattern: 'req.query.$KEY' },
      { pattern: 'req.body.$KEY' },
      { pattern: 'window.location.search' },
      { pattern: 'new URLSearchParams(...)' },
    ],
    'pattern-sanitizers': [
      { pattern: 'DOMPurify.sanitize(...)' },
      { pattern: 'escapeHtml(...)' },
      { pattern: 'encodeURIComponent(...)' },
    ],
    'pattern-sinks': [
      { pattern: '$EL.innerHTML = $VAL' },
      { pattern: 'document.write($VAL)' },
    ],
    fix: '$EL.textContent = $VAL',
    metadata: {
      cwe: ['CWE-79: Cross-site Scripting (XSS)'],
      owasp: ['A03:2021 - Injection'],
      category: 'security',
      confidence: 'HIGH',
    },
    yamlSource: `rules:
  - id: ts.security.dom-xss-taint
    mode: taint
    languages: [typescript, javascript]
    severity: ERROR
    message: Untrusted input flows into DOM sink $EL.innerHTML = $VAL without sanitization.
    pattern-sources:
      - pattern: window.location.search
      - pattern: req.query.$KEY
    pattern-sanitizers:
      - pattern: DOMPurify.sanitize(...)
      - pattern: encodeURIComponent(...)
    pattern-sinks:
      - pattern: $EL.innerHTML = $VAL
    fix: $EL.textContent = $VAL`,
  },
  {
    id: 'ts.react.dangerously-set-innerhtml',
    languages: ['typescript', 'javascript'],
    severity: 'WARNING',
    message:
      'Using dangerouslySetInnerHTML exposes React components to XSS if `$HTML` is not sanitized.',
    pattern: 'dangerouslySetInnerHTML={{ __html: $HTML }}',
    metadata: {
      cwe: ['CWE-79: Cross-site Scripting (XSS)'],
      owasp: ['A03:2021 - Injection'],
      category: 'security',
    },
    yamlSource: `rules:
  - id: ts.react.dangerously-set-innerhtml
    languages: [typescript, javascript]
    severity: WARNING
    message: Using dangerouslySetInnerHTML exposes React components to XSS if $HTML is not sanitized.
    pattern: dangerouslySetInnerHTML={{ __html: $HTML }}`,
  },
  {
    id: 'ts.security.sql-template-concat',
    languages: ['typescript', 'javascript'],
    severity: 'ERROR',
    message:
      'Possible SQL injection via template interpolation in `$DB.query(...)`. Use parameterized placeholders.',
    patterns: [
      { pattern: '$DB.query($SQL, ...)' },
      { 'metavariable-regex': { metavariable: '$SQL', regex: '`[^`]*\\$\\{[^}]+\\}[^`]*`' } },
    ],
    metadata: {
      cwe: ['CWE-89: SQL Injection'],
      owasp: ['A03:2021 - Injection'],
      category: 'security',
    },
    yamlSource: `rules:
  - id: ts.security.sql-template-concat
    languages: [typescript, javascript]
    severity: ERROR
    message: Possible SQL injection via template interpolation in $DB.query(...).
    patterns:
      - pattern: $DB.query($SQL, ...)
      - metavariable-regex:
          metavariable: $SQL
          regex: '\`[^\`]*\\$\\{[^}]+\\}[^\`]*\`'`,
  },
  {
    id: 'ts.security.jwt-decode-unverified',
    languages: ['typescript', 'javascript'],
    severity: 'WARNING',
    message:
      'jwt.decode($TOKEN) extracts claims without verifying signature. Use jwt.verify($TOKEN, secret).',
    pattern: 'jwt.decode($TOKEN)',
    fix: 'jwt.verify($TOKEN, process.env.JWT_SECRET)',
    metadata: {
      cwe: ['CWE-347: Improper Verification of Cryptographic Signature'],
      owasp: ['A02:2021 - Cryptographic Failures'],
      category: 'security',
    },
    yamlSource: `rules:
  - id: ts.security.jwt-decode-unverified
    languages: [typescript, javascript]
    severity: WARNING
    message: jwt.decode($TOKEN) does not verify the signature. Use jwt.verify().
    pattern: jwt.decode($TOKEN)
    fix: jwt.verify($TOKEN, process.env.JWT_SECRET)`,
  },
  {
    id: 'ts.best-practice.window-alert',
    languages: ['typescript', 'javascript'],
    severity: 'INFO',
    message:
      'Avoid blocking browser dialogs (`window.alert` / `alert`). Render an inline UI notification instead.',
    'pattern-either': [
      { pattern: 'window.alert($MSG)' },
      { pattern: 'window.confirm($MSG)' },
    ],
    metadata: {
      category: 'best-practice',
    },
    yamlSource: `rules:
  - id: ts.best-practice.window-alert
    languages: [typescript, javascript]
    severity: INFO
    message: Avoid blocking browser dialogs (window.alert / window.confirm).
    pattern-either:
      - pattern: window.alert($MSG)
      - pattern: window.confirm($MSG)`,
  },
  {
    id: 'py.security.subprocess-shell-true',
    languages: ['python'],
    severity: 'ERROR',
    message:
      'subprocess call with shell=True allows OS command injection. Set shell=False and pass a list.',
    'pattern-either': [
      { pattern: 'subprocess.run($CMD, ..., shell=True, ...)' },
      { pattern: 'subprocess.Popen($CMD, ..., shell=True, ...)' },
    ],
    fix: 'subprocess.run($CMD, shell=False)',
    metadata: {
      cwe: ['CWE-78: OS Command Injection'],
      owasp: ['A03:2021 - Injection'],
      category: 'security',
    },
    yamlSource: `rules:
  - id: py.security.subprocess-shell-true
    languages: [python]
    severity: ERROR
    message: subprocess call with shell=True allows OS command injection.
    pattern-either:
      - pattern: subprocess.run($CMD, ..., shell=True, ...)
      - pattern: subprocess.Popen($CMD, ..., shell=True, ...)
    fix: subprocess.run($CMD, shell=False)`,
  },
  {
    id: 'py.security.yaml-unsafe-load',
    languages: ['python'],
    severity: 'ERROR',
    message:
      'yaml.load($DATA) without SafeLoader can execute arbitrary Python objects. Use yaml.safe_load($DATA).',
    patterns: [
      { pattern: 'yaml.load($DATA)' },
    ],
    fix: 'yaml.safe_load($DATA)',
    metadata: {
      cwe: ['CWE-502: Deserialization of Untrusted Data'],
      owasp: ['A08:2021 - Software and Data Integrity Failures'],
      category: 'security',
    },
    yamlSource: `rules:
  - id: py.security.yaml-unsafe-load
    languages: [python]
    severity: ERROR
    message: yaml.load($DATA) without SafeLoader can execute arbitrary code.
    pattern: yaml.load($DATA)
    fix: yaml.safe_load($DATA)`,
  },
  {
    id: 'py.security.pickle-loads',
    languages: ['python'],
    severity: 'ERROR',
    message:
      'pickle.loads($DATA) can trigger remote code execution on untrusted input. Prefer JSON serialization.',
    pattern: 'pickle.loads($DATA)',
    fix: 'json.loads($DATA)',
    metadata: {
      cwe: ['CWE-502: Deserialization of Untrusted Data'],
      category: 'security',
    },
    yamlSource: `rules:
  - id: py.security.pickle-loads
    languages: [python]
    severity: ERROR
    message: pickle.loads($DATA) can trigger RCE on untrusted input.
    pattern: pickle.loads($DATA)
    fix: json.loads($DATA)`,
  },
  {
    id: 'go.security.exec-command-shell',
    languages: ['go'],
    severity: 'ERROR',
    message:
      'Passing `$CMD` to sh -c via exec.Command risks shell injection. Pass binary and arguments directly.',
    pattern: 'exec.Command("sh", "-c", $CMD)',
    metadata: {
      cwe: ['CWE-78: OS Command Injection'],
      category: 'security',
    },
    yamlSource: `rules:
  - id: go.security.exec-command-shell
    languages: [go]
    severity: ERROR
    message: Passing $CMD to sh -c via exec.Command risks shell injection.
    pattern: exec.Command("sh", "-c", $CMD)`,
  },
  {
    id: 'secrets.generic.hardcoded-credential',
    languages: ['generic'],
    severity: 'ERROR',
    mode: 'secrets',
    message:
      'Potential hardcoded secret or private key detected (verified via Shannon entropy & signature).',
    'pattern-regex':
      '(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|sk-(?:live|test|proj)-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)',
    metadata: {
      cwe: ['CWE-798: Use of Hard-coded Credentials'],
      owasp: ['A07:2021 - Identification and Authentication Failures'],
      category: 'secrets',
    },
    yamlSource: `rules:
  - id: secrets.generic.hardcoded-credential
    mode: secrets
    languages: [generic]
    severity: ERROR
    message: Potential hardcoded secret or private key detected.
    pattern-regex: "(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|sk-(?:live|test|proj)-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)"`,
  },
];

export interface PlaygroundSamplePreset {
  id: string;
  label: string;
  filename: string;
  language: SemgrepLanguage;
  ruleYaml: string;
  code: string;
}

export const SEMGREP_PLAYGROUND_SAMPLES: PlaygroundSamplePreset[] = [
  {
    id: 'ts-taint-xss',
    label: 'TypeScript DOM XSS (Taint)',
    filename: 'profileRenderer.ts',
    language: 'typescript',
    ruleYaml: BUILTIN_SEMGREP_RULES[2].yamlSource!,
    code: `export function renderBioPreview(container: HTMLElement) {
  const params = new URLSearchParams(window.location.search);
  const rawBio = params.get('bio') || '';

  // Safe path: sanitized before DOM assignment
  const cleanBanner = DOMPurify.sanitize(rawBio);
  const safeBannerEl = document.getElementById('safe-banner');
  if (safeBannerEl) {
    safeBannerEl.innerHTML = cleanBanner;
  }

  // Vulnerable taint path: flows from URLSearchParams -> rawBio -> innerHTML
  const unsanitizedCopy = rawBio;
  container.innerHTML = unsanitizedCopy;
}
`,
  },
  {
    id: 'ts-injection-suite',
    label: 'Node.js Injection + Secrets',
    filename: 'billingController.ts',
    language: 'typescript',
    ruleYaml: `rules:
  - id: ts.security.eval-injection
    languages: [typescript, javascript]
    severity: ERROR
    message: Avoid passing dynamic argument $CODE to eval().
    patterns:
      - pattern: eval($CODE)
      - pattern-not: eval("...")

  - id: ts.security.jwt-decode-unverified
    languages: [typescript, javascript]
    severity: WARNING
    message: jwt.decode($TOKEN) skips signature verification. Use jwt.verify().
    pattern: jwt.decode($TOKEN)
    fix: jwt.verify($TOKEN, process.env.JWT_SECRET)

  - id: ts.security.sql-template-concat
    languages: [typescript, javascript]
    severity: ERROR
    message: SQL template interpolation detected in $DB.query($SQL).
    patterns:
      - pattern: $DB.query($SQL, ...)
      - metavariable-regex:
          metavariable: $SQL
          regex: '\`[^\`]*\\$\\{[^}]+\\}[^\`]*\`'
`,
    code: `import jwt from 'jsonwebtoken';

const DEMO_STRIPE_KEY = "sk-live-9xKmP2vQw7ZrT4nB8yHcL5fD";

export async function handleBillingLookup(req: any, db: any) {
  const claims = jwt.decode(req.headers.authorization);
  const formula = req.body.discountExpr;
  const discount = eval(formula);

  const userId = req.query.userId;
  const rows = await db.query(\`SELECT * FROM invoices WHERE user_id = '\${userId}'\`);
  return { claims, discount, rows };
}
`,
  },
  {
    id: 'python-deserialization',
    label: 'Python Subprocess & YAML',
    filename: 'importer.py',
    language: 'python',
    ruleYaml: `rules:
  - id: py.security.subprocess-shell-true
    languages: [python]
    severity: ERROR
    message: subprocess call with shell=True risks OS command injection.
    pattern-either:
      - pattern: subprocess.run($CMD, ..., shell=True, ...)
      - pattern: subprocess.Popen($CMD, ..., shell=True, ...)
    fix: subprocess.run($CMD, shell=False)

  - id: py.security.yaml-unsafe-load
    languages: [python]
    severity: ERROR
    message: yaml.load($DATA) without SafeLoader can execute arbitrary code.
    pattern: yaml.load($DATA)
    fix: yaml.safe_load($DATA)
`,
    code: `import subprocess
import yaml

def import_bundle(user_cmd: str, raw_config: str):
    cfg = yaml.load(raw_config)
    subprocess.run(user_cmd, check=True, shell=True)
    return cfg
`,
  },
  {
    id: 'go-cmd-injection',
    label: 'Go Shell Execution',
    filename: 'runner.go',
    language: 'go',
    ruleYaml: BUILTIN_SEMGREP_RULES[10].yamlSource!,
    code: `package main

import "os/exec"

func runDiagnostic(userFlag string) ([]byte, error) {
	cmd := exec.Command("sh", "-c", "ping -c 1 " + userFlag)
	return cmd.CombinedOutput()
}
`,
  },
];
