# Шаг 1: возвращаем main на исходник
$rootPkg = Get-Content package.json -Raw | ConvertFrom-Json
$rootPkg.main = "src/index.ts"

# Автоинкремент patch версии (1.0.0 -> 1.0.1 -> 1.0.2)
$ver = [System.Version]$rootPkg.version
$newVer = "$($ver.Major).$($ver.Minor).$($ver.Build + 1)"
$rootPkg.version = $newVer
$rootPkg | ConvertTo-Json -Depth 10 | Set-Content package.json
Write-Host "Версия: $newVer"

# Шаг 2: удаляем старые файлы
Remove-Item dist\js\*.mjs -ErrorAction SilentlyContinue
Remove-Item dist\js\*.map -ErrorAction SilentlyContinue

# Шаг 3: собираем
npx albatros-cli build
if ($LASTEXITCODE -ne 0) { Write-Host "Ошибка сборки!"; exit 1 }

# Шаг 4: обновляем main
$distPkg = Get-Content dist\package.json | ConvertFrom-Json
$newMain = "dist/" + $distPkg.main
$rootPkg = Get-Content package.json -Raw | ConvertFrom-Json
$rootPkg.main = $newMain
$rootPkg | ConvertTo-Json -Depth 10 | Set-Content package.json
Write-Host "main: $newMain"

# Шаг 5: пушим
git add .
git commit -m "Deploy $newVer`: $newMain"
git push
