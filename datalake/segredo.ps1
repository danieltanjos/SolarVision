# Roda o docker compose do datalake com a service key do Supabase como secret, sem ela em texto no disco.
#
#   .\segredo.ps1 guardar                                   # pede a chave (não aparece na tela) e guarda
#   .\segredo.ps1 run --rm app python coletor/coletar_energia.py
#   .\segredo.ps1 up -d explorador
#   .\segredo.ps1 apagar                                    # esquece a chave guardada
#
# A chave fica em %LOCALAPPDATA%\SolarVision, criptografada pelo Windows (DPAPI): só o seu usuário, neste
# computador, consegue abrir. Ela vai para SUPABASE_SERVICE_KEY só durante o comando, e o
# docker-compose.segredo.yml a entrega ao container como /run/secrets/supabase_service_key.

$ErrorActionPreference = "Stop"
$arquivo = Join-Path $env:LOCALAPPDATA "SolarVision\supabase_service_key.xml"

if ($args.Count -eq 0) {
    Write-Host "uso: .\segredo.ps1 guardar | apagar | <argumentos do docker compose>"
    exit 1
}

if ($args[0] -eq "guardar") {
    $chave = Read-Host "Service key do Supabase (sb_secret_...)" -AsSecureString
    if ($chave.Length -eq 0) { Write-Host "nada guardado: chave vazia"; exit 1 }
    New-Item -ItemType Directory -Force (Split-Path $arquivo) | Out-Null
    $chave | Export-Clixml -Path $arquivo
    Write-Host "chave guardada em $arquivo (criptografada para o seu usuário)"
    exit 0
}

if ($args[0] -eq "apagar") {
    if (Test-Path $arquivo) { Remove-Item $arquivo -Confirm:$false }
    Write-Host "chave apagada"
    exit 0
}

if (-not (Test-Path $arquivo)) {
    Write-Host "sem chave guardada: rode antes .\segredo.ps1 guardar"
    exit 1
}

$segura = Import-Clixml -Path $arquivo
$ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
try {
    $env:SUPABASE_SERVICE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
    Push-Location $PSScriptRoot
    # O docker escreve progresso no stderr; com a saída redirecionada, o PowerShell 5.1 trata isso como erro.
    $ErrorActionPreference = "Continue"
    try {
        docker compose -f docker-compose.yml -f docker-compose.segredo.yml @args
        $codigo = $LASTEXITCODE
    } finally {
        Pop-Location
    }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
    Remove-Item Env:SUPABASE_SERVICE_KEY -ErrorAction SilentlyContinue
}
exit $codigo
