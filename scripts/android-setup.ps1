$ErrorActionPreference = 'Stop'
$androidSdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adbPath = Join-Path $androidSdkPath 'platform-tools\adb.exe'
$emulatorPath = Join-Path $androidSdkPath 'emulator\emulator.exe'

if (!(Test-Path -LiteralPath $adbPath) -or !(Test-Path -LiteralPath $emulatorPath)) {
    Write-Host 'Android SDK not found. Install Android Studio: https://developer.android.com/studio'
    Write-Host 'Install Android SDK Platform-Tools and Android Emulator in SDK Manager.'
    Write-Host 'Create and start a virtual phone in Device Manager, then run npm run android.'
    Write-Host 'For a physical phone, install Expo Go and run npm run dev instead.'
    exit 1
}

$env:ANDROID_HOME = $androidSdkPath
$env:Path = "$androidSdkPath\platform-tools;$androidSdkPath\emulator;$env:Path"
Write-Host "Android SDK: $androidSdkPath"
Write-Host 'Available virtual devices:'
& $emulatorPath -list-avds
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Connected devices:'
& $adbPath devices
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Start your virtual phone in Android Studio, then run npm run android.'
