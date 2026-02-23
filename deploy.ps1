# Убеждаемся что main = src/index.ts
$pkg = Get-Content package.json | ConvertFrom-Json
$pkg.main = "src/index.ts"
$pkg | ConvertTo-Json -Depth 10 | Set-Content package.json

# Собираем
npx albatros-cli build
if ($LASTEXITCODE -ne 0) { Write-Host "ОШИБКА СБОРКИ"; exit 1 }

# Читаем что albatros записал в dist/package.json
$distMain = (Get-Content dist\package.json | ConvertFrom-Json).main
Write-Host "albatros собрал: $distMain"

# Записываем правильный путь в корневой package.json
$pkg = Get-Content package.json | ConvertFrom-Json
$pkg.main = "dist/" + $distMain
$pkg | ConvertTo-Json -Depth 10 | Set-Content package.json
Write-Host "Итоговый main: dist/$distMain"

# Деплоим
git add .
git commit -m "Deploy: dist/$distMain"
git push

# Возвращаем main обратно на src/index.ts для следующей сборки
$pkg = Get-Content package.json | ConvertFrom-Json
$pkg.main = "src/index.ts"
$pkg | ConvertTo-Json -Depth 10 | Set-Content package.json
git add package.json
git commit -m "Reset main to src/index.ts"
git push
