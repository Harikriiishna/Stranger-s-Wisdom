import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  FileSearch,
  FolderSearch,
  Info,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { semgrepApi } from '../lib/api';
import {
  applyAutofixes,
  BUILTIN_SEMGREP_RULES,
  parseSemgrepYaml,
  scanCodeWithRules,
  SEMGREP_PLAYGROUND_SAMPLES,
  toSarifReport,
  type SemgrepFinding,
  type SemgrepLanguage,
  type SemgrepRule,
  type SemgrepScanSummary,
  type SemgrepSeverity,
} from '../lib/semgrepEngine';

type WorkbenchTab = 'playground' | 'workspace' | 'registry';
type SeverityFilter = 'ALL' | SemgrepSeverity;

function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SeverityLabel({ severity }: { severity: SemgrepSeverity }) {
  if (severity === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
        <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
        Error
      </span>
    );
  }
  if (severity === 'WARNING') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">
      <Info className="h-3.5 w-3.5 shrink-0" />
      Info
    </span>
  );
}

export function SemgrepWorkbenchPage() {
  const initialSample = SEMGREP_PLAYGROUND_SAMPLES[0];

  const [activeTab, setActiveTab] = useState<WorkbenchTab>('playground');

  // Playground state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(initialSample.id);
  const [autoScanSeq, setAutoScanSeq] = useState<number>(0);
  const [filename, setFilename] = useState<string>(initialSample.filename);
  const [language, setLanguage] = useState<SemgrepLanguage>(initialSample.language);
  const [code, setCode] = useState<string>(initialSample.code);
  const [ruleYaml, setRuleYaml] = useState<string>(initialSample.ruleYaml);
  const [includeBuiltinSecrets, setIncludeBuiltinSecrets] = useState<boolean>(true);
  const [includeBuiltinDefaults, setIncludeBuiltinDefaults] = useState<boolean>(false);

  const [playgroundFindings, setPlaygroundFindings] = useState<SemgrepFinding[]>([]);
  const [playgroundSummary, setPlaygroundSummary] = useState<SemgrepScanSummary | null>(null);
  const [playgroundSarif, setPlaygroundSarif] = useState<Record<string, unknown> | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [playgroundNotice, setPlaygroundNotice] = useState<string | null>(null);
  const [isScanningPlayground, setIsScanningPlayground] = useState<boolean>(false);

  // Workspace scan state
  const [workspaceFindings, setWorkspaceFindings] = useState<SemgrepFinding[]>([]);
  const [workspaceSummary, setWorkspaceSummary] = useState<SemgrepScanSummary | null>(null);
  const [workspaceSarif, setWorkspaceSarif] = useState<Record<string, unknown> | null>(null);
  const [workspaceFilesCount, setWorkspaceFilesCount] = useState<number>(0);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isScanningWorkspace, setIsScanningWorkspace] = useState<boolean>(false);
  const [workspaceSeverityFilter, setWorkspaceSeverityFilter] = useState<SeverityFilter>('ALL');
  const [workspaceSearch, setWorkspaceSearch] = useState<string>('');

  // Registry state
  const [builtinRules, setBuiltinRules] = useState<SemgrepRule[]>(BUILTIN_SEMGREP_RULES);
  const [workspaceRules, setWorkspaceRules] = useState<SemgrepRule[]>([]);
  const [registrySearch, setRegistrySearch] = useState<string>('');
  const [registryLangFilter, setRegistryLangFilter] = useState<string>('all');

  const runLocalScan = useCallback(
    (
      targetCode: string,
      targetFile: string,
      targetLang: SemgrepLanguage,
      targetYaml: string,
      withSecrets: boolean,
      withDefaults: boolean
    ) => {
      const parsed = targetYaml.trim()
        ? parseSemgrepYaml(targetYaml)
        : { rules: [], errors: [] };
      const rules: SemgrepRule[] = [...parsed.rules];
      if (withDefaults) {
        for (const r of BUILTIN_SEMGREP_RULES) {
          if (!rules.some((x) => x.id === r.id)) rules.push(r);
        }
      } else if (withSecrets) {
        const sec = BUILTIN_SEMGREP_RULES.find((r) => r.mode === 'secrets');
        if (sec && !rules.some((x) => x.id === sec.id)) rules.push(sec);
      }
      const res = scanCodeWithRules({
        code: targetCode,
        filename: targetFile,
        language: targetLang,
        rules,
      });
      const sarif = toSarifReport(res.findings, rules, targetFile);
      return { ...res, parseErrors: parsed.errors, sarif };
    },
    []
  );

  const handleRunPlaygroundScan = useCallback(async () => {
    setIsScanningPlayground(true);
    setPlaygroundNotice(null);
    try {
      const res = await semgrepApi.scan({
        code,
        filename,
        language,
        ruleYaml,
        includeBuiltinSecrets,
        includeBuiltinDefaults,
      });
      setPlaygroundFindings(res.findings);
      setPlaygroundSummary(res.summary);
      setParseErrors(res.parseErrors);
      setPlaygroundSarif(res.sarif);
    } catch {
      const local = runLocalScan(
        code,
        filename,
        language,
        ruleYaml,
        includeBuiltinSecrets,
        includeBuiltinDefaults
      );
      setPlaygroundFindings(local.findings);
      setPlaygroundSummary(local.summary);
      setParseErrors(local.parseErrors);
      setPlaygroundSarif(local.sarif);
    } finally {
      setIsScanningPlayground(false);
    }
  }, [
    code,
    filename,
    includeBuiltinDefaults,
    includeBuiltinSecrets,
    language,
    ruleYaml,
    runLocalScan,
  ]);

  useEffect(() => {
    void handleRunPlaygroundScan();
  }, [autoScanSeq]); // auto-scan when switching sample presets or loading from Registry

  useEffect(() => {
    semgrepApi
      .rules()
      .then((res) => {
        if (res.builtinRules?.length) setBuiltinRules(res.builtinRules);
        if (res.workspaceRules?.length) setWorkspaceRules(res.workspaceRules);
      })
      .catch(() => {
        // Fallback silently to local BUILTIN_SEMGREP_RULES
      });
  }, []);

  const handleSelectPreset = (presetId: string) => {
    const preset = SEMGREP_PLAYGROUND_SAMPLES.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setFilename(preset.filename);
    setLanguage(preset.language);
    setCode(preset.code);
    setRuleYaml(preset.ruleYaml);
    setPlaygroundNotice(null);
    setAutoScanSeq((n) => n + 1);
  };

  const handleApplyAutofix = async (targetRuleId?: string) => {
    const fixableTargets = playgroundFindings.filter(
      (f) => f.fixSuggestion && (!targetRuleId || f.ruleId === targetRuleId)
    );
    if (fixableTargets.length === 0) return;

    let fixedCode = code;
    let appliedCount = 0;
    try {
      const res = await semgrepApi.autofix({
        code,
        findings: fixableTargets,
        targetRuleId,
      });
      fixedCode = res.fixedCode;
      appliedCount = res.appliedCount;
    } catch {
      const local = applyAutofixes(code, fixableTargets, targetRuleId);
      fixedCode = local.fixedCode;
      appliedCount = local.appliedCount;
    }

    if (appliedCount > 0) {
      setCode(fixedCode);
      setPlaygroundNotice(
        `Applied ${appliedCount} autofix${appliedCount === 1 ? '' : 'es'}. Re-scanning updated code.`
      );
      const rescanned = runLocalScan(
        fixedCode,
        filename,
        language,
        ruleYaml,
        includeBuiltinSecrets,
        includeBuiltinDefaults
      );
      setPlaygroundFindings(rescanned.findings);
      setPlaygroundSummary(rescanned.summary);
      setParseErrors(rescanned.parseErrors);
      setPlaygroundSarif(rescanned.sarif);
    }
  };

  const handleRunWorkspaceScan = async () => {
    setIsScanningWorkspace(true);
    setWorkspaceError(null);
    try {
      const res = await semgrepApi.scanWorkspace({ includeWorkspaceRules: true });
      setWorkspaceFindings(res.findings);
      setWorkspaceSummary(res.summary);
      setWorkspaceSarif(res.sarif);
      setWorkspaceFilesCount(res.scannedFiles.length);
    } catch (err) {
      setWorkspaceError(
        err instanceof Error
          ? err.message
          : 'Unable to scan workspace files from the server.'
      );
    } finally {
      setIsScanningWorkspace(false);
    }
  };

  const handleLoadRuleInPlayground = (rule: SemgrepRule) => {
    const lang = (rule.languages[0] as SemgrepLanguage) || 'typescript';
    const ext =
      lang === 'python'
        ? 'py'
        : lang === 'go'
        ? 'go'
        : lang === 'java'
        ? 'java'
        : lang === 'yaml'
        ? 'yml'
        : 'ts';
    setSelectedPresetId(null);
    setLanguage(lang === 'generic' ? 'typescript' : lang);
    setFilename(`sample.${ext}`);
    if (rule.yamlSource) {
      setRuleYaml(rule.yamlSource);
    }
    setActiveTab('playground');
    setPlaygroundNotice(`Loaded rule "${rule.id}" into Playground.`);
    setAutoScanSeq((n) => n + 1);
  };

  const flaggedLines = useMemo(
    () => new Set(playgroundFindings.map((f) => f.startLine)),
    [playgroundFindings]
  );

  const codeLineCount = useMemo(() => Math.max(12, code.split('\n').length), [code]);

  const filteredWorkspaceFindings = useMemo(() => {
    const q = workspaceSearch.trim().toLowerCase();
    return workspaceFindings.filter((f) => {
      if (workspaceSeverityFilter !== 'ALL' && f.severity !== workspaceSeverityFilter) {
        return false;
      }
      if (!q) return true;
      return (
        f.file.toLowerCase().includes(q) ||
        f.ruleId.toLowerCase().includes(q) ||
        f.message.toLowerCase().includes(q)
      );
    });
  }, [workspaceFindings, workspaceSearch, workspaceSeverityFilter]);

  const combinedRegistryRules = useMemo(() => {
    const merged = [...workspaceRules];
    for (const r of builtinRules) {
      if (!merged.some((m) => m.id === r.id)) merged.push(r);
    }
    const q = registrySearch.trim().toLowerCase();
    return merged.filter((r) => {
      if (
        registryLangFilter !== 'all' &&
        !r.languages.map((l) => l.toLowerCase()).includes(registryLangFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q) ||
        JSON.stringify(r.metadata || {}).toLowerCase().includes(q)
      );
    });
  }, [builtinRules, registryLangFilter, registrySearch, workspaceRules]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200/80 dark:border-indigo-950/80 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-cyan-700 dark:text-cyan-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Semgrep Static Analysis</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Code Security & Rule Workbench
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Pattern-based SAST with metavariable unification, ellipsis operators, intraprocedural
              taint tracking, secret entropy checks, autofix patches, and SARIF 2.1.0 export.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeTab === 'playground' && (
              <>
                <button
                  type="button"
                  onClick={() => void handleRunPlaygroundScan()}
                  disabled={isScanningPlayground}
                  className="sw-btn-primary inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <Play className="h-4 w-4 shrink-0" />
                  <span>{isScanningPlayground ? 'Scanning...' : 'Run Scan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    playgroundSarif &&
                    downloadJsonFile('semgrep-playground.sarif', playgroundSarif)
                  }
                  disabled={!playgroundSarif}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-300 dark:border-indigo-800 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Export SARIF</span>
                </button>
              </>
            )}

            {activeTab === 'workspace' && (
              <>
                <button
                  type="button"
                  onClick={() => void handleRunWorkspaceScan()}
                  disabled={isScanningWorkspace}
                  className="sw-btn-primary inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 shrink-0 ${isScanningWorkspace ? 'animate-spin' : ''}`}
                  />
                  <span>{isScanningWorkspace ? 'Scanning Repo...' : 'Scan Workspace'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    workspaceSarif &&
                    downloadJsonFile('semgrep-workspace.sarif', workspaceSarif)
                  }
                  disabled={!workspaceSarif}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-300 dark:border-indigo-800 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Export SARIF</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Semgrep workbench views"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/70 dark:bg-[#0D1326] p-1 border border-slate-200 dark:border-indigo-950/80"
        >
          {[
            { id: 'playground' as const, label: 'Rule Playground', icon: Code2 },
            { id: 'workspace' as const, label: 'Repository Scan', icon: FolderSearch },
            { id: 'registry' as const, label: 'Rule Registry', icon: FileSearch },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white dark:bg-[#18213D] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* PLAYGROUND TAB */}
        {activeTab === 'playground' && (
          <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
                    Sample Presets:
                  </span>
                  {SEMGREP_PLAYGROUND_SAMPLES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        selectedPresetId === preset.id
                          ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40'
                          : 'border border-slate-200 dark:border-indigo-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBuiltinSecrets}
                      onChange={(e) => setIncludeBuiltinSecrets(e.target.checked)}
                      className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>Secret Entropy Scanner</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBuiltinDefaults}
                      onChange={(e) => setIncludeBuiltinDefaults(e.target.checked)}
                      className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>Include All Built-in Rules</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-indigo-950/60">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="shrink-0 font-medium">Target File</span>
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="shrink-0 font-medium">Language</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as SemgrepLanguage)}
                    className="w-full rounded-lg border border-slate-200 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="typescript">TypeScript</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="go">Go</option>
                    <option value="java">Java</option>
                    <option value="yaml">YAML</option>
                    <option value="generic">Generic</option>
                  </select>
                </label>
              </div>
            </div>

            {playgroundNotice && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {playgroundNotice}
                </span>
                <button
                  type="button"
                  onClick={() => setPlaygroundNotice(null)}
                  className="text-xs underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {parseErrors.length > 0 && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-semibold">YAML Rule Parse Warnings</div>
                {parseErrors.map((err, idx) => (
                  <div key={idx} className="font-mono">
                    {err}
                  </div>
                ))}
              </div>
            )}

            {/* Split Code + Rule YAML Editors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              {/* Target Code Editor */}
              <div className="flex flex-col rounded-2xl border border-slate-200/80 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/70 dark:border-indigo-950/70">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Target Source Code
                  </span>
                  <span className="font-tabular text-xs text-slate-500 dark:text-slate-400">
                    {code.split('\n').length} lines · {flaggedLines.size} flagged
                  </span>
                </div>
                <div className="flex flex-1 min-h-[300px] max-h-[440px] overflow-y-auto bg-slate-50 dark:bg-[#070B19]">
                  <div
                    aria-hidden="true"
                    className="select-none py-3 px-2.5 text-right font-tabular text-[12.5px] leading-[1.6] text-slate-400 dark:text-slate-600 border-r border-slate-200/70 dark:border-indigo-950/70 shrink-0"
                  >
                    {Array.from({ length: codeLineCount }, (_, idx) => {
                      const ln = idx + 1;
                      const isFlagged = flaggedLines.has(ln);
                      return (
                        <div
                          key={ln}
                          className={
                            isFlagged
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : undefined
                          }
                        >
                          {ln}
                        </div>
                      );
                    })}
                  </div>
                  <textarea
                    aria-label="Target source code"
                    value={code}
                    rows={codeLineCount}
                    onChange={(e) => setCode(e.target.value)}
                    spellCheck={false}
                    className="w-full flex-1 resize-none overflow-hidden bg-transparent p-3 font-mono text-[12.5px] leading-[1.6] text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Semgrep Rule YAML Editor */}
              <div className="flex flex-col rounded-2xl border border-slate-200/80 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/70 dark:border-indigo-950/70">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Semgrep Rule Configuration (YAML)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Supports $METAVAR, ..., patterns, taint, fix
                  </span>
                </div>
                <textarea
                  aria-label="Semgrep rule YAML"
                  value={ruleYaml}
                  onChange={(e) => setRuleYaml(e.target.value)}
                  spellCheck={false}
                  className="w-full flex-1 min-h-[300px] max-h-[440px] resize-y bg-slate-50 dark:bg-[#070B19] p-3 font-mono text-[12.5px] leading-[1.6] text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Findings & Metrics Strip */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70 dark:border-indigo-950/70">
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Findings
                  </span>
                  {playgroundSummary && (
                    <span className="font-tabular text-slate-500 dark:text-slate-400">
                      {playgroundSummary.totalFindings} total · {playgroundSummary.errors} errors ·{' '}
                      {playgroundSummary.warnings} warnings · {playgroundSummary.fixable} fixable ·{' '}
                      {playgroundSummary.durationMs} ms
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {playgroundSummary && playgroundSummary.fixable > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleApplyAutofix()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600/25 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Wrench className="h-3.5 w-3.5 shrink-0" />
                      <span>Apply All Autofixes ({playgroundSummary.fixable})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      downloadJsonFile('semgrep-findings.json', {
                        summary: playgroundSummary,
                        findings: playgroundFindings,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-indigo-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>

              {playgroundFindings.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No findings matched the active rules in this snippet. Edit the code or click Run
                  Scan to evaluate new rules.
                </div>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-indigo-950/70">
                  {playgroundFindings.map((finding, idx) => (
                    <div key={`${finding.ruleId}-${finding.startOffset}-${idx}`} className="p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <SeverityLabel severity={finding.severity} />
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {finding.ruleId}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="font-tabular text-slate-500 dark:text-slate-400">
                            {finding.file}:{finding.startLine}:{finding.startColumn}
                          </span>
                          {typeof finding.entropy === 'number' && (
                            <>
                              <span aria-hidden="true" className="text-slate-400">·</span>
                              <span className="font-tabular text-slate-500 dark:text-slate-400">
                                Entropy {finding.entropy} bits/char
                              </span>
                            </>
                          )}
                        </div>

                        {finding.fixSuggestion && (
                          <button
                            type="button"
                            onClick={() => void handleApplyAutofix(finding.ruleId)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Wrench className="h-3 w-3 shrink-0" />
                            <span>Apply Fix</span>
                          </button>
                        )}
                      </div>

                      <p className="text-sm text-slate-800 dark:text-slate-200">
                        {finding.message}
                      </p>

                      <pre className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-indigo-950/70 bg-slate-50 dark:bg-[#070B19] px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">
                        <span className="font-tabular text-slate-400 mr-3 select-none">
                          {finding.startLine}
                        </span>
                        {finding.lineText}
                      </pre>

                      {Object.keys(finding.metavariables).length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            Metavariables:
                          </span>
                          {Object.entries(finding.metavariables).map(([k, v]) => (
                            <span key={k} className="font-mono">
                              {k} = <span className="text-cyan-700 dark:text-cyan-300">{v}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {finding.taintTrace && finding.taintTrace.length > 0 && (
                        <div className="rounded-xl bg-slate-50 dark:bg-[#070B19] border border-slate-200/70 dark:border-indigo-950/70 p-3 space-y-1.5">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Taint Dataflow Trace
                          </div>
                          {finding.taintTrace.map((step, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400"
                            >
                              <span className="uppercase text-[11px] font-semibold text-cyan-700 dark:text-cyan-400">
                                {step.kind}
                              </span>
                              <span className="font-tabular">L{step.line}:{step.column}</span>
                              <span aria-hidden="true">→</span>
                              <span className="text-slate-900 dark:text-slate-200">{step.snippet}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {finding.fixSuggestion && (
                        <div className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
                          Suggested autofix: {finding.fixSuggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* REPOSITORY WORKSPACE SCAN TAB */}
        {activeTab === 'workspace' && (
          <div className="space-y-4">
            {workspaceSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: 'Files Scanned', value: workspaceFilesCount },
                  { label: 'Rules Evaluated', value: workspaceSummary.rulesEvaluated },
                  { label: 'Errors', value: workspaceSummary.errors },
                  { label: 'Warnings', value: workspaceSummary.warnings },
                  { label: 'Scan Time', value: `${workspaceSummary.durationMs} ms` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-slate-200/80 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] px-4 py-3"
                  >
                    <div className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</div>
                    <div className="mt-1 font-tabular text-lg font-semibold text-slate-900 dark:text-white">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {workspaceError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                {workspaceError}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200/80 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70 dark:border-indigo-950/70">
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-[#070B19] p-1">
                  {(['ALL', 'ERROR', 'WARNING', 'INFO'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setWorkspaceSeverityFilter(sev)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        workspaceSeverityFilter === sev
                          ? 'bg-white dark:bg-[#18213D] text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sev === 'ALL' ? 'All Severities' : sev}
                    </button>
                  ))}
                </div>

                <label className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={workspaceSearch}
                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                    placeholder="Filter by file or rule ID..."
                    className="w-full rounded-lg border border-slate-200 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </label>
              </div>

              {!workspaceSummary && !isScanningWorkspace ? (
                <div className="px-6 py-10 text-center space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Scan the project’s TypeScript, React, Express, and `.semgrep.yml` configuration
                    files directly on the server and export a SARIF 2.1.0 report.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRunWorkspaceScan()}
                    className="sw-btn-primary inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 cursor-pointer whitespace-nowrap"
                  >
                    <FolderSearch className="h-4 w-4 shrink-0" />
                    <span>Run Repository Scan</span>
                  </button>
                </div>
              ) : filteredWorkspaceFindings.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {isScanningWorkspace
                    ? 'Scanning repository source files...'
                    : 'No findings match the current filter across scanned workspace files.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-indigo-950/70">
                  {filteredWorkspaceFindings.map((f, i) => (
                    <div key={`${f.file}-${f.ruleId}-${f.startOffset}-${i}`} className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <SeverityLabel severity={f.severity} />
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {f.file}:{f.startLine}:{f.startColumn}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">{f.ruleId}</span>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200">{f.message}</p>
                      <pre className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-indigo-950/70 bg-slate-50 dark:bg-[#070B19] px-3 py-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {f.lineText}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RULE REGISTRY TAB */}
        {activeTab === 'registry' && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70 dark:border-indigo-950/70">
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 dark:bg-[#070B19] p-1">
                {['all', 'typescript', 'python', 'go', 'generic'].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setRegistryLangFilter(lang)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                      registryLangFilter === lang
                        ? 'bg-white dark:bg-[#18213D] text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              <label className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={registrySearch}
                  onChange={(e) => setRegistrySearch(e.target.value)}
                  placeholder="Search rules, CWE, OWASP..."
                  className="w-full rounded-lg border border-slate-200 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </label>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-indigo-950/70">
              {combinedRegistryRules.map((rule) => {
                const cwe = Array.isArray(rule.metadata?.cwe)
                  ? rule.metadata?.cwe[0]
                  : rule.metadata?.cwe;
                const owasp = Array.isArray(rule.metadata?.owasp)
                  ? rule.metadata?.owasp[0]
                  : rule.metadata?.owasp;
                return (
                  <div
                    key={rule.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <SeverityLabel severity={rule.severity} />
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {rule.id}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {rule.languages.join(', ')}
                        </span>
                        {rule.mode && (
                          <>
                            <span aria-hidden="true" className="text-slate-400">·</span>
                            <span className="text-cyan-700 dark:text-cyan-400 font-medium">
                              mode: {rule.mode}
                            </span>
                          </>
                        )}
                        {cwe && (
                          <>
                            <span aria-hidden="true" className="text-slate-400">·</span>
                            <span className="text-slate-500 dark:text-slate-400">{String(cwe)}</span>
                          </>
                        )}
                        {owasp && (
                          <>
                            <span aria-hidden="true" className="text-slate-400">·</span>
                            <span className="text-slate-500 dark:text-slate-400">{String(owasp)}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{rule.message}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLoadRuleInPlayground(rule)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 dark:border-indigo-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Code2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Load in Playground</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
