# Build and deploy script for Azure Container Apps (PowerShell)
# Usage: .\build-and-deploy.ps1 [-Environment dev] [-Version latest]

param(
    [string]$Environment = "dev",
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

# Configuration
$AppName = "myato-ai-chatbot"
$ImageName = "myato-ai-chatbot"

Write-Host "🚀 Building and deploying $AppName to $Environment environment..." -ForegroundColor Cyan

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Green

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed. Please install Docker first." -ForegroundColor Red
    exit 1
}

if (!(Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "Azure CLI is not installed. Please install Azure CLI first." -ForegroundColor Red
    exit 1
}

# Check Azure login
try {
    az account show | Out-Null
} catch {
    Write-Host "Not logged in to Azure. Running 'az login'..." -ForegroundColor Yellow
    az login
}

# Load environment variables
$envFile = ".env.$Environment"
if (!(Test-Path $envFile)) {
    $envFile = ".env"
}

if (Test-Path $envFile) {
    Write-Host "Loading environment variables from $envFile" -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# Set Azure variables
$ResourceGroup = if ($env:RESOURCE_GROUP) { $env:RESOURCE_GROUP } else { "myato-chatbot-rg" }
$Location = if ($env:LOCATION) { $env:LOCATION } else { "eastus2" }
$ACRName = if ($env:ACR_NAME) { $env:ACR_NAME } else { "myatochatbotacr" }
$ContainerAppEnv = if ($env:CONTAINER_APP_ENV) { $env:CONTAINER_APP_ENV } else { "myato-chatbot-$Environment-env" }
$ContainerAppName = if ($env:CONTAINER_APP_NAME) { $env:CONTAINER_APP_NAME } else { "myato-chatbot" }

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Environment: $Environment"
Write-Host "  Resource Group: $ResourceGroup"
Write-Host "  Location: $Location"
Write-Host "  ACR Name: $ACRName"
Write-Host "  Container App: $ContainerAppName"
Write-Host ""

# Create resource group
Write-Host "Ensuring resource group exists..." -ForegroundColor Green
try {
    az group show --name $ResourceGroup 2>$null | Out-Null
    Write-Host "Resource group $ResourceGroup already exists." -ForegroundColor Green
} catch {
    Write-Host "Creating resource group $ResourceGroup..." -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $Location
}

# Create ACR
Write-Host "Ensuring Azure Container Registry exists..." -ForegroundColor Green
try {
    az acr show --name $ACRName --resource-group $ResourceGroup 2>$null | Out-Null
    Write-Host "Azure Container Registry $ACRName already exists." -ForegroundColor Green
} catch {
    Write-Host "Creating Azure Container Registry $ACRName..." -ForegroundColor Yellow
    az acr create `
        --resource-group $ResourceGroup `
        --name $ACRName `
        --sku Basic `
        --admin-enabled true
}

# Build and push image
Write-Host "Building Docker image and pushing to ACR..." -ForegroundColor Green
az acr build `
    --registry $ACRName `
    --image "${ImageName}:${Version}" `
    --image "${ImageName}:latest" `
    --file Dockerfile `
    .

Write-Host "Image built and pushed successfully!" -ForegroundColor Green

# Create Container Apps environment
Write-Host "Ensuring Container Apps environment exists..." -ForegroundColor Green
try {
    az containerapp env show --name $ContainerAppEnv --resource-group $ResourceGroup 2>$null | Out-Null
    Write-Host "Container Apps environment $ContainerAppEnv already exists." -ForegroundColor Green
} catch {
    Write-Host "Creating Container Apps environment $ContainerAppEnv..." -ForegroundColor Yellow
    az containerapp env create `
        --name $ContainerAppEnv `
        --resource-group $ResourceGroup `
        --location $Location
}

# Get ACR credentials
Write-Host "Retrieving ACR credentials..." -ForegroundColor Green
$ACRUsername = az acr credential show --name $ACRName --query username -o tsv
$ACRPassword = az acr credential show --name $ACRName --query "passwords[0].value" -o tsv

# Deploy Container App
Write-Host "Deploying Container App..." -ForegroundColor Green

try {
    az containerapp show --name $ContainerAppName --resource-group $ResourceGroup 2>$null | Out-Null
    Write-Host "Updating existing Container App..." -ForegroundColor Yellow
    
    # Update secrets
    az containerapp secret set `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --secrets `
            "speech-key=$($env:SPEECH_KEY)" `
            "openai-api-key=$($env:AZURE_OPENAI_API_KEY)" `
            "cognitive-search-api-key=$($env:COGNITIVE_SEARCH_API_KEY)"
    
    # Update container app with new image and environment variables
    az containerapp update `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --image "${ACRName}.azurecr.io/${ImageName}:${Version}" `
        --set-env-vars `
            "SPEECH_REGION=$($env:SPEECH_REGION)" `
            "SPEECH_KEY=secretref:speech-key" `
            "AZURE_OPENAI_ENDPOINT=$($env:AZURE_OPENAI_ENDPOINT)" `
            "AZURE_OPENAI_API_KEY=secretref:openai-api-key" `
            "AZURE_OPENAI_DEPLOYMENT_NAME=$($env:AZURE_OPENAI_DEPLOYMENT_NAME)" `
            "COGNITIVE_SEARCH_ENDPOINT=$($env:COGNITIVE_SEARCH_ENDPOINT)" `
            "COGNITIVE_SEARCH_API_KEY=secretref:cognitive-search-api-key" `
            "COGNITIVE_SEARCH_INDEX_NAME=$($env:COGNITIVE_SEARCH_INDEX_NAME)" `
            "ENABLE_WEBSOCKETS=True"
} catch {
    Write-Host "Creating new Container App..." -ForegroundColor Yellow
    
    $openAIDeployment = if ($env:AZURE_OPENAI_DEPLOYMENT_NAME) { $env:AZURE_OPENAI_DEPLOYMENT_NAME } else { "gpt-4" }
    $enableWebSockets = if ($env:ENABLE_WEBSOCKETS) { $env:ENABLE_WEBSOCKETS } else { "True" }
    
    az containerapp create `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --environment $ContainerAppEnv `
        --image "${ACRName}.azurecr.io/${ImageName}:${Version}" `
        --target-port 5000 `
        --ingress external `
        --registry-server "${ACRName}.azurecr.io" `
        --registry-username $ACRUsername `
        --registry-password $ACRPassword `
        --cpu 1.0 `
        --memory 2Gi `
        --min-replicas 1 `
        --max-replicas 3 `
        --secrets `
            "speech-key=$($env:SPEECH_KEY)" `
            "openai-api-key=$($env:AZURE_OPENAI_API_KEY)" `
            "cognitive-search-api-key=$($env:COGNITIVE_SEARCH_API_KEY)" `
        --env-vars `
            "SPEECH_REGION=$($env:SPEECH_REGION)" `
            "SPEECH_KEY=secretref:speech-key" `
            "AZURE_OPENAI_ENDPOINT=$($env:AZURE_OPENAI_ENDPOINT)" `
            "AZURE_OPENAI_API_KEY=secretref:openai-api-key" `
            "AZURE_OPENAI_DEPLOYMENT_NAME=$openAIDeployment" `
            "COGNITIVE_SEARCH_ENDPOINT=$($env:COGNITIVE_SEARCH_ENDPOINT)" `
            "COGNITIVE_SEARCH_API_KEY=secretref:cognitive-search-api-key" `
            "COGNITIVE_SEARCH_INDEX_NAME=$($env:COGNITIVE_SEARCH_INDEX_NAME)" `
            "ENABLE_WEBSOCKETS=$enableWebSockets"
}

# Get application URL
Write-Host "Deployment complete!" -ForegroundColor Green
$AppURL = az containerapp show `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --query properties.configuration.ingress.fqdn `
    --output tsv

Write-Host ""
Write-Host "✅ Application deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Application URL: https://$AppURL" -ForegroundColor Cyan
Write-Host "🔍 Health Check: https://$AppURL/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view logs, run:" -ForegroundColor Yellow
Write-Host "  az containerapp logs show --name $ContainerAppName --resource-group $ResourceGroup --follow" -ForegroundColor White
Write-Host ""
