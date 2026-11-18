param([string]$OutputPath)
$ErrorActionPreference = 'Stop'

#region Paths and Secret Generation
$backendDirectory = Split-Path -Parent $PSScriptRoot
if (-not $OutputPath) { $OutputPath = Join-Path $backendDirectory '.env' }
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
function New-RandomSecret([int]$Length = 32) {
    $bytes = New-Object byte[] $Length
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
#endregion

#region Create Local Environment Once
if (-not (Test-Path -LiteralPath $OutputPath)) {
    $proxySubnet = '172.16.0.0/12'
    try {
        $networkInfo = docker network inspect bitro-frontend_default 2>$null | ConvertFrom-Json
        if ($LASTEXITCODE -eq 0 -and $networkInfo[0].IPAM.Config[0].Subnet) { $proxySubnet = $networkInfo[0].IPAM.Config[0].Subnet }
    } catch { }
    $dbPassword = New-RandomSecret
    $redisPassword = New-RandomSecret
    $adminPassword = 'Aa1!' + (New-RandomSecret 24)
    $otpSecret = New-RandomSecret
    $s3Access = 'bitro-' + (New-RandomSecret 8)
    $s3Secret = New-RandomSecret
    $entries = @(
        '# Local development settings. Do not commit this file.'
        'ASPNETCORE_ENVIRONMENT=Development'
        'ASPNETCORE_URLS=http://+:8080'
        'BITRO_HTTP_PORT=7075'
        "BITRO_POSTGRES_PASSWORD=$dbPassword"
        "BITRO_DB_CONNECTION_STRING=Host=backend-postgres;Port=5432;Database=bitrolearn;Username=bitro;Password=$dbPassword;Maximum Pool Size=30"
        "BITRO_REDIS_PASSWORD=$redisPassword"
        "BITRO_REDIS_CONNECTION_STRING=backend-redis:6379,password=$redisPassword,abortConnect=false,connectTimeout=3000,asyncTimeout=3000"
        'BITRO_OPENAPI_ENABLED=true'
        'BITRO_SUPERUSER_EMAIL=admin@bitrolearn.local'
        "BITRO_SUPERUSER_PASSWORD=$adminPassword"
        'BITRO_ADMIN_MAX_ATTEMPTS=5'
        'BITRO_ADMIN_LOCK_SECONDS=900'
        "BITRO_OTP_HMAC_KEY=$otpSecret"
        'BITRO_OTP_TTL_SECONDS=120'
        'BITRO_OTP_RESEND_SECONDS=60'
        'BITRO_OTP_MAX_ATTEMPTS=5'
        'BITRO_OTP_LOCK_SECONDS=900'
        'BITRO_OTP_RATE_WINDOW_SECONDS=3600'
        'BITRO_OTP_PHONE_HOURLY_LIMIT=5'
        'BITRO_OTP_IP_HOURLY_LIMIT=20'
        'BITRO_COOKIE_SECURE=false'
        'BITRO_COOKIE_LIFETIME_HOURS=8'
        'BITRO_DATA_PROTECTION_APPLICATION_NAME=BitroLearn.Backend'
        'BITRO_CACHE_LOCAL_SECONDS=15'
        'BITRO_CACHE_DISTRIBUTED_SECONDS=60'
        'BITRO_S3_ENDPOINT=http://backend-seaweed:8333'
        "BITRO_S3_ACCESS_KEY=$s3Access"
        "BITRO_S3_SECRET_KEY=$s3Secret"
        'BITRO_S3_BUCKET=bitrolearn'
        "BITRO_TRUSTED_PROXY_NETWORK=$proxySubnet"
    )
    [IO.File]::WriteAllLines($OutputPath, $entries, [Text.UTF8Encoding]::new($false))
    Write-Output "Created local environment file: $OutputPath"
} else {
    Write-Output 'Existing environment file preserved.'
}
# Fill only newly introduced non-secret defaults when rerunning the setup script.
$optionalDefaults = @('BITRO_ADMIN_MAX_ATTEMPTS=5', 'BITRO_ADMIN_LOCK_SECONDS=900', 'BITRO_OTP_LOCK_SECONDS=900', 'BITRO_OTP_RATE_WINDOW_SECONDS=3600', 'BITRO_S3_PUBLIC_ENDPOINT=http://localhost:7076', 'BITRO_ZIBAL_MERCHANT=zibal', 'BITRO_ZIBAL_CALLBACK_URL=http://localhost:7075/public/payments/zibal/callback', 'BITRO_SPOTPLAYER_TEST=true', 'BITRO_APP_PUBLIC_URL=http://localhost:3000')
$existingLines = [IO.File]::ReadAllLines($OutputPath)
$optionalDefaults += 'BITRO_MEDIA_LINK_TTL_SECONDS=14400'
foreach ($defaultEntry in $optionalDefaults) {
    $defaultKey = $defaultEntry.Split('=')[0]
    if (-not ($existingLines | Where-Object { $_.StartsWith($defaultKey + '=') })) {
        [IO.File]::AppendAllText($OutputPath, [Environment]::NewLine + $defaultEntry + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    }
}
#endregion

#region Generate Private SeaweedFS Configuration
function Read-LocalSetting([string]$Key) {
    $match = Get-Content -LiteralPath $OutputPath | Where-Object { $_.StartsWith($Key + '=') } | Select-Object -First 1
    if (-not $match) { throw "Missing setting: $Key" }
    return $match.Substring($Key.Length + 1).Trim().Trim('"').Trim("'")
}
$privateDirectory = Join-Path $backendDirectory 'artifacts'
$cacheLines = [IO.File]::ReadAllLines($OutputPath)
if (-not ($cacheLines | Where-Object { $_.StartsWith('BITRO_CACHE_REDIS_PASSWORD=') })) {
    $cachePassword = New-RandomSecret
    [IO.File]::AppendAllText($OutputPath, "`nBITRO_CACHE_REDIS_PASSWORD=$cachePassword`n", [Text.UTF8Encoding]::new($false))
}
if (-not ($cacheLines | Where-Object { $_.StartsWith('BITRO_CACHE_REDIS_CONNECTION_STRING=') })) {
    $cachePassword = Read-LocalSetting 'BITRO_CACHE_REDIS_PASSWORD'
    [IO.File]::AppendAllText($OutputPath, "`nBITRO_CACHE_REDIS_CONNECTION_STRING=backend-cache:6379,password=$cachePassword,abortConnect=false`n", [Text.UTF8Encoding]::new($false))
}
New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
$storageConfig = @{
    identities = @(@{
        name = 'bitro-backend'
        credentials = @(@{ accessKey = (Read-LocalSetting 'BITRO_S3_ACCESS_KEY'); secretKey = (Read-LocalSetting 'BITRO_S3_SECRET_KEY') })
        actions = @('Admin', 'Read', 'Write', 'List', 'Tagging')
    })
}
$storageJson = $storageConfig | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText((Join-Path $privateDirectory 'seaweed-s3.json'), $storageJson, [Text.UTF8Encoding]::new($false))
Write-Output 'Private storage configuration prepared. Secrets were not printed.'
#endregion
