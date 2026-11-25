import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  applyAutofixes,
  BUILTIN_SEMGREP_RULES,
  detectLanguageFromFilename,
  parseSemgrepYaml,
  scanCodeWithRules,
  toSarifReport,
  type SemgrepFinding,
  type SemgrepRule,
} from '../lib/semgrepEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const router = Router();

function loadWorkspaceSemgrepConfig(): {
  rules: SemgrepRule[];
  errors: string[];
  configExists: boolean;
} {
  const configPath = path.join(WORKSPACE_ROOT, '.semgrep.yml');
  if (!fs.existsSync(configPath)) {
    return { rules: [], errors: [], configExists: false };
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = parseSemgrepYaml(raw);
    return { ...parsed, configExists: true };
  } catch (err) {
    return {
      rules: [],
      errors: [err instanceof Error ? err.message : 'Unable to read .semgrep.yml'],
      configExists: true,
    };
  }
}

router.get('/rules', (_req: Request, res: Response) => {
  const localConfig = loadWorkspaceSemgrepConfig();
  return res.json({
    builtinRules: BUILTIN_SEMGREP_RULES,
    workspaceRules: localConfig.rules,
    workspaceConfigExists: localConfig.configExists,
    workspaceParseErrors: localConfig.errors,
  });
});

const scanBodySchema = z.object({
  code: z.string().max(250_000),
  filename: z.string().trim().min(1).max(200).optional(),
  language: z.string().trim().min(1).max(40).optional(),
  ruleYaml: z.string().max(100_000).optional(),
  includeBuiltinSecrets: z.boolean().optional(),
  includeBuiltinDefaults: z.boolean().optional(),
});

router.post('/scan', (req: Request, res: Response) => {
  const parsed = scanBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid scan request payload.',
    });
  }

  const {
    code,
    filename = 'snippet.ts',
    language,
    ruleYaml,
    includeBuiltinSecrets = true,
    includeBuiltinDefaults = false,
  } = parsed.data;

  const activeRules: SemgrepRule[] = [];
  const parseErrors: string[] = [];

  if (ruleYaml && ruleYaml.trim()) {
    const yamlRes = parseSemgrepYaml(ruleYaml);
    activeRules.push(...yamlRes.rules);
    parseErrors.push(...yamlRes.errors);
  }

  if (includeBuiltinDefaults) {
    for (const r of BUILTIN_SEMGREP_RULES) {
      if (!activeRules.some((existing) => existing.id === r.id)) {
        activeRules.push(r);
      }
    }
  } else if (includeBuiltinSecrets) {
    const secretsRule = BUILTIN_SEMGREP_RULES.find((r) => r.mode === 'secrets');
    if (secretsRule && !activeRules.some((existing) => existing.id === secretsRule.id)) {
      activeRules.push(secretsRule);
    }
  }

  const result = scanCodeWithRules({
    code,
    filename,
    language: language || detectLanguageFromFilename(filename),
    rules: activeRules,
  });

  const sarif = toSarifReport(result.findings, activeRules, filename);

  return res.json({
    ...result,
    parseErrors,
    sarif,
  });
});

const autofixBodySchema = z.object({
  code: z.string().max(250_000),
  findings: z.array(
    z.object({
      ruleId: z.string(),
      startOffset: z.number().int().min(0),
      endOffset: z.number().int().min(0),
      fixSuggestion: z.string().optional(),
    })
  ),
  targetRuleId: z.string().optional(),
});

router.post('/autofix', (req: Request, res: Response) => {
  const parsed = autofixBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid autofix payload.',
    });
  }

  const result = applyAutofixes(
    parsed.data.code,
    parsed.data.findings as SemgrepFinding[],
    parsed.data.targetRuleId
  );

  return res.json(result);
});

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dev-dist',
  'android',
  'release-assets',
  'coverage',
  '.aistudio',
]);

const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.mjs',
  '.py',
  '.go',
  '.java',
  '.yml',
  '.yaml',
]);

function collectWorkspaceFiles(dir: string, out: string[], maxFiles = 200) {
  if (out.length >= maxFiles) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (out.length >= maxFiles) break;
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectWorkspaceFiles(fullPath, out, maxFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
      // Avoid self-scanning rule signature templates inside semgrepEngine.ts
      const rel = path.relative(WORKSPACE_ROOT, fullPath);
      if (rel === 'src/lib/semgrepEngine.ts' || rel === '.semgrep.yml') continue;
      out.push(fullPath);
    }
  }
}

const workspaceScanSchema = z.object({
  ruleYaml: z.string().max(100_000).optional(),
  includeWorkspaceRules: z.boolean().optional(),
});

router.post('/scan-workspace', (req: Request, res: Response) => {
  const parsed = workspaceScanSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid workspace scan options.' });
  }

  const started = Date.now();
  const activeRules: SemgrepRule[] = [...BUILTIN_SEMGREP_RULES];
  const parseErrors: string[] = [];

  if (parsed.data.includeWorkspaceRules !== false) {
    const localCfg = loadWorkspaceSemgrepConfig();
    parseErrors.push(...localCfg.errors);
    for (const r of localCfg.rules) {
      if (!activeRules.some((existing) => existing.id === r.id)) {
        activeRules.push(r);
      }
    }
  }

  if (parsed.data.ruleYaml && parsed.data.ruleYaml.trim()) {
    const customRes = parseSemgrepYaml(parsed.data.ruleYaml);
    parseErrors.push(...customRes.errors);
    for (const r of customRes.rules) {
      const idx = activeRules.findIndex((existing) => existing.id === r.id);
      if (idx >= 0) activeRules[idx] = r;
      else activeRules.push(r);
    }
  }

  const files: string[] = [];
  const srcDir = path.join(WORKSPACE_ROOT, 'src');
  if (fs.existsSync(srcDir)) collectWorkspaceFiles(srcDir, files, 180);
  const serverEntry = path.join(WORKSPACE_ROOT, 'server.ts');
  if (fs.existsSync(serverEntry)) files.push(serverEntry);

  const allFindings: SemgrepFinding[] = [];
  for (const absPath of files) {
    try {
      const stat = fs.statSync(absPath);
      if (stat.size > 200_000) continue;
      const content = fs.readFileSync(absPath, 'utf8');
      const relPath = path.relative(WORKSPACE_ROOT, absPath).replace(/\\/g, '/');
      const resScan = scanCodeWithRules({
        code: content,
        filename: relPath,
        rules: activeRules,
      });
      allFindings.push(...resScan.findings);
    } catch {
      // skip unreadable file
    }
  }

  allFindings.sort(
    (a, b) =>
      (a.severity === 'ERROR' ? 0 : a.severity === 'WARNING' ? 1 : 2) -
        (b.severity === 'ERROR' ? 0 : b.severity === 'WARNING' ? 1 : 2) ||
      a.file.localeCompare(b.file) ||
      a.startLine - b.startLine
  );

  const summary = {
    totalFindings: allFindings.length,
    errors: allFindings.filter((f) => f.severity === 'ERROR').length,
    warnings: allFindings.filter((f) => f.severity === 'WARNING').length,
    infos: allFindings.filter((f) => f.severity === 'INFO').length,
    fixable: allFindings.filter((f) => Boolean(f.fixSuggestion)).length,
    filesScanned: files.length,
    rulesEvaluated: activeRules.length,
    durationMs: Math.max(1, Date.now() - started),
  };

  const sarif = toSarifReport(allFindings, activeRules, 'workspace');

  return res.json({
    findings: allFindings,
    summary,
    parseErrors,
    sarif,
    scannedFiles: files.map((f) => path.relative(WORKSPACE_ROOT, f).replace(/\\/g, '/')),
  });
});

export default router;
