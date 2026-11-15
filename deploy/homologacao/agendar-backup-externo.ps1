# Agenda a cópia externa diária (08:30) no Agendador de Tarefas do Windows, para o usuário atual.
# Rodar UMA VEZ no PowerShell, a partir da pasta do portal:
#   powershell -ExecutionPolicy Bypass -File deploy\homologacao\agendar-backup-externo.ps1
# Se o PC estiver desligado às 08:30, roda assim que for ligado. Para remover:
#   Unregister-ScheduledTask -TaskName "RCC Portal - backup externo" -Confirm:$false
$ErrorActionPreference = "Stop"
$bash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $bash)) { throw "Git Bash nao encontrado em $bash" }
$raiz = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$unix = "/" + $raiz.Substring(0,1).ToLower() + ($raiz.Substring(2) -replace "\\", "/")
$acao = New-ScheduledTaskAction -Execute $bash -Argument ('"' + $unix + '/deploy/homologacao/backup-externo.sh"')
$gatilho = New-ScheduledTaskTrigger -Daily -At "08:30"
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "RCC Portal - backup externo" -Description "Copia externa criptografada do backup da homologacao do Portal RCC (D:\Dados Backup Claude Projetos\RCC ARQUIDIOCESANO)" -Action $acao -Trigger $gatilho -Settings $config -Force | Out-Null
Start-ScheduledTask -TaskName "RCC Portal - backup externo"
Write-Host "Tarefa criada e executada uma vez agora. Resultado em: D:\Dados Backup Claude Projetos\RCC ARQUIDIOCESANO\backup-externo.log"
