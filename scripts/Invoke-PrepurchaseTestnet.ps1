[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Build', 'Provision', 'Fund', 'Inspect', 'E2E')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretLoader = 'C:\Dev\scripts\GET-SECRET.ps1'
$NodeExe = (Get-Command node -ErrorAction Stop).Source
$ServerProcess = $null

function Get-PrivateValue {
    param([Parameter(Mandatory)][string]$Name)
    $value = & $SecretLoader $Name
    if ($LASTEXITCODE -ne 0 -or -not $value) {
        throw "Private runtime value unavailable: $Name"
    }
    return ($value -join "`n").Trim()
}

function Invoke-TypeScript {
    param([Parameter(Mandatory)][string[]]$Arguments)
    & $NodeExe '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON' `
        '--experimental-strip-types' @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Node command failed with exit code $LASTEXITCODE"
    }
}

try {
    if ($Action -ne 'Build') {
        $env:CDP_API_KEY_ID = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_ID'
        $env:CDP_API_KEY_SECRET = Get-PrivateValue 'CDP_AGENTHUB_API_KEY_SECRET'
        $env:CDP_WALLET_SECRET = Get-PrivateValue 'CDP_AGENTHUB_WALLET_SECRET'
    }

    Push-Location $RepoRoot
    try {
        switch ($Action) {
            'Build' {
                $envPath = Join-Path $RepoRoot '.env.local'
                $disabledEnvPath = Join-Path $RepoRoot '.env.local.disabled-for-secret-free-build'
                $envWasMoved = $false
                if (Test-Path -LiteralPath $disabledEnvPath) {
                    throw 'Temporary secret-free build path already exists.'
                }
                if (Test-Path -LiteralPath $envPath) {
                    Move-Item -LiteralPath $envPath -Destination $disabledEnvPath
                    $envWasMoved = $true
                }
                try {
                    npm run build
                    if ($LASTEXITCODE -ne 0) {
                        throw "Build failed with exit code $LASTEXITCODE"
                    }
                } finally {
                    if ($envWasMoved) {
                        Move-Item -LiteralPath $disabledEnvPath -Destination $envPath -Force
                    }
                }
            }
            'Provision' {
                $env:PREPURCHASE_TESTNET_WALLET_PREPARE = 'I-AUTHORIZE-CDP-TESTNET-WALLET-PROVISIONING'
                Invoke-TypeScript @('scripts/prepurchase-testnet-wallets.mts', '--provision')
            }
            'Fund' {
                $env:PREPURCHASE_TESTNET_FAUCET = 'I-AUTHORIZE-CDP-BASE-SEPOLIA-FAUCET'
                Invoke-TypeScript @('scripts/prepurchase-testnet-wallets.mts', '--fund-buyer')
            }
            'Inspect' {
                Invoke-TypeScript @('scripts/prepurchase-testnet-wallets.mts', '--inspect')
            }
            'E2E' {
                $walletStatePath = Join-Path $RepoRoot '.exchange\codex\prepurchase-testnet-wallets.json'
                if (-not (Test-Path -LiteralPath $walletStatePath)) {
                    throw 'Wallet state is missing; run Provision and Fund first.'
                }
                $walletState = Get-Content -Raw -LiteralPath $walletStatePath | ConvertFrom-Json
                if ($walletState.network -ne 'eip155:84532') {
                    throw 'Wallet state is not for Base Sepolia.'
                }
                if (
                    -not (Test-Path -LiteralPath (Join-Path $RepoRoot '.next\BUILD_ID')) -or
                    -not (Test-Path -LiteralPath (Join-Path $RepoRoot '.next\prerender-manifest.json'))
                ) {
                    throw 'Production build is missing; run npm run build without secrets first.'
                }

                $dbPassword = Get-PrivateValue 'SUPABASE_AGENTHUB_DATABASE_PASSWORD'
                $encodedPassword = [uri]::EscapeDataString($dbPassword)
                $env:DATABASE_URL = "postgresql://postgres.rprhlzipryatzaefrzhd:${encodedPassword}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
                $env:PREPURCHASE_ENABLED = 'true'
                $env:PREPURCHASE_NETWORK = 'eip155:84532'
                $env:PREPURCHASE_PAY_TO = $walletState.receiver.address
                $env:PREPURCHASE_TESTNET_PAY_TO = $walletState.receiver.address
                $env:PREPURCHASE_TESTNET_EXECUTE = 'I-AUTHORIZE-EXACTLY-1-TEST-USDC-ON-BASE-SEPOLIA'

                $logDir = Join-Path $RepoRoot '.exchange\codex'
                New-Item -ItemType Directory -Force -Path $logDir | Out-Null
                $stdoutPath = Join-Path $logDir 'prepurchase-testnet-server.stdout.log'
                $stderrPath = Join-Path $logDir 'prepurchase-testnet-server.stderr.log'
                $ServerProcess = Start-Process -FilePath $NodeExe `
                    -ArgumentList @('node_modules\next\dist\bin\next', 'start', '--hostname', '127.0.0.1', '--port', '3000') `
                    -WorkingDirectory $RepoRoot `
                    -WindowStyle Hidden `
                    -RedirectStandardOutput $stdoutPath `
                    -RedirectStandardError $stderrPath `
                    -PassThru

                $ready = $false
                $deadline = (Get-Date).AddSeconds(45)
                while ((Get-Date) -lt $deadline) {
                    if ($ServerProcess.HasExited) {
                        throw "Local server exited before becoming ready. See $stderrPath"
                    }
                    try {
                        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/prepurchase/order' `
                            -Method Get -TimeoutSec 3 -UseBasicParsing
                        if ($response.StatusCode -eq 200) {
                            $ready = $true
                            break
                        }
                    } catch {}
                    Start-Sleep -Milliseconds 500
                }
                if (-not $ready) {
                    throw "Local server did not become ready. See $stderrPath"
                }

                Invoke-TypeScript @('scripts/prepurchase-testnet-e2e.mts', '--execute')
            }
        }
    } finally {
        Pop-Location
    }
} finally {
    if ($ServerProcess -and -not $ServerProcess.HasExited) {
        Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
        [void]$ServerProcess.WaitForExit(5000)
    }
    Remove-Item Env:CDP_API_KEY_ID -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_API_KEY_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:CDP_WALLET_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_ENABLED -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_NETWORK -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_PAY_TO -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_TESTNET_PAY_TO -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_TESTNET_EXECUTE -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_TESTNET_WALLET_PREPARE -ErrorAction SilentlyContinue
    Remove-Item Env:PREPURCHASE_TESTNET_FAUCET -ErrorAction SilentlyContinue
    $dbPassword = $null
    $encodedPassword = $null

    # Next's generated server cache can retain expanded runtime values. The
    # funded test removes it; a final secret-free build is run separately.
    if ($Action -eq 'E2E') {
        $nextPath = Join-Path $RepoRoot '.next'
        if ((Test-Path -LiteralPath $nextPath) -and $nextPath.StartsWith($RepoRoot)) {
            Remove-Item -LiteralPath $nextPath -Recurse -Force
        }
    }
}
