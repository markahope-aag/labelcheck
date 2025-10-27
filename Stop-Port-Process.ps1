# PowerShell Port Killer
# Requires -RunAsAdministrator
# -----------------------------------------------------------------------------
# Function: Stop-Port-Process
# Description: Finds and forcefully terminates the process listening on a 
#              specified TCP port in Windows using the highly aggressive
#              taskkill utility.
# Usage: Stop-Port-Process -Port 3000
# -----------------------------------------------------------------------------
function Stop-Port-Process {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [ValidateRange(1, 65535)]
        [int]$Port
    )

    Write-Host "Searching for process listening on port $Port..." -ForegroundColor Yellow

    # 1. Use Get-NetTCPConnection to find the process ID (OwningProcess) for the specified port in a LISTEN state.
    $Connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

    if (-not $Connections) {
        Write-Host "No process found listening on port $Port." -ForegroundColor Green
        return
    }

    # 2. Extract the unique Process IDs (PID) that are holding the port.
    $ProcessIDs = $Connections | Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($PID in $ProcessIDs) {
        # 3. Get the process details (Name) using the Process ID.
        $Process = Get-Process -Id $PID -ErrorAction SilentlyContinue

        if ($Process) {
            Write-Host "Found process '$($Process.ProcessName)' (PID: $PID) using port $Port." -ForegroundColor Cyan
            
            # Check if it is a protected system process (PID 4 is System/NT Kernel)
            if ($PID -eq 4) {
                Write-Warning "PID 4 (System) is typically a kernel process hosting services. Killing it is dangerous and usually unnecessary."
                continue
            }

            # 4. Stop the process forcefully using the taskkill utility for robustness.
            try {
                # Execute taskkill with /F (Force)
                # We use $null = ... to suppress the success output from taskkill itself,
                # and check the $LASTEXITCODE variable (0 means success).
                $null = taskkill /PID $PID /F 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Successfully terminated process '$($Process.ProcessName)' (PID: $PID) using taskkill." -ForegroundColor Green
                } else {
                    Write-Error "Taskkill failed for '$($Process.ProcessName)' (PID: $PID). PID not found or access denied."
                }
            } catch {
                Write-Error "An unexpected error occurred during termination attempt for '$($Process.ProcessName)' (PID: $PID). Message: $($_.Exception.Message)"
            }
        } else {
            Write-Warning "Could not retrieve details for PID $PID. The process may have just closed."
        }
    }
}

# --- Example Usage ---
# You need to run this command in an elevated (Administrator) PowerShell window:
# Stop-Port-Process -Port 8080
