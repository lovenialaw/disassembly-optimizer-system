# Quick Start Guide

Get the Gearbox Disassembly Optimizer up and running in 5 minutes!

## Prerequisites Check

- [ ] Python 3.7+ installed
- [ ] pip (Python package installer) available
- [ ] Web browser (Chrome, Firefox, or Edge)

## Step 1: Install Backend Dependencies

Open a terminal in the `webapp` directory and run:

```bash
pip install -r requirements.txt
```

This installs:
- Flask (web framework)
- NetworkX (graph algorithms)
- flask-cors (CORS support)
- pandas (data handling)

## Step 2: Start the Backend Server

```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

**Keep this terminal window open** - the server needs to keep running.

## Step 3: Open the Application

Open your web browser and go to:
```
http://localhost:5000
```

## Step 4: Test the Application

1. **View the Knowledge Graph**: You should see an interactive graph showing component relationships

2. **Select a Model**: 
   - Use the dropdown to select "Gearbox" or "Kettle"
   - Note: If models aren't loaded yet, you'll see a placeholder (this is normal)

3. **Select a Component**:
   - Click a node in the knowledge graph, OR
   - Choose from the "Target Component" dropdown

4. **Configure Parameters**:
   - Parameters appear automatically for component connections
   - Use the dropdowns to select:
     - Safety Risk
     - Fastener Type  
     - Tool
     - Number of Fasteners

5. **Run Algorithm**:
   - Choose Dijkstra's or Genetic Algorithm
   - Click "Run Algorithm"
   - View the optimal disassembly sequence

6. **Watch Animation**:
   - Use Play/Pause/Reset to see the sequence animated
   - Components highlight in the 3D viewer (if models are loaded)

## Adding Your 3D Models

1. **Export from Blender**:
   - Open your model in Blender
   - File → Export → glTF 2.0 (.glb/.gltf)
   - Choose **GLB** format (recommended - single file)
   - Save to: `webapp/static/models/gearbox.glb` (or `kettle.glb`)

2. **Refresh Browser**:
   - Reload the page
   - Select your model from the dropdown
   - It should load automatically

3. **Component Naming** (for highlighting):
   - In Blender, name your parts/components
   - Names should match (or closely match) component names in `gearbox_metadata.json`
   - This enables component highlighting during animation

## Troubleshooting

**"Failed to load components" error?**
- Make sure the backend server is running (`python app.py`)
- Check that you're accessing `http://localhost:5000`
- Check the terminal for error messages

**3D models not loading?**
- Check browser console (F12 → Console tab)
- Verify file exists: `webapp/static/models/gearbox.glb`
- Make sure you exported as GLB format (not GLTF with separate files)

**Algorithm not working?**
- Select at least one component first
- Make sure you've selected a target component
- Check browser console for errors

**Port 5000 already in use?**
- Change port in `app.py`: `app.run(debug=True, port=5001)`
- Update API URL in `app.js` if needed

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deploying to GitHub Pages or cloud platforms
- Customize the styling in `static/css/style.css`
- Add more components to `gearbox_metadata.json`

## Need Help?

- Check browser console (F12) for errors
- Check backend terminal for Python errors
- Verify all files are in the correct directories
- Make sure Python version is 3.7+

Happy disassembling! 🔧

