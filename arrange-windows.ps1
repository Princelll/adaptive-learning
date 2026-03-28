# arrange-windows.ps1
# Positions simulator windows to match the layout:
#   Left  62% : Companion browser tab (StudyHub Mobile)
#   Right 38% top    : Glasses Display
#   Right 38% bottom : Browser (G2 app)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinArrange {
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr i, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern int  GetWindowText(IntPtr h, StringBuilder s, int m);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
    [DllImport("user32.dll")] public static extern int  GetWindowTextLength(IntPtr h);
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
}
'@

Add-Type -Assembly System.Windows.Forms
$area   = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$W      = $area.Width
$H      = $area.Height
$leftW  = [int]($W * 0.62)
$rightX = $leftW
$rightW = $W - $leftW
$halfH  = [int]($H / 2)

Write-Host "Screen working area: ${W}x${H}"
Write-Host "Layout: companion=0,0,${leftW},${H}  |  glasses=${rightX},0,${rightW},${halfH}  |  g2=${rightX},${halfH},${rightW},${halfH}"
Write-Host ""

# Enumerate all visible top-level windows and print their titles
$allTitles = [System.Collections.Generic.List[string]]::new()
$found     = @{}

$cb = [WinArrange+EnumProc] {
    param($hwnd, $lp)
    if (-not [WinArrange]::IsWindowVisible($hwnd)) { return $true }
    $len = [WinArrange]::GetWindowTextLength($hwnd)
    if ($len -eq 0) { return $true }
    $sb = New-Object System.Text.StringBuilder ($len + 2)
    [WinArrange]::GetWindowText($hwnd, $sb, $sb.Capacity) | Out-Null
    $t = $sb.ToString().Trim()
    if (-not $t) { return $true }

    $allTitles.Add($t) | Out-Null

    if ($t -match 'StudyHub')                        { $found['companion'] = $hwnd }
    elseif ($t -match 'Glasses\s*Display')           { $found['glasses']   = $hwnd }
    elseif ($t -match '^Browser$|Even.*Browser|Browser.*Even') { $found['g2'] = $hwnd }
    return $true
}
[WinArrange]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null

Write-Host "=== All visible windows ==="
$allTitles | Sort-Object | ForEach-Object { Write-Host "  [$_]" }
Write-Host ""
Write-Host "=== Matched ==="
Write-Host "  companion : $($found['companion'])"
Write-Host "  glasses   : $($found['glasses'])"
Write-Host "  g2        : $($found['g2'])"
Write-Host ""

$SW_RESTORE   = 9
$SWP_SHOWWIN  = 0x0040
foreach ($h in $found.Values) {
    [WinArrange]::ShowWindow($h, $SW_RESTORE) | Out-Null
}

function Move-Win($hwnd, $x, $y, $w, $h) {
    [WinArrange]::SetWindowPos($hwnd, [IntPtr]::Zero, $x, $y, $w, $h, $SWP_SHOWWIN) | Out-Null
    [WinArrange]::MoveWindow($hwnd, $x, $y, $w, $h, $true) | Out-Null
}

if ($found['companion']) { Move-Win $found['companion'] 0       0      $leftW  $H;      Write-Host "  Moved: companion  -> left panel" }
if ($found['glasses'])   { Move-Win $found['glasses']   $rightX 0      $rightW $halfH;  Write-Host "  Moved: glasses    -> top right"  }
if ($found['g2'])        { Move-Win $found['g2']        $rightX $halfH $rightW $halfH;  Write-Host "  Moved: g2 browser -> bottom right" }

if ($found.Count -eq 0) {
    Write-Host "No target windows found — check the [All visible windows] list above"
    Write-Host "and update the matching patterns in arrange-windows.ps1."
}

Read-Host "`nPress Enter to close"
