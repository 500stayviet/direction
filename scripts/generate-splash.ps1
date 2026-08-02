Add-Type -AssemblyName System.Drawing

# 글자 간격을 조금 좁혀 한 줄로 그림
function Draw-TightString {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [System.Drawing.Brush]$Brush,
    [single]$CenterX,
    [single]$TopY,
    [single]$Tracking = 0.94
  )

  $format = [System.Drawing.StringFormat]::GenericTypographic.Clone()
  $format.FormatFlags = $format.FormatFlags -bor [System.Drawing.StringFormatFlags]::NoClip
  $format.Alignment = [System.Drawing.StringAlignment]::Near
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near

  $widths = @()
  $total = 0.0
  foreach ($ch in $Text.ToCharArray()) {
    $sz = $Graphics.MeasureString([string]$ch, $Font, [System.Drawing.PointF]::Empty, $format)
    $w = [Math]::Max(1.0, $sz.Width * $Tracking)
    $widths += $w
    $total += $w
  }

  $x = $CenterX - ($total / 2.0)
  $i = 0
  foreach ($ch in $Text.ToCharArray()) {
    $Graphics.DrawString([string]$ch, $Font, $Brush, $x, $TopY, $format)
    $x += $widths[$i]
    $i += 1
  }
  $format.Dispose()
}

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

  # 현장동선 / 제공 - 미스터k
  $title = -join @(
    [char]0xD604, [char]0xC7A5, [char]0xB3D9, [char]0xC120
  )
  $credit = -join @(
    [char]0xC81C, [char]0xACF5, " - ",
    [char]0xBBF8, [char]0xC2A4, [char]0xD130, "k"
  )

  # 평범한 고딕 — 타이틀은 아이콘 아래, 크레딧은 화면 맨 하단
  $titleSize = [Math]::Max(28, [int]($Width * 0.058))
  $titleFont = New-Object System.Drawing.Font "Malgun Gothic", $titleSize, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 25, 31, 40))
  $titleTop = $iconY + $iconSize + ($Height * 0.028)
  Draw-TightString -Graphics $g -Text $title -Font $titleFont -Brush $titleBrush -CenterX ($Width / 2.0) -TopY $titleTop -Tracking 0.92

  $creditSize = [Math]::Max(14, [int]($Width * 0.03))
  $creditFont = New-Object System.Drawing.Font "Malgun Gothic", $creditSize, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $creditBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 107, 114, 128))
  $creditFormat = [System.Drawing.StringFormat]::GenericTypographic.Clone()
  $creditSz = $g.MeasureString($credit, $creditFont, [System.Drawing.PointF]::Empty, $creditFormat)
  # 하단 여유를 넉넉히 — cover/잘림에도 보이도록
  $creditY = $Height - ($Height * 0.055) - $creditSz.Height
  $g.DrawString(
    $credit,
    $creditFont,
    $creditBrush,
    ($Width - $creditSz.Width) / 2,
    $creditY,
    $creditFormat
  )
  $creditFormat.Dispose()

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
