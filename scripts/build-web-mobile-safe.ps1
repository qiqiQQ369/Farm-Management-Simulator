param(
    [string]$CreatorPath = 'C:\ProgramData\cocos\editors\Creator\3.8.6\CocosCreator.exe',
    [int]$WaitForBuildSeconds = 180
)

$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$configPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'build-configs\web-mobile-safe.json'))
$buildRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'build'))
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $buildRoot 'web-mobile-safe'))

if (-not (Test-Path -LiteralPath $CreatorPath -PathType Leaf)) {
    throw "CocosCreator.exe not found: $CreatorPath"
}
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Build config not found: $configPath"
}
if (-not $outputPath.StartsWith($buildRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean output outside build directory: $outputPath"
}

if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Recurse -Force
}

$normalizedConfigPath = $configPath.Replace('\', '/')
$buildOptions = "configPath=$normalizedConfigPath;logDest=project://temp/builder/log/web-mobile-safe.log"

Write-Host 'Building Web Mobile HTML with gameplay-safe options...'
& $CreatorPath --project $projectRoot --build $buildOptions | Out-Host
$creatorExitCode = $LASTEXITCODE
if ($creatorExitCode -ne 0 -and $creatorExitCode -ne 1 -and $creatorExitCode -ne 36) {
    throw "Cocos Creator build failed with exit code $creatorExitCode."
}

# On Windows the editor executable may return before its background build task
# finishes. Wait for the configured output instead of treating that early exit
# as the build result.
$deadline = [DateTime]::UtcNow.AddSeconds([Math]::Max(1, $WaitForBuildSeconds))
$indexPath = Join-Path $outputPath 'index.html'
while (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
    if ([DateTime]::UtcNow -ge $deadline) {
        throw "Timed out waiting for Web build output: $indexPath"
    }
    Start-Sleep -Seconds 1
}

$requiredFiles = @(
    (Join-Path $outputPath 'index.html'),
    (Join-Path $outputPath 'assets\main\index.js')
)
foreach ($requiredFile in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Web build output is incomplete: $requiredFile"
    }
}

$projectBundlePath = Join-Path $outputPath 'assets\main\index.js'
$projectBundle = Get-Content -LiteralPath $projectBundlePath -Raw
$requiredGameplayModules = @(
    'ResourceFieldSystem',
    'CornWorker',
    'CornStoragePoint',
    'CornCustomerScheduler'
)
foreach ($moduleName in $requiredGameplayModules) {
    if (-not $projectBundle.Contains($moduleName)) {
        throw "Web build omitted required gameplay module: $moduleName"
    }
}

Write-Host "Safe Web Mobile build succeeded: $outputPath"
Write-Host "Verified gameplay modules: $($requiredGameplayModules -join ', ')"
