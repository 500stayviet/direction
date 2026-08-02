Add-Type -AssemblyName System.Drawing

function New-Splash {
  param(
    [int]$Width,
    [int]$Height,
    [string]$OutPath
  )

  $bmp = New-Object System.Drawing.Bitmap $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.InterpolationMode = "HighQualityBicubic"
  $g.TextRenderingHint = "ClearTypeGridFit"
  $g.Clear([System.Drawing.Color]::FromArgb(255, 249, 250, 251))

  $root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  $iconPath = Join-Path $root "public\icon-512.png"
  $icon = [System.Drawing.Image]::FromFile($iconPath)

  $iconSize = [int]([Math]::Min($Width, $Height) * 0.28)
  $iconX = [int](($Width - $iconSize) / 2)
  $iconY = [int]($Height * 0.34)
  $radius = [Math]::Max(8, [int]($iconSize * 0.22))

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($iconX, $iconY, $radius * 2, $radius * 2, 180, 90)
  $path.AddArc($iconX + $iconSize - $radius * 2, $iconY, $radius * 2, $radius * 2, 270, 90)
  $path.AddArc($iconX + $iconSize - $radius * 2, $iconY + $iconSize - $radius * 2, $radius * 2, $radius * 2, 0, 90)
  $path.AddArc($iconX, $iconY + $iconSize - $radius * 2, $radius * 2, $radius * 2, 90, 90)
  $path.CloseFigure()
  $g.SetClip($path)
  $g.DrawImage($icon, $iconX, $iconY, $iconSize, $iconSize)
  $g.ResetClip()
  $icon.Dispose()
  $path.Dispose()

  # 파일 인코딩과 무관하게 한글 유지 (현장동선 / 제공 - 미스터k)
  $title = -join @(
    [char]0xD604, [char]0xC7A5, [char]0xB3D9, [char]0xC120
  )
  $credit = -join @(
    [char]0xC81C, [char]0xACF5, " - ",
    [char]0xBBF8, [char]0xC2A4, [char]0xD130, "k"
  )

  $titleSize = [Math]::Max(36, [int]($Width * 0.075))
  $titleFont = New-Object System.Drawing.Font "Malgun Gothic", $titleSize, ([System.Drawing.FontStyle]::Bold)
  $titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 25, 31, 40))
  $titleSz = $g.MeasureString($title, $titleFont)
  $g.DrawString(
    $title,
    $titleFont,
    $titleBrush,
    ($Width - $titleSz.Width) / 2,
    $iconY + $iconSize + ($Height * 0.035)
  )

  $creditSize = [Math]::Max(14, [int]($Width * 0.032))
  $creditFont = New-Object System.Drawing.Font "Malgun Gothic", $creditSize, ([System.Drawing.FontStyle]::Regular)
  $creditBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 107, 114, 128))
  $creditSz = $g.MeasureString($credit, $creditFont)
  $g.DrawString(
    $credit,
    $creditFont,
    $creditBrush,
    ($Width - $creditSz.Width) / 2,
    $Height - ($Height * 0.08) - $creditSz.Height
  )

  $dir = Split-Path $OutPath -Parent
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $titleFont.Dispose()
  $creditFont.Dispose()
  $titleBrush.Dispose()
  $creditBrush.Dispose()
  Write-Host "wrote $OutPath"
}

$public = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "public\splash"
New-Splash 1170 2532 (Join-Path $public "apple-1170x2532.png")
New-Splash 1179 2556 (Join-Path $public "apple-1179x2556.png")
New-Splash 1284 2778 (Join-Path $public "apple-1284x2778.png")
New-Splash 1290 2796 (Join-Path $public "apple-1290x2796.png")
New-Splash 1125 2436 (Join-Path $public "apple-1125x2436.png")
New-Splash 828 1792 (Join-Path $public "apple-828x1792.png")
New-Splash 750 1334 (Join-Path $public "apple-750x1334.png")
New-Splash 1242 2208 (Join-Path $public "apple-1242x2208.png")
New-Splash 1080 1920 (Join-Path $public "android-1080x1920.png")
Write-Host "splash images done"
