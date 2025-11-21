# myATO AI Chatbot - Containerized Deployment

This folder contains a containerized version of the myATO AI Chatbot application optimized for deployment to Azure Container Apps.

## 🐳 Container Optimization

The Docker image has been optimized for minimal size:
- Uses `python:3.11-slim` base image
- **CPU-only PyTorch** (no CUDA/GPU libraries) - saves ~4GB
- Minimal system dependencies
- Multi-stage build capabilities
- Non-root user for security
- Total image size: ~800MB (vs 4-5GB with CUDA)

## 📋 Prerequisites

- Docker Desktop or Docker Engine
- Azure CLI (for Azure deployment)
- Azure Container Registry (ACR)
- Azure Container Apps environment

## 🚀 Quick Start - Local Development

### 1. Set up environment variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your Azure credentials
nano .env
```

### 2. Build and run with Docker

#### Option A: Quick Build with PowerShell Script (Recommended)

```powershell
# Build and run the container locally
.\local-build.ps1
```

This script will:
- Check and stop any process using port 5000
- Build the Docker image
- Run the container with your .env file
- Open the application in your browser automatically

#### Option B: Manual Docker Build

```bash
# Build the Docker image
docker build -t myato-ai-chatbot:latest .

# Run the container
docker run -p 5000:5000 --env-file .env myato-ai-chatbot:latest
```

### 3. Access the application

Open your browser to `http://localhost:5000`

### Alternative: Use Docker Compose

```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

## ☁️ Azure Container Apps Deployment

### Option 1: Deploy using PowerShell Script (Recommended)

The easiest way to build and deploy to Azure Container Apps:

```powershell
# Deploy to development environment
.\build-and-deploy.ps1

# Deploy to production with specific version tag
.\build-and-deploy.ps1 -Environment prod -Version v1.0.0
```

This script will:
- Check prerequisites (Docker, Azure CLI)
- Login to Azure if needed
- Create resource group and Azure Container Registry (ACR)
- Build Docker image and push to ACR
- Create Container Apps environment
- Deploy the container app with proper configuration
- Display the application URL

### Option 2: Deploy using Azure CLI (Manual)

```bash
# 1. Login to Azure
az login

# 2. Set variables
RESOURCE_GROUP="myato-chatbot-rg"
LOCATION="eastus2"
ACR_NAME="myatochatbotacr"
CONTAINER_APP_ENV="myato-chatbot-env"
CONTAINER_APP_NAME="myato-ai-chatbot"

# 3. Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# 4. Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# 5. Build and push image to ACR
az acr build \
  --registry $ACR_NAME \
  --image myato-ai-chatbot:latest \
  --file Dockerfile .

# 6. Create Container Apps environment
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# 7. Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# 8. Deploy Container App
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image ${ACR_NAME}.azurecr.io/myato-ai-chatbot:latest \
  --target-port 5000 \
  --ingress external \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --cpu 1.0 \
  --memory 2Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --secrets \
    speech-key=$SPEECH_KEY \
    openai-api-key=$AZURE_OPENAI_API_KEY \
  --env-vars \
    SPEECH_REGION=eastus2 \
    SPEECH_KEY=secretref:speech-key \
    AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT \
    AZURE_OPENAI_API_KEY=secretref:openai-api-key \
    AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4 \
    ENABLE_WEBSOCKETS=True

# 9. Get the app URL
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

### Option 3: Deploy using Azure Portal

1. **Build and push image to ACR:**
   ```bash
   az acr build --registry <your-acr-name> --image myato-ai-chatbot:latest .
   ```

2. **Create Container App in Azure Portal:**
   - Go to Azure Portal → Container Apps
   - Click "Create"
   - Select your subscription and resource group
   - Set Container App name
   - Choose "Container image" from ACR
   - Configure environment variables (see .env.example)
   - Set ingress to "External" on port 5000
   - Set CPU: 1 core, Memory: 2GB
   - Enable autoscaling (min: 1, max: 3)

### Option 4: Deploy using Kubernetes (AKS)

```bash
# 1. Apply the Kubernetes deployment
kubectl apply -f kubernetes-deployment.yaml

# 2. Create secrets
kubectl create secret generic chatbot-secrets \
  --from-literal=speech-region=$SPEECH_REGION \
  --from-literal=speech-key=$SPEECH_KEY \
  --from-literal=openai-endpoint=$AZURE_OPENAI_ENDPOINT \
  --from-literal=openai-api-key=$AZURE_OPENAI_API_KEY

# 3. Get the external IP
kubectl get service myato-ai-chatbot-service
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `SPEECH_REGION` | Yes | Azure Speech Service region | `eastus2` |
| `SPEECH_KEY` | Yes | Azure Speech Service API key | - |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL | - |
| `AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI API key | - |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | No | OpenAI deployment name | `gpt-4` |
| `COGNITIVE_SEARCH_ENDPOINT` | No | Azure Cognitive Search endpoint | - |
| `COGNITIVE_SEARCH_API_KEY` | No | Azure Cognitive Search API key | - |
| `COGNITIVE_SEARCH_INDEX_NAME` | No | Search index name | - |
| `ENABLE_WEBSOCKETS` | No | Enable WebSocket support | `True` |

## 📊 Resource Requirements

### Minimum Requirements
- CPU: 0.5 cores
- Memory: 512 MB
- Storage: 1 GB

### Recommended for Production
- CPU: 1-2 cores
- Memory: 2 GB
- Storage: 2 GB
- Replicas: 2-3 (for high availability)

## 🔍 Monitoring

### Health Check Endpoint

The application includes a health check endpoint at `/health`:

```bash
curl http://localhost:5000/health
# Response: {"status": "healthy", "service": "myATO-AI-Chatbot"}
```

### View Logs

```bash
# Docker
docker logs <container-id> -f

# Azure Container Apps
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow

# Kubernetes
kubectl logs -f deployment/myato-ai-chatbot
```

## 🔒 Security Best Practices

1. **Never commit secrets** - Use Azure Key Vault or Container Apps secrets
2. **Use managed identities** - Enable system-assigned managed identity for Azure resources
3. **Network isolation** - Deploy in a VNET with private endpoints
4. **HTTPS only** - Configure custom domain with SSL certificate
5. **Regular updates** - Keep base image and dependencies updated

## 🎯 Cost Optimization

- Use **autoscaling** to scale down during low usage
- Choose **consumption plan** for Azure Container Apps
- Enable **scale to zero** for development environments
- Use **CPU-only PyTorch** (already configured) to reduce compute costs

## 🐛 Troubleshooting

### Container won't start
```bash
# Check logs
docker logs <container-id>

# Verify environment variables
docker inspect <container-id> | grep -A 20 "Env"
```

### Application not responding
```bash
# Check health endpoint
curl http://localhost:5000/health

# Check if port is exposed
docker ps
```

### Out of memory errors
- Increase memory allocation in deployment
- Check for memory leaks in application logs

## 📝 Development

### Local development with hot reload

```bash
# Mount local files for development
docker run -p 5000:5000 \
  -v $(pwd):/app \
  --env-file .env \
  myato-ai-chatbot:latest \
  python app.py
```

### Rebuild after changes

```bash
docker build --no-cache -t myato-ai-chatbot:latest .
```

## 📚 Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Azure Speech Service](https://learn.microsoft.com/azure/cognitive-services/speech-service/)
- [Azure OpenAI Service](https://learn.microsoft.com/azure/cognitive-services/openai/)

## 📄 License

Copyright (c) Microsoft. Licensed under the MIT license.
