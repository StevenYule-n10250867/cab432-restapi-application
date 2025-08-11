# === CONFIG ===
$BaseUrl = "http://localhost:3000"
$Username = "admin"
$Password = "adminpass"
$VideoPath = "C:/Users/steve/OneDrive/Documents/CAB432-RestAPI-Application/uploads/file_example_MP4_1920_18MG.mp4"

# === LOGIN ===
Write-Host "Logging in..."
$response = Invoke-RestMethod -Uri "$BaseUrl/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body (@{ username = $Username; password = $Password } | ConvertTo-Json)

$token = $response.token
Write-Host "Got token:" $token

# === UPLOAD ===
Write-Host "Uploading video..."
$uploadJson = curl.exe -s -X POST "$BaseUrl/video/upload" `
    -H "Authorization: Bearer $token" `
    -F "video=@$VideoPath"

# Parse the JSON from curl output
$upload = $uploadJson | ConvertFrom-Json
$filename = $upload.filename
Write-Host "Uploaded file as:" $filename

# === TRANSCODE ===
Write-Host "Starting transcode..."
$transcode = Invoke-RestMethod -Uri "$BaseUrl/video/transcode" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Method POST `
    -ContentType "application/json" `
    -Body (@{ filename = $filename } | ConvertTo-Json)

Write-Host "Transcode finished!"
$transcode | Format-List
