$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\build\windows\uninstall-service.ps1')

function Assert-Equal($Actual, $Expected, [string]$Message) {
    if ($Actual -cne $Expected) {
        throw "${Message}: expected '$Expected', got '$Actual'"
    }
}

function Assert-Throws([scriptblock]$Action, [string]$Message) {
    $thrown = $false
    try {
        & $Action | Out-Null
    } catch {
        $thrown = $true
    }
    if (-not $thrown) {
        throw $Message
    }
}

function Reset-Fixture {
    $script:Services = @{}
    $script:Calls = [System.Collections.Generic.List[string]]::new()
    $script:IsAdministrator = $true
    $script:StopCode = 0
    $script:DeleteCode = 0
    $script:ElevationCode = 0
    $script:CancelElevation = $false
}

function Get-PerzikeService {
    param([string]$Name)
    return $script:Services[$Name]
}

function Test-PerzikeAdministrator {
    return $script:IsAdministrator
}

function Test-Path {
    param([string]$LiteralPath)
    return $false
}

function Invoke-PerzikeSc {
    param([string[]]$Arguments)
    $action, $name = $Arguments
    $script:Calls.Add("$action $name")
    if ($action -eq 'stop') {
        if ($script:StopCode -eq 0) {
            $script:Services[$name].State = 'Stopped'
        }
        return $script:StopCode
    }
    if ($script:DeleteCode -eq 0) {
        $script:Services.Remove($name)
    }
    return $script:DeleteCode
}

function Start-Process {
    param($FilePath, $ArgumentList, $Verb, $WindowStyle, [switch]$Wait, [switch]$PassThru)
    $script:Calls.Add("elevate $Verb $WindowStyle $($ArgumentList -join ' ')")
    if ($script:CancelElevation) {
        throw [System.ComponentModel.Win32Exception]::new(1223)
    }
    $result = [pscustomobject]@{ ExitCode = $script:ElevationCode }
    $result | Add-Member -MemberType ScriptMethod -Name Dispose -Value {}
    return $result
}

Reset-Fixture
Assert-Equal (Invoke-PerzikeServiceCleanup) 0 'Missing service is a successful no-op'
Assert-Equal $script:Calls.Count 0 'No UAC or control calls for missing service'

Reset-Fixture
$script:Services.PerzikeService = @{ State = 'Stopped' }
Assert-Equal (Invoke-PerzikeServiceCleanup) 0 'Stopped service can be removed'
Assert-Equal ($script:Calls -join ',') 'delete PerzikeService' 'Stopped service skips stop'

Reset-Fixture
$script:Services.PerzikeService = @{ State = 'Running' }
Assert-Equal (Invoke-PerzikeServiceCleanup) 0 'Running service can be removed'
Assert-Equal ($script:Calls -join ',') 'stop PerzikeService,delete PerzikeService' 'Stop precedes deletion'

Reset-Fixture
$script:Services.PerzikeService = @{ State = 'Running' }
Assert-Equal (Invoke-PerzikeServiceCleanup -StopOnly) 0 'Upgrade stops service'
Assert-Equal ($script:Calls -join ',') 'stop PerzikeService' 'Upgrade keeps registration'
Assert-Equal $script:Services.Count 1 'Upgrade retains installed service'

Reset-Fixture
$script:Services['Perzike Service'] = @{ State = 'Stopped' }
Assert-Equal (Invoke-PerzikeServiceCleanup) 0 'Legacy service name is removed'
Assert-Equal ($script:Calls -join ',') 'delete Perzike Service' 'Legacy name remains one argument'

Reset-Fixture
$script:Services.PerzikeService = @{ State = 'Running' }
$script:StopCode = 5
Assert-Throws { Invoke-PerzikeServiceCleanup } 'Stop permission failure must abort'
Assert-Equal ($script:Calls -join ',') 'stop PerzikeService' 'Stop failure prevents deletion'

Reset-Fixture
$script:Services.PerzikeService = @{ State = 'Stopped' }
$script:DeleteCode = 5
Assert-Throws { Invoke-PerzikeServiceCleanup } 'Delete permission failure must abort'
Assert-Equal $script:Services.Count 1 'Delete failure preserves service'

Reset-Fixture
$script:Services.PerzikeService = @{ State = 'Stopped' }
Assert-Throws { Wait-PerzikeService -Name PerzikeService -Removed -TimeoutSeconds 0 } 'Lingering registration must not report success'
$script:Services.PerzikeService.State = 'Running'
Assert-Throws { Wait-PerzikeService -Name PerzikeService -TimeoutSeconds 0 } 'Lingering process must not report success'

Reset-Fixture
$script:Services.PerzikeService = @{ State = 'Running' }
$script:IsAdministrator = $false
Assert-Equal (Invoke-PerzikeServiceCleanup -StopOnly -ScriptPath 'C:\Test App\cleanup.ps1') 0 'Per-user install requests elevation'
Assert-Equal ($script:Calls[0] -match 'RunAs Hidden.*"C:\\Test App\\cleanup.ps1".*-Elevated -StopOnly') $true 'Elevation preserves path and upgrade argument'

Reset-Fixture
$script:Services.PerzikeService = @{ State = 'Stopped' }
$script:IsAdministrator = $false
$script:ElevationCode = 5
Assert-Equal (Invoke-PerzikeServiceCleanup) 5 'Elevated cleanup failure reaches uninstaller'
Assert-Equal $script:Services.Count 1 'Parent process does not delete service'

$script:CancelElevation = $true
Assert-Throws { Invoke-PerzikeServiceCleanup } 'Cancelled UAC must not report success'
Assert-Throws { Invoke-PerzikeServiceCleanup -Elevated } 'Failed elevation must not recurse'

Write-Output 'Windows uninstall regression checks passed.'
