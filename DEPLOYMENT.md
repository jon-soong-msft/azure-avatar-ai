# Containerized Application - File Structure

## 📁 Directory Structure

```
src/
├── app.py                          # Main Flask application (with health check)
├── vad_iterator.py                 # Voice Activity Detection module
├── Dockerfile                      # Optimized Docker configuration
├── requirements.txt                # Python dependencies (minimal, CPU-only)
├── .dockerignore                   # Files to exclude from Docker build
├── .env.example                    # Example environment configuration
├── docker-compose.yml              # Docker Compose configuration
├── kubernetes-deployment.yaml      # Kubernetes/AKS deployment manifest
├── README.md                       # Comprehensive deployment guide
├── build-and-deploy.sh            # Bash deployment script (Linux/Mac)
├── build-and-deploy.ps1           # PowerShell deployment script (Windows)
├── local-build.ps1                # Local testing script
├── DEPLOYMENT.md                   # This file
├── templates/
│   └── chat.html                   # Main chat interface
└── static/
    ├── css/
    │   └── styles.css              # Modern, professional styling
    ├── js/
    │   ├── chat.js                 # Chat functionality
    │   └── basic.js                # Basic interface (if exists)
    ├── image/
    │   └── (favicon, logos, etc.)
    └── video/
        └── (avatar videos if exists)
```

## 🎯 Key Features

### Docker Optimization
- **Base Image**: `python:3.11-slim` (minimal footprint)
- **CPU-only PyTorch**: Excludes CUDA/GPU libraries (saves ~4GB)
- **Image Size**: ~800MB (vs 4-5GB with CUDA)
- **Multi-stage ready**: Can be further optimized
- **Non-root user**: Enhanced security
- **Health checks**: Built-in monitoring

### Application Features
- Health check endpoint at `/health`
- WebSocket support for real-time communication
- Azure Speech Service integration
- Azure OpenAI integration
- Configurable via environment variables
- Production-ready with Gunicorn + Eventlet

## 🚀 Quick Start

### Local Testing
```powershell
# 1. Set up environment
cd src
copy .env.example .env
# Edit .env with your credentials

# 2. Build and run
.\local-build.ps1

# 3. Access the app
# http://localhost:5000
```

### Deploy to Azure Container Apps
```powershell
# Deploy to development environment
.\build-and-deploy.ps1 -Environment dev

# Deploy to production
.\build-and-deploy.ps1 -Environment prod
```

## 📊 Resource Optimization

### Image Size Comparison
| Configuration | Size | Notes |
|--------------|------|-------|
| With CUDA | ~4.5 GB | Includes GPU libraries |
| **CPU-only (Optimized)** | **~800 MB** | **This implementation** |
| With additional optimization | ~600 MB | Possible with multi-stage |

### Runtime Resources
- **Minimum**: 512MB RAM, 0.5 CPU
- **Recommended**: 2GB RAM, 1 CPU
- **Scaling**: 1-3 replicas based on load

## ☁️ Deployment Options

1. **Azure Container Apps** (Recommended)
   - Serverless container platform
   - Built-in scaling and load balancing
   - Pay-per-use pricing
   - Simple deployment with CLI

2. **Azure Kubernetes Service (AKS)**
   - Full Kubernetes control
   - Advanced orchestration
   - Best for complex workloads

3. **Azure App Service**
   - Web container hosting
   - Integrated with DevOps
   - Managed platform

4. **Docker Compose**
   - Local development
   - Simple multi-container apps
   - Quick testing

## 🔒 Security

- Non-root container user
- Secrets managed via Azure Key Vault or Container Apps secrets
- Environment variables for configuration
- HTTPS enforced in production
- Regular security updates

## 📈 Monitoring

- Health check endpoint: `/health`
- Azure Container Apps built-in logging
- Application Insights integration ready
- Custom metrics can be added

## 💰 Cost Optimization

1. **Autoscaling**: Scale down during low usage
2. **Consumption plan**: Pay only for active time
3. **CPU-only compute**: No expensive GPU costs
4. **Scale to zero**: For dev/test environments
5. **Resource limits**: Prevent over-provisioning

## 🛠️ Maintenance

### Update Application
```powershell
# Pull latest code
git pull

# Rebuild and deploy
.\build-and-deploy.ps1
```

### View Logs
```powershell
# Azure Container Apps
az containerapp logs show --name <app-name> --resource-group <rg> --follow

# Local Docker
docker logs -f myato-chatbot-local
```

### Troubleshooting
1. Check health endpoint: `curl http://localhost:5000/health`
2. View container logs: `docker logs <container-id>`
3. Verify environment variables are set
4. Check Azure resource status in Portal

## 📝 Environment Variables Required

- `SPEECH_REGION` - Azure Speech Service region
- `SPEECH_KEY` - Azure Speech Service API key
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Deployment name (optional, default: gpt-4)

## 🎓 Next Steps

1. **Test locally** using `local-build.ps1`
2. **Deploy to dev** using `build-and-deploy.ps1 -Environment dev`
3. **Configure custom domain** in Azure Portal
4. **Set up CI/CD** with GitHub Actions or Azure DevOps
5. **Enable monitoring** with Application Insights
6. **Configure autoscaling** based on metrics

## 📚 Additional Documentation

- See `README.md` for detailed deployment instructions
- Check `Dockerfile` for build configuration
- Review `docker-compose.yml` for local development
- Examine `kubernetes-deployment.yaml` for AKS deployment

---

**Ready for Production** ✅
- Optimized for size and performance
- Secure by default
- Fully documented
- Easy to deploy and maintain
