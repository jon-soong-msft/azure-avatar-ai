# Use full Python image (required for Azure Speech SDK native libraries)
FROM python:3.11

# Set working directory
WORKDIR /app

# Install Azure Speech SDK system dependencies per Microsoft documentation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl-dev \
    libasound2-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
# Use --no-cache-dir to reduce image size
# Install CPU-only PyTorch to avoid CUDA bloat
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir torch==2.1.0 --index-url https://download.pytorch.org/whl/cpu

# Copy application files
COPY . .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/health')" || exit 1

# Run the application with Flask-SocketIO's built-in server (production-ready with eventlet)
CMD ["python", "app.py"]
