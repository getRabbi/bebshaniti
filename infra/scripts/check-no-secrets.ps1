$ErrorActionPreference = 'Stop'

$tracked = git ls-files --cached --others --exclude-standard
$patterns = @(
  'SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ',
  'SUPABASE_JWT_SECRET\s*=\s*[^\s#]+',
  'postgres(?:ql)?://[^:]+:[^@]+@'
)

foreach ($file in $tracked) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
  if ($file -like '*.md' -or $file -like '*.example' -or $file -like '*.sql') { continue }
  $content = Get-Content -LiteralPath $file -Raw
  foreach ($pattern in $patterns) {
    if ($content -match $pattern) {
      throw "Potential secret detected in tracked file: $file"
    }
  }
}

Write-Output 'No obvious committed secrets detected.'
