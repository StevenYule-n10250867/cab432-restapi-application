# =========================
# Video Transcode E2E Test (evidence-focused)
# =========================

# === CONFIG ===
$BaseUrl   = "http://localhost:3000"  # e.g. "http://ec2-3-26-165-186.ap-southeast-2.compute.amazonaws.com:3000"
$Username  = "admin"
$Password  = "adminpass"
$VideoPath = "C:/Users/steve/OneDrive/Documents/CAB432-RestAPI-Application/uploads/file_example_MP4_1920_18MG.mp4"

# Polling behavior
$PollIntervalSec = 2
$PollTimeoutSec  = 600   # 10 minutes

function ThrowIfError($resp) { if (-not $resp) { throw "Empty response." } }

function Format-Bytes([long]$bytes) {
  if ($bytes -ge 1GB) { "{0:N2} GB" -f ($bytes/1GB) }
  elseif ($bytes -ge 1MB) { "{0:N2} MB" -f ($bytes/1MB) }
  elseif ($bytes -ge 1KB) { "{0:N2} KB" -f ($bytes/1KB) }
  else { "$bytes B" }
}

function Short-Hash([string]$hex) { if ([string]::IsNullOrEmpty($hex)) { "" } else { $hex.Substring(0,12) + "..." } }

# Ensure curl.exe exists for multipart upload
if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
  throw "curl.exe not found on PATH (needed for multipart upload)."
}

Write-Host "==> Logging in..."
try {
  $loginResp = Invoke-RestMethod -Uri "$BaseUrl/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body (@{ username = $Username; password = $Password } | ConvertTo-Json)
  ThrowIfError $loginResp
} catch { throw "Login failed: $($_.Exception.Message)" }
$token = $loginResp.token
Write-Host "    Got token."

# ---- Upload ----
Write-Host "==> Uploading video..."
if (-not (Test-Path -LiteralPath $VideoPath)) { throw "Video file not found at path: $VideoPath" }

$uploadJson = curl.exe -s -X POST "$BaseUrl/video/upload" `
  -H "Authorization: Bearer $token" `
  -F "video=@$VideoPath"

try {
  $upload = $uploadJson | ConvertFrom-Json
  ThrowIfError $upload
} catch {
  Write-Host "Raw upload response:" $uploadJson
  throw "Upload failed or returned non-JSON. $($_.Exception.Message)"
}
$filename = $upload.filename
if (-not $filename) { throw "Upload succeeded but no 'filename' returned." }
Write-Host "    Uploaded as temp filename: $filename"

# ---- Create transcode job (ASYNC) ----
Write-Host "==> Creating transcode job..."
try {
  $jobCreate = Invoke-RestMethod -Uri "$BaseUrl/jobs/transcode" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Method POST -ContentType "application/json" `
    -Body (@{ filename = $filename } | ConvertTo-Json)
  ThrowIfError $jobCreate
} catch { throw "Transcode job creation failed: $($_.Exception.Message)" }

$jobId = $jobCreate.jobId
if (-not $jobId) { throw "Job creation response did not include 'jobId'. Raw: $(ConvertTo-Json $jobCreate -Depth 5)" }
Write-Host "    Job accepted. ID: $jobId"
Write-Host "    Polling status (every $PollIntervalSec s, timeout ${PollTimeoutSec}s)..."

# ---- Poll until done/failed ----
$deadline = (Get-Date).AddSeconds($PollTimeoutSec)
$lastStatus = $null
$job = $null

while ($true) {
  try {
    $job = Invoke-RestMethod -Uri "$BaseUrl/jobs/$jobId" `
      -Headers @{ Authorization = "Bearer $token" } `
      -Method GET
    ThrowIfError $job
  } catch { throw "Failed to get job status: $($_.Exception.Message)" }

  $status = $job.status
  if ($status -ne $lastStatus) {
    Write-Host ("    [" + (Get-Date).ToString("HH:mm:ss") + "] Status: " + $status)
    $lastStatus = $status
  }

  if ($status -eq "done") { break }
  if ($status -eq "failed") { throw "Transcode failed. Error: $($job.error)" }
  if ((Get-Date) -ge $deadline) { throw "Timed out waiting for job completion after $PollTimeoutSec seconds." }

  Start-Sleep -Seconds $PollIntervalSec
}

# ---- Summarise ----
Write-Host "==> Transcode complete. Evidence summary:"

# Input metrics (if present)
$in = $job.input
if ($in) {
  $inMeta = $in.meta
  $inFmt  = $inMeta.format
  $inDurS = 0; if ($inFmt.duration) { [double]::TryParse($inFmt.duration, [ref]$inDurS) | Out-Null }
  $inVid  = $inMeta.streams | Where-Object { $_.codec_type -eq 'video' } | Select-Object -First 1
  $inRes  = if ($inVid) { "$($inVid.width)x$($inVid.height)" } else { "" }
  Write-Host ("    Input:  {0}  size={1}  sha256={2}" -f $in.path, (Format-Bytes $in.sizeBytes), (Short-Hash $in.sha256))
  if ($inVid) { Write-Host ("            codec={0}  res={1}  duration={2:N2}s" -f $inVid.codec_name, $inRes, $inDurS) }
}

# Output metrics
if ($job.outputs -and $job.outputs.Count -gt 0) {
  $out     = $job.outputs[0]
  $outMeta = $out.meta
  $outFmt  = $outMeta.format
  $outDurS = 0; if ($outFmt.duration) { [double]::TryParse($outFmt.duration, [ref]$outDurS) | Out-Null }
  $outVid  = $outMeta.streams | Where-Object { $_.codec_type -eq 'video' } | Select-Object -First 1
  $outRes  = if ($outVid) { "$($outVid.width)x$($outVid.height)" } else { "" }

  # size delta if input present
  $delta = if ($in -and $in.sizeBytes) { 
    $pct = 0; if ($out.sizeBytes -and $in.sizeBytes) { $pct = (1.0 - ($out.sizeBytes / [double]$in.sizeBytes)) * 100.0 }
    "  (Δ≈{0:N1}% vs input)" -f $pct
  } else { "" }

  Write-Host ("    Output: {0}  size={1}{2}  sha256={3}" -f $out.path, (Format-Bytes $out.sizeBytes), $delta, (Short-Hash $out.sha256))
  if ($outVid) { Write-Host ("            codec={0}  res={1}  duration={2:N2}s" -f $outVid.codec_name, $outRes, $outDurS) }
  if ($job.elapsedMs) { Write-Host ("    Elapsed: {0} ms (~{1:N2}s)" -f $job.elapsedMs, ($job.elapsedMs/1000.0)) }
} else {
  Write-Host "    Warning: outputs missing in job JSON."
}

# Thumbnails
if ($job.thumbnails -and $job.thumbnails.Count -gt 0) {
  Write-Host "    Thumbnails:"
  $job.thumbnails | ForEach-Object { Write-Host ("      - " + ($BaseUrl.TrimEnd('/') + $_)) }
}

# ---- Done: show output URL + open report ----
if ($job.outputs -and $job.outputs.Count -gt 0) {
  $first = $job.outputs[0]
  $fullUrl = $BaseUrl.TrimEnd('/') + $first.path
  Write-Host ""
  Write-Host "Open video:"
  Write-Host "  $fullUrl"
}

$reportUrl = "$BaseUrl/jobs/$jobId/report"
Write-Host ""
Write-Host "Open HTML report:"
Write-Host "  $reportUrl"
try {
  # save evidence locally too
  $jsonPath   = "job-$jobId.json"
  $htmlPath   = "job-$jobId-report.html"
  ($job | ConvertTo-Json -Depth 10) | Out-File -FilePath $jsonPath -Encoding utf8
  Invoke-WebRequest -Uri $reportUrl -Headers @{ Authorization = "Bearer $token" } -OutFile $htmlPath | Out-Null
  Write-Host "Saved: $jsonPath , $htmlPath"
} catch {
  Write-Host "Could not save report locally: $($_.Exception.Message)"
}
Start-Process $reportUrl
