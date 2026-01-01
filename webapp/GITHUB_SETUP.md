# GitHub Setup Guide

This guide will help you set up the Gearbox Disassembly Optimizer on GitHub.

## ⚠️ Important: Where to Run Commands

**All Git commands should be run from your project root folder:**
- Your project root: `C:\xampp\htdocs\gearbox` (the folder containing `webapp`)
- **NOT** from inside the `webapp` folder
- Open PowerShell/Command Prompt and navigate there first

## Repository Structure

Your repository should look like this:

```
your-repo/
└── webapp/              # Main application folder
    ├── app.py           # Flask backend
    ├── requirements.txt # Python dependencies
    ├── gearbox_metadata.json
    ├── README.md        # Main documentation
    ├── QUICKSTART.md    # Quick start guide
    ├── DEPLOYMENT.md    # Deployment instructions
    ├── .gitignore       # Git ignore rules
    └── static/          # Frontend files
        ├── index.html   # Main HTML (GitHub Pages entry)
        ├── css/
        │   └── style.css
        ├── js/
        │   └── app.js
        └── models/      # 3D models go here
            ├── README.md
            ├── gearbox.glb  # Add your models
            └── kettle.glb
```

## Step-by-Step GitHub Setup

### 1. Create GitHub Repository

1. Go to GitHub.com
2. Click "New repository"
3. Name it (e.g., `gearbox-disassembly-optimizer`)
4. Choose Public or Private
5. **Don't** initialize with README (we already have one)
6. Click "Create repository"

### 2. Initialize Git and Push

**Windows Instructions:**

1. **Open PowerShell or Command Prompt**

2. **Navigate to your gearbox folder** (the folder that contains `webapp`):
   ```bash
   cd C:\xampp\htdocs\gearbox
   ```
   *(If your gearbox folder is in a different location, change the path accordingly)*

3. **Run these commands one by one:**
   ```bash
   # Initialize git (if not already initialized)
   git init

   # Add all files
   git add .

   # Commit
   git commit -m "Initial commit: Gearbox Disassembly Optimizer"

   # Add remote (replace YOUR_USERNAME and YOUR_REPO with your actual GitHub username and repo name)
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

   # Push to GitHub
   git branch -M main
   git push -u origin main
   ```

**Note:** If you're already in the `C:\xampp\htdocs\gearbox` folder, you can skip step 2 and just run the commands from step 3.

**Note:** Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual GitHub username and repository name.

### 3. Enable GitHub Pages (Frontend)

**Option A: Deploy static folder only**

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main`
4. Folder: `/webapp/static` (or `/static` if you move it)
5. Click Save
6. Your site will be at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

**Option B: Move index.html to root** (for cleaner URLs)

```bash
# In your repository root, create a docs/ or docs/static/ folder
# Move static files there, or symlink
# Then set GitHub Pages folder to /docs or /docs/static
```

**Note**: GitHub Pages only serves static files. The Flask backend must be deployed separately.

### 4. Deploy Backend (Choose One Method)

#### Method 1: Heroku (Recommended for Beginners)

1. Create `Procfile` in `webapp/`:
   ```
   web: python app.py
   ```

2. Create `runtime.txt` in `webapp/`:
   ```
   python-3.11.0
   ```

3. Install Heroku CLI and login:
   ```bash
   heroku login
   ```

4. Create Heroku app:
   ```bash
   cd webapp
   heroku create your-app-name
   git subtree push --prefix webapp heroku main
   ```

5. Get your backend URL: `https://your-app-name.herokuapp.com`

#### Method 2: Railway

1. Go to railway.app
2. Connect GitHub repository
3. Set root directory to `webapp`
4. Railway auto-detects Python
5. Deploy automatically
6. Get your backend URL from Railway dashboard

#### Method 3: Render

1. Go to render.com
2. New Web Service
3. Connect GitHub repository
4. Settings:
   - Root Directory: `webapp`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python app.py`
5. Deploy
6. Get your backend URL from Render dashboard

### 5. Connect Frontend to Backend

Once your backend is deployed, update the frontend:

**Option A: Edit in GitHub (Web Interface)**

1. Go to your repository on GitHub
2. Navigate to `webapp/static/index.html`
3. Click Edit (pencil icon)
4. Add before `</head>`:
   ```html
   <script>window.API_BASE_URL = 'https://your-backend-url.herokuapp.com/api';</script>
   ```
5. Commit changes

**Option B: Edit Locally**

1. Edit `webapp/static/index.html` (or `static/index.html` if you're in the webapp folder)
2. Uncomment and update the API_BASE_URL script tag
3. Commit and push (from project root - gearbox folder):
   ```bash
   git add webapp/static/index.html
   git commit -m "Configure backend API URL"
   git push
   ```
   
   **Or if you're in the webapp folder:**
   ```bash
   git add static/index.html
   git commit -m "Configure backend API URL"
   git push
   ```

**Option C: Update JavaScript** (already has environment detection)

The code already detects localhost vs production. For production, you can:
- Set `window.API_BASE_URL` in HTML (Option A/B above), OR
- Edit `webapp/static/js/app.js` line 21-24 to hardcode your backend URL

### 6. Add 3D Models

1. Export your models from Blender as `.glb` files
2. Name them: `gearbox.glb` and `kettle.glb`
3. Place in `webapp/static/models/`
4. Commit and push (from your project root - the gearbox folder):
   ```bash
   # Make sure you're in the gearbox folder (parent of webapp/)
   git add webapp/static/models/*.glb
   git commit -m "Add 3D models"
   git push
   ```
   
   **Note:** If you're in the `webapp` folder, use:
   ```bash
   git add static/models/*.glb
   git commit -m "Add 3D models"
   git push
   ```

**Note**: Large files (>50MB) may need Git LFS:
```bash
git lfs install
git lfs track "*.glb"
git add .gitattributes
git add webapp/static/models/*.glb
git commit -m "Add 3D models with Git LFS"
git push
```

### 7. Verify Everything Works

1. **Frontend**: Visit `https://YOUR_USERNAME.github.io/YOUR_REPO/`
2. **Backend**: Test API endpoint: `https://your-backend-url.com/api/components`
3. **Integration**: 
   - Open browser console (F12)
   - Check for CORS errors
   - Try selecting a component and running an algorithm

## Troubleshooting

**GitHub Pages 404?**
- Check folder path in Settings → Pages
- Verify `index.html` exists in the selected folder
- Wait a few minutes for GitHub to rebuild

**API Not Connecting?**
- Verify backend URL is correct
- Check backend is running (test API endpoint directly)
- Check browser console for CORS errors
- Ensure backend has CORS enabled (already configured in app.py)

**3D Models Not Loading?**
- Check file paths are correct
- Verify files were pushed to GitHub
- Check browser console for 404 errors
- Ensure CORS allows model requests (should be automatic)

**Large Files Won't Push?**
- Use Git LFS for files >50MB
- Or host models on a CDN and update paths

## Continuous Deployment

Once set up:
- Push to `main` branch → GitHub Pages updates automatically
- Backend deployment depends on your platform (Heroku/Railway auto-deploy)

## Repository Settings

Recommended repository settings:
- ✅ Issues: Enabled (for bug reports)
- ✅ Discussions: Optional (for questions)
- ✅ Wiki: Optional
- ✅ Releases: Optional (for version tags)

## License

Add a LICENSE file to your repository (MIT, Apache, etc.)

## README Badge (Optional)

Add badges to your main README:

```markdown
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://YOUR_USERNAME.github.io/YOUR_REPO/)
[![Backend](https://img.shields.io/badge/Backend-Heroku-blue)](https://your-backend-url.herokuapp.com)
```

## Next Steps

- ✅ Repository created and pushed
- ✅ GitHub Pages enabled
- ✅ Backend deployed
- ✅ API URL configured
- ✅ 3D models added
- ✅ Everything tested and working

Congratulations! Your Gearbox Disassembly Optimizer is now live on GitHub! 🎉

