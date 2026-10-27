# From PowerShell: .\deploy\deploy.ps1 setup | env | [REF]
# Runs deploy.sh in Git Bash; a bare `bash` here is WSL, which has other ssh keys.
& "$env:ProgramFiles\Git\bin\bash.exe" "$PSScriptRoot/deploy.sh" @args
exit $LASTEXITCODE
