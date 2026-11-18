# Drift Zone — télécharge la dernière version depuis GitHub et remplace les fichiers du jeu
$ErrorActionPreference = 'Stop'
$repo = 'abdoulhamadywone-dot/drift-zone'
$dest = $PSScriptRoot
$tmp = Join-Path $env:TEMP ('driftzone-maj-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Write-Host ''
  Write-Host '  Téléchargement de la dernière version de Drift Zone...'
  $zip = Join-Path $tmp 'jeu.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$repo/archive/refs/heads/main.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $src = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like 'drift-zone-*' } | Select-Object -First 1
  if (-not $src) { throw 'Archive inattendue.' }
  Copy-Item -Path (Join-Path $src.FullName '*') -Destination $dest -Recurse -Force
  $v = Get-Content (Join-Path $dest 'version.json') -Raw | ConvertFrom-Json
  Write-Host ''
  Write-Host ('  OK : Drift Zone est à jour (version ' + $v.version + ').')
} catch {
  Write-Host ''
  Write-Host ('  La mise à jour a échoué : ' + $_.Exception.Message)
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
