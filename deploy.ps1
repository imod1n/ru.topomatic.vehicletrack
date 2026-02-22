# Шаг 1: возвращаем main на исходник перед сборкой
$rootPkg = Get-Content package.json -Raw | ConvertFrom-Json
$rootPkg.main = "src/index.ts"
$rootPkg | ConvertTo-Json -Depth 10 | Set-Content package.json

# Шаг 2: удаляем старые файлы
Remove-Item dist\js\*.mjs -ErrorAction SilentlyContinue
Remove-Item dist\js\*.map -ErrorAction SilentlyContinue

# Шаг 3: собираем
npx albatros-cli build
if ($LASTEXITCODE -ne 0) { Write-Host "Ошибка сборки!"; exit 1 }

# Шаг 4: обновляем main на новый собранный файл
$distPkg = Get-Content dist\package.json | ConvertFrom-Json
$newMain = "dist/" + $distPkg.main
$rootPkg = Get-Content package.json -Raw | ConvertFrom-Json
$rootPkg.main = $newMain
$rootPkg | ConvertTo-Json -Depth 10 | Set-Content package.json

Write-Host "main обновлён: $newMain"
Get-Content package.json | Select-String "main"

# Шаг 5: пушим
git add .
git commit -m "Deploy: $newMain"
git push
