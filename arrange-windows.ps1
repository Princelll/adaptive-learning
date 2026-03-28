# arrange-windows.ps1
# Positions simulator windows to match the layout:
#   Left  62% : Companion browser tab
#   Right 38% top    : Glasses Display
#   Right 38% bottom : Browser (G2 app)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinArrange {
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern int  GetWindowText(IntPtr h, StringBuilder s, int m);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
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

$found = @{}

$cb = [WinArrange+EnumProc] {
    param($hwnd, $lp)
    if (-not [WinArrange]::IsWindowVisible($hwnd)) { return $true }
    $sb = New-Object System.Text.StringBuilder 512
    [WinArrange]::GetWindowText($hwnd, $sb, 512) | Out-Null
    $t = $sb.ToString()
    if (-not $t) { return $true }

    if ($t -match 'StudyHub Mobile') { $found['companion'] = $hwnd }
    elseif ($t -match 'Glasses Display')  { $found['glasses']   = $hwnd }
    elseif ($t -eq 'Browser')             { $found['g2']        = $hwnd }
    return $true
}
[WinArrange]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null

$SW_RESTORE = 9
foreach ($h in $found.Values) { [WinArrange]::ShowWindow($h, $SW_RESTORE) | Out-Null }

if ($found['companion']) { [WinArrange]::MoveWindow($found['companion'], 0,       0,      $leftW, $H,     $true) | Out-Null; Write-Host "  Companion  -> left panel" }
if ($found['glasses'])   { [WinArrange]::MoveWindow($found['glasses'],   $rightX, 0,      $rightW,$halfH, $true) | Out-Null; Write-Host "  Glasses    -> top right"  }
if ($found['g2'])        { [WinArrange]::MoveWindow($found['g2'],        $rightX, $halfH, $rightW,$halfH, $true) | Out-Null; Write-Host "  G2 Browser -> bottom right" }

if ($found.Count -eq 0) { Write-Host "  No windows found yet — try running again in a few seconds." }
