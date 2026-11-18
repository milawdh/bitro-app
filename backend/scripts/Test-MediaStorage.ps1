param([switch]$AllTests)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$artifacts = Join-Path $workspace 'backend/artifacts/media-test-probe'
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$archive = Join-Path $artifacts 'linux-x64-5.2.0.tgz'
$expectedHash = '8B6B2E34BAD5EA7CFBE1914185145F514F620F24203A1A421E8D00A698BF8E61'
# Pinned test-only static binary. Production installs ffprobe from Ubuntu.
if (-not (Test-Path -LiteralPath $archive)) {
    Invoke-WebRequest 'https://registry.npmjs.org/@ffprobe-installer/linux-x64/-/linux-x64-5.2.0.tgz' -OutFile $archive -UseBasicParsing
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) {
    throw 'The test probe archive failed SHA256 verification.'
}
& tar -xzf $archive -C $artifacts
if ($LASTEXITCODE -ne 0) { throw 'Could not extract the test probe.' }
$probe = (Join-Path $artifacts 'package/ffprobe').Replace('\','/')
$composeArgs = @('compose','--env-file',"$workspace/backend/.env",'-f',"$workspace/compose.yaml")
& docker @composeArgs up -d backend-postgres backend-seaweed
if ($LASTEXITCODE -ne 0) { throw 'Could not start local test dependencies.' }
$testArgs = @('run','--build','--rm','-e','BITRO_TEST_OBJECT_STORAGE=true','-v',"${probe}:/usr/local/bin/ffprobe:ro",'backend-tests')
if (-not $AllTests) { $testArgs += '--TestCaseFilter:FullyQualifiedName~MediaStorageTests' }
& docker @composeArgs @testArgs
exit $LASTEXITCODE
