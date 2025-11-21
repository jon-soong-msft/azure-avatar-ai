# Quick local build and test script
# Usage: .\local-build.ps1

param(
    [switch]$NoBuild,
    [switch]$Clean
)

$ImageName = "myato-ai-chatbot"
$ContainerName = "myato-chatbot-local"

Write-Host "🐳 Local Docker Build and Test" -ForegroundColor Cyan
Write-Host ""

# Check and stop any process using port 5000
Write-Host "Checking port 5000..." -ForegroundColor Yellow
$port5000 = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($port5000) {
    $processId = $port5000.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Found process using port 5000: $($process.Name) (PID: $processId)" -ForegroundColor Yellow
        
        # Check if it's a Docker container
        $dockerContainers = docker ps --format "{{.Names}}" 2>$null
        $stoppedContainer = $false
        foreach ($container in $dockerContainers) {
            $containerInfo = docker port $container 2>$null | Select-String "5000"
            if ($containerInfo) {
                Write-Host "Stopping Docker container: $container" -ForegroundColor Yellow
                docker stop $container 2>$null
                $stoppedContainer = $true
            }
        }
        
        # If not a Docker container, kill the process
        if (!$stoppedContainer) {
            Write-Host "Stopping process $($process.Name) (PID: $processId)..." -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    }
}

# Stop and remove existing container if it exists
if (docker ps -a --format '{{.Names}}' | Select-String -Pattern "^${ContainerName}$") {
    Write-Host "Stopping and removing existing container..." -ForegroundColor Yellow
    docker stop $ContainerName 2>$null
    docker rm $ContainerName 2>$null
}

# Clean old images if requested
if ($Clean) {
    Write-Host "Removing old images..." -ForegroundColor Yellow
    docker rmi $ImageName 2>$null
}

# Build the image
if (!$NoBuild) {
    Write-Host "Building Docker image..." -ForegroundColor Green
    docker build -t ${ImageName}:latest .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Build completed successfully!" -ForegroundColor Green
}

# Check if .env file exists
if (!(Test-Path ".env")) {
    Write-Host "Warning: .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Please edit .env file with your credentials before running." -ForegroundColor Red
        exit 1
    } else {
        Write-Host "Error: .env.example not found!" -ForegroundColor Red
        exit 1
    }
}

# Run the container
Write-Host "Starting container..." -ForegroundColor Green
docker run -d `
    --name $ContainerName `
    -p 5000:5000 `
    --env-file .env `
    ${ImageName}:latest

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Container started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Application: http://localhost:5000" -ForegroundColor Cyan
    Write-Host "🔍 Health Check: http://localhost:5000/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "View logs with: docker logs -f $ContainerName" -ForegroundColor Yellow
    Write-Host "Stop with: docker stop $ContainerName" -ForegroundColor Yellow
    Write-Host ""
    
    # Wait a bit and check health
    Start-Sleep -Seconds 5
    Write-Host "Checking health endpoint..." -ForegroundColor Green
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 10
        Write-Host "Health check passed! Status: $($response.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "Health check failed. Container may still be starting..." -ForegroundColor Yellow
        Write-Host "Check logs with: docker logs $ContainerName" -ForegroundColor Yellow
    }
} else {
    Write-Host "Failed to start container!" -ForegroundColor Red
    exit 1
}
