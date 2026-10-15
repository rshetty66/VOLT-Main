# Install the VOLT Claude Code stack at user level (~/.claude). Windows PowerShell version of setup-stack.sh.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\volt\setup-stack.ps1 [-DryRun]
param([switch]$DryRun)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
foreach ($cmd in 'node', 'claude') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Missing required command: $cmd" }
}
$dry = @()
if ($DryRun) { $dry = @('--dry-run') }

function Invoke-Step([string[]]$cmd) {
    Write-Host "+ $($cmd -join ' ')"
    if (-not $DryRun) {
        & $cmd[0] $cmd[1..($cmd.Length - 1)]
        if ($LASTEXITCODE -ne 0) { throw "Failed: $($cmd -join ' ')" }
    }
}

Write-Host '== ECC (selective install: no planning/TDD loop skills)'
& (Join-Path $repo 'install.ps1') --target claude @dry --enable-hooks `
    --modules 'rules-core,agents-core,hooks-runtime,platform-configs,skill-unified-memory,research-apis,business-content'
& (Join-Path $repo 'install.ps1') --target claude @dry `
    --skills 'security-scan,agent-security-hardening,mcp-dependency-review,safety-guard,gateguard'

Write-Host '== Marketplaces'
Invoke-Step @('claude', 'plugin', 'marketplace', 'add', 'forrestchang/andrej-karpathy-skills')
Invoke-Step @('claude', 'plugin', 'marketplace', 'add', 'anthropics/claude-plugins-official')
Invoke-Step @('claude', 'plugin', 'marketplace', 'add', 'anthropics/skills')
Invoke-Step @('claude', 'plugin', 'marketplace', 'add', (Join-Path $repo 'plugins'))

Write-Host '== Plugins'
Invoke-Step @('claude', 'plugin', 'install', 'andrej-karpathy-skills@karpathy-skills')
Invoke-Step @('claude', 'plugin', 'install', 'superpowers@claude-plugins-official')
Invoke-Step @('claude', 'plugin', 'install', 'document-skills@anthropic-agent-skills')
Invoke-Step @('claude', 'plugin', 'install', 'volt@volt-main')

Write-Host ''
Write-Host 'Done. GSD is intentionally not installed; see VOLT_STACK.md before enabling it on a long-running project.'
