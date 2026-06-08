param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "update: apply changes"
)

Write-Host "=== GitHub Push ===" -ForegroundColor Cyan
git add -A

$status = git status --short
if (-not $status) {
    Write-Host "변경사항 없음 - push 스킵" -ForegroundColor Yellow
    exit 0
}

Write-Host "변경 파일:" -ForegroundColor Gray
Write-Host $status

git commit -m $Message
git push origin main

Write-Host "`n✅ Push 완료! https://github.com/ShinHeeYoun/Destination2" -ForegroundColor Green
