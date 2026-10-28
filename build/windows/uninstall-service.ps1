param(
    [switch]$StopOnly,
    [switch]$Elevated
)

$ErrorActionPreference = 'Stop'
$script:PerzikeServiceNames = @('PerzikeService', 'Perzike Service')

function Get-PerzikeService {
    param([string]$Name)
    Get-CimInstance -ClassName Win32_Service -Filter "Name='$Name'" -OperationTimeoutSec 5 -ErrorAction Stop
}

function Test-PerzikeAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        $principal = [Security.Principal.WindowsPrincipal]::new($identity)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } finally {
        $identity.Dispose()
    }
}

function Invoke-PerzikeSc {
    param([string[]]$Arguments)
    $output = & "$env:SystemRoot\System32\sc.exe" @Arguments 2>&1
    $result = $LASTEXITCODE
    $output | Out-Host
    return $result
}

function Wait-PerzikeService {
    param(
        [string]$Name,
        [switch]$Removed,
        [int]$TimeoutSeconds = 30
    )
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $service = Get-PerzikeService -Name $Name
        if (-not $service -or (-not $Removed -and $service.State -eq 'Stopped')) {
            return
        }
        if ([DateTime]::UtcNow -ge $deadline) {
            throw "Timed out waiting for service '$Name' to stop or be removed."
        }
        Start-Sleep -Milliseconds 250
    } while ($true)
}

function Invoke-PerzikeServiceCleanup {
    param(
        [switch]$StopOnly,
        [switch]$Elevated,
        [string]$ScriptPath = $PSCommandPath
    )

    $installedNames = @(
        foreach ($name in $script:PerzikeServiceNames) {
            if (Get-PerzikeService -Name $name) {
                $name
            }
        }
    )
    if ($installedNames.Count -eq 0) {
        return 0
    }

    if (-not (Test-PerzikeAdministrator)) {
        if ($Elevated) {
            throw 'Administrator privileges are required to remove the Perzike service.'
        }
        $arguments = @(
            '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
            '-File', "`"$ScriptPath`"", '-Elevated'
        )
        if ($StopOnly) {
            $arguments += '-StopOnly'
        }
        $process = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
            -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
        try {
            return $process.ExitCode
        } finally {
            $process.Dispose()
        }
    }

    foreach ($name in $installedNames) {
        $service = Get-PerzikeService -Name $name
        if (-not $service) {
            continue
        }
        if ($service.State -ne 'Stopped') {
            $result = Invoke-PerzikeSc -Arguments @('stop', $name)
            if ($result -notin @(0, 1060, 1061, 1062)) {
                throw "Failed to stop service '$name' (sc.exe exit code $result)."
            }
            Wait-PerzikeService -Name $name
        }

        if (-not $StopOnly) {
            $result = Invoke-PerzikeSc -Arguments @('delete', $name)
            if ($result -notin @(0, 1060, 1072)) {
                throw "Failed to delete service '$name' (sc.exe exit code $result)."
            }
            Wait-PerzikeService -Name $name -Removed
            $eventSource = "HKLM:\SYSTEM\CurrentControlSet\Services\EventLog\Application\$name"
            if (Test-Path -LiteralPath $eventSource) {
                Remove-Item -LiteralPath $eventSource -Force -ErrorAction Stop
            }
        }
    }
    return 0
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        $result = Invoke-PerzikeServiceCleanup -StopOnly:$StopOnly -Elevated:$Elevated
        exit $result
    } catch {
        Write-Error $_ -ErrorAction Continue
        exit 1
    }
}
