# Deployment Guide

This guide covers different deployment options for the Gearbox Disassembly Optimizer.

## GitHub Pages (Frontend Only)

GitHub Pages can host the static frontend, but the Flask backend must be deployed separately.

### Step 1: Prepare Frontend

1. Update API URL in `static/js/app.js`:
   ```javascript
   const API_BASE = 'https://your-backend-url.herokuapp.com/api';
   ```

2. Or use environment detection (already implemented):
   - Local: Uses `http://localhost:5000/api`
   - Production: Uses `window.API_BASE_URL` if set, or falls back to configured URL

### Step 2: Deploy to GitHub Pages

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

2. Go to repository Settings → Pages

3. Configure:
   - Source: Branch `main`
   - Folder: `/static` (or move `index.html` to root)
   - Save

4. Your site will be available at:
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

### Step 3: Deploy Backend (Choose one)

#### Option A: Heroku

1. Install Heroku CLI

2. Create `Procfile` in webapp directory:
   ```
   web: python app.py
   ```

3. Create `runtime.txt`:
   ```
   python-3.11.0
   ```

4. Deploy:
   ```bash
   heroku create your-app-name
   git subtree push --prefix webapp heroku main
   ```

#### Option B: Railway

1. Connect GitHub repository to Railway
2. Set root directory to `webapp`
3. Railway auto-detects Python and installs dependencies
4. Deploy

#### Option C: Render

1. Create new Web Service on Render
2. Connect GitHub repository
3. Settings:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python app.py`
   - Environment: Python 3
4. Deploy

#### Option D: PythonAnywhere

1. Upload files via web interface or Git
2. Configure WSGI file to point to `app.py`
3. Reload web app

## Full Stack Deployment (Single Server)

### Option: VPS (DigitalOcean, AWS EC2, etc.)

1. Set up server with Python 3.7+

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Use a process manager (PM2, systemd, supervisor):
   ```bash
   # Example with systemd
   sudo nano /etc/systemd/system/gearbox-app.service
   ```

4. Configure Nginx as reverse proxy:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

5. Enable HTTPS with Let's Encrypt

## Environment Variables

For production, consider using environment variables:

```python
# In app.py
import os
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
PORT = int(os.getenv('PORT', 5000))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=(FLASK_ENV == 'development'))
```

## CORS Configuration

The app already includes CORS configuration. For production:

```python
# In app.py
from flask_cors import CORS

# Allow specific origins in production
CORS(app, origins=[
    "https://your-username.github.io",
    "https://your-custom-domain.com"
])
```

## Testing Deployment

1. **Backend**: Test API endpoints:
   ```bash
   curl https://your-backend-url.com/api/components
   ```

2. **Frontend**: 
   - Open browser console
   - Check for CORS errors
   - Verify API calls are successful

3. **3D Models**: 
   - Ensure models are accessible
   - Check browser network tab for model loading

## Troubleshooting

**CORS Errors:**
- Ensure backend CORS is configured
- Check allowed origins match frontend URL

**API Not Found:**
- Verify backend URL in frontend code
- Check backend is running and accessible
- Verify route paths match

**3D Models Not Loading:**
- Check file paths are correct
- Verify CORS allows model file requests
- Check browser console for specific errors

