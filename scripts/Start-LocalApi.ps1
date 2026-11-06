param(
  [string]$BackendRoot = 'C:\Users\cauan\Desktop\Vanos-Limpo'
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$sourceApi = Join-Path $BackendRoot 'Desktop\Vanos\Vanos.API'
$isolatedApi = Join-Path $workspaceRoot '.expo\backend-local'
$expectedCommit = '9fc0757d17e3595de840b22b859c6ef0c27807b8'

if (-not (Test-Path -LiteralPath (Join-Path $sourceApi 'Vanos.API.csproj'))) {
  throw "Backend nao encontrado em $sourceApi"
}
$safeRepo = 'safe.directory=' + ($BackendRoot -replace '\\', '/')
$commit = (& git -c $safeRepo -C $BackendRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -ne $expectedCommit) {
  throw 'O commit local mudou. Revise o backend antes de atualizar esta rotina de validacao.'
}
$changes = & git -c $safeRepo -C $BackendRoot status --porcelain
if ($LASTEXITCODE -ne 0 -or $changes) { throw 'O backend tem alteracoes locais. Preserve-as e revise a copia de execucao antes de continuar.' }
if (Get-NetTCPConnection -State Listen -LocalPort 5107 -ErrorAction SilentlyContinue) {
  throw 'A porta 5107 esta ocupada. Confira a API existente ou encerre a instancia de validacao antes de reiniciar.'
}

# Never inherit the existing VanosDb connection or the original UserSecretsId.
$env:ConnectionStrings__DefaultConnection = 'Server=.\SQLEXPRESS;Database=VanosMobile_LocalValidation;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;Connect Timeout=5'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:DOTNET_ENVIRONMENT = 'Development'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5107'
Remove-Item Env:ASPNETCORE_HTTPS_PORT -ErrorAction SilentlyContinue
Remove-Item Env:ASPNETCORE_HTTPS_PORTS -ErrorAction SilentlyContinue
Remove-Item Env:HTTPS_PORT -ErrorAction SilentlyContinue
$env:Jwt__Issuer = 'VanosMobile.LocalValidation'
$env:Jwt__Audience = 'VanosMobile.LocalBrowser'
$keyBytes = New-Object byte[] 48
$randomSource = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$randomSource.GetBytes($keyBytes)
$randomSource.Dispose()
$env:Jwt__Key = [Convert]::ToBase64String($keyBytes)
$env:Payments__EnableSimulation = 'false'
$env:Logging__LogLevel__Default = 'Warning'
$env:Logging__LogLevel__Microsoft_AspNetCore = 'Warning'

New-Item -ItemType Directory -Path $isolatedApi -Force | Out-Null
Get-ChildItem -LiteralPath $sourceApi -Force |
  Where-Object { $_.Name -notin @('bin', 'obj', '.vs') } |
  Copy-Item -Destination $isolatedApi -Recurse -Force

Push-Location $isolatedApi
try {
  & dotnet build Vanos.API.csproj --property:UserSecretsId=VanosMobile-LocalValidation-Isolated --verbosity minimal
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o backend isolado.' }
  & dotnet ef database update --no-build --project Vanos.API.csproj --context AppDbContext
  if ($LASTEXITCODE -ne 0) { throw 'Falha nas migrations do banco local dedicado. Confira SQL Express e dotnet-ef 10.0.9.' }
  Write-Host 'API local: http://127.0.0.1:5107/swagger'
  Write-Host 'Banco: .\SQLEXPRESS / VanosMobile_LocalValidation (autenticacao Windows). Ctrl+C encerra somente esta API.'
  & dotnet bin/Debug/net10.0/Vanos.API.dll --urls http://127.0.0.1:5107
} finally {
  Pop-Location
}
