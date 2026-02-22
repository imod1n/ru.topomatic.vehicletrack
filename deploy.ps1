# deploy.ps1 - запускать вместо ручных команд
npx albatros-cli build

# Читаем main из dist/package.json (там всегда правильное имя)
$distPkg = Get-Content dist\package.json | ConvertFrom-Json
$newMain = "dist/" + $distPkg.main

# Читаем корневой package.json как объект и меняем main
$rootPkg = Get-Content package.json | ConvertFrom-Json
$rootPkg.main = $newMain

# Сохраняем обратно
$rootPkg | ConvertTo-Json -Depth 10 | Set-Content package.json

Write-Host "main обновлён: $newMain"

git add .
git commit -m "Deploy: $newMain"
git push