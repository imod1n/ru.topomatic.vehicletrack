# Удаляем старые файлы dist/js перед сборкой
Remove-Item dist\js\*.mjs -ErrorAction SilentlyContinue
Remove-Item dist\js\*.map -ErrorAction SilentlyContinue

# Собираем
npx albatros-cli build

# Читаем новый main из dist/package.json
$distPkg = Get-Content dist\package.json | ConvertFrom-Json
$newMain = "dist/" + $distPkg.main

# Обновляем корневой package.json
$rootPkg = Get-Content package.json -Raw | ConvertFrom-Json
$rootPkg.main = $newMain
$rootPkg | ConvertTo-Json -Depth 10 | Set-Content package.json

Write-Host "main обновлён: $newMain"

# Проверка
Get-Content package.json | Select-String "main"

git add .
git commit -m "Deploy: $newMain"
git push
