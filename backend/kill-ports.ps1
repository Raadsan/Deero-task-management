$ports = @(7003, 2003)
foreach ($port in $ports) {
    $lines = netstat -ano | Select-String "LISTENING"
    foreach ($line in $lines) {
        if ($line -match ":$port\s") {
            $parts = $line.ToString().Trim() -split '\s+'
            $procId = $parts[-1]
            if ($procId -match '^\d+$' -and $procId -ne '0') {
                Write-Host "Killing PID $procId on port $port"
                taskkill /PID $procId /F 2>&1
            }
        }
    }
}
Write-Host "Done"
