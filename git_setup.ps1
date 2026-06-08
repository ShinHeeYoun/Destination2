$username = "ShinHeeYoun"
$repoName = "Destination2"

# Windows Credential Manager에 GitHub 자격증명 저장
Write-Host "=== GitHub 자격증명 등록 ===" -ForegroundColor Cyan
$env:GIT_ASKPASS = ""

# credential store 설정
git config --global credential.helper manager

# Git 초기화
Write-Host "`n=== Git 초기화 ===" -ForegroundColor Cyan
git init
git config user.name "ShinHeeYoun"
git config user.email "eustaph7725@gmail.com"

# Remote 설정 (토큰 없이 HTTPS)
Write-Host "`n=== Remote 설정 ===" -ForegroundColor Cyan
git remote add origin "https://github.com/$username/$repoName.git"

# 불필요한 파일 제외 확인
Write-Host "`n=== 파일 추가 ===" -ForegroundColor Cyan
git add .
git status --short

# 첫 커밋
Write-Host "`n=== 첫 커밋 ===" -ForegroundColor Cyan
git commit -m "feat: initial PWA destination alert app

- Leaflet.js map with dark CartoDB tile layer
- Real-time GPS tracking (Haversine distance formula)
- Service Worker for background push notifications
- Web Audio API alert sound, Vibration API
- Modular: MapComponent, Dashboard, SettingsPanel
- locationService, notificationService
- PWA manifest.json + icons
- Glassmorphism dark mode responsive UI (mobile + desktop)"

# main 브랜치 설정 후 push
Write-Host "`n=== Push to main ===" -ForegroundColor Cyan
git branch -M main
git push -u origin main

Write-Host "`n✅ Done! https://github.com/$username/$repoName" -ForegroundColor Green
