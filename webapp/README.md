# Gearbox Disassembly Optimizer

A web application for finding optimal disassembly sequences using Genetic Algorithm and Dijkstra's Algorithm. This application displays 3D models from Blender, visualizes knowledge graphs, and provides an interactive interface for configuring disassembly parameters.

## Features

- **3D Model Viewer**: Display 3D models from Blender (gearbox and kettle) with interactive controls
- **Knowledge Graph Visualization**: Interactive graph showing component relationships with click-to-select functionality
- **Component Selection**: Select target components directly from the knowledge graph or dropdown menu
- **Parameter Configuration**: Set disassembly parameters via dropdown selections (no typing required):
  - Safety Risk (Low/Medium/High)
  - Fastener Type (Snap ring, Bolts, Snap fit, Spring, Press fit, None)
  - Tool required (Pull, Screwdriver, Bearing splitter, etc.)
  - Number of fasteners (0-10)
- **Algorithm Execution**: Run either Dijkstra's or Genetic Algorithm to find optimal sequences
- **Animation**: Visualize the disassembly sequence step-by-step with 3D model highlighting
- **GitHub-Ready**: All files organized in one folder, ready for GitHub deployment

## Project Structure

```
webapp/
├── app.py                 # Flask backend API
├── requirements.txt       # Python dependencies
├── gearbox_metadata.json  # Component metadata and knowledge graph structure
├── static/
│   ├── index.html        # Main HTML file (GitHub Pages entry point)
│   ├── css/
│   │   └── style.css     # GitHub-inspired stylesheet
│   ├── js/
│   │   └── app.js        # Frontend JavaScript (3D viewer, graph, algorithms)
│   └── models/           # 3D model files (.glb/.gltf from Blender)
│       ├── gearbox.glb   # Add your gearbox model here
│       └── kettle.glb    # Add your kettle model here
└── README.md             # This file
```

## Setup

### Prerequisites

- Python 3.7+ (for backend)
- Node.js (optional, for Neo4j scripts if needed)
- Blender (for exporting 3D models)

### Backend Setup

1. Install Python dependencies:
```bash
cd webapp
pip install -r requirements.txt
```

2. Make sure `gearbox_metadata.json` is in the webapp directory (already present)

3. Run the Flask server:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

The frontend is a static site that works out of the box. However, it needs the backend API to function.

#### Option 1: Local Development (Backend + Frontend)

1. Start the Flask backend (see Backend Setup above)
2. Open `static/index.html` in your browser, OR
3. Access via Flask: `http://localhost:5000` (Flask serves the static files)

#### Option 2: GitHub Pages Deployment

**Note**: GitHub Pages can only host static files. You'll need to deploy the backend separately (see Backend Deployment below).

1. **Prepare for GitHub Pages**:
   - Update the API base URL in `static/js/app.js` (line 19) to point to your deployed backend
   - Or create a configuration file that detects the environment

2. **Deploy to GitHub Pages**:
   ```bash
   # Initialize git repository (if not already)
   git init
   git add .
   git commit -m "Initial commit"
   
   # Create a new repository on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```
   
3. **Enable GitHub Pages**:
   - Go to your repository Settings → Pages
   - Select source branch (usually `main`)
   - Select folder: `/static` (or root if you move index.html to root)
   - Save

4. **Access your site**: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

#### Option 3: Deploy Backend Separately

You can deploy the Flask backend to:
- **Heroku**: Use a `Procfile` with `web: python app.py`
- **Railway**: Connect your GitHub repo and set Python as runtime
- **Render**: Connect repo and use Python environment
- **PythonAnywhere**: Upload files and configure WSGI

**Important**: Enable CORS on your backend (already configured with `flask-cors`).

## Adding 3D Models from Blender

1. **Export from Blender**:
   - Open your model in Blender
   - File → Export → glTF 2.0 (.glb/.gltf)
   - Choose GLB format (single file, recommended)
   - Save to `webapp/static/models/`

2. **Naming Convention**:
   - Gearbox model: `gearbox.glb`
   - Kettle model: `kettle.glb`
   - The names should match the options in the model selector dropdown

3. **Model Requirements**:
   - Use GLB format for single-file deployment
   - Name your parts/components in Blender (for highlighting)
   - Component names should match (or closely match) the names in `gearbox_metadata.json`

4. **Verify**:
   - Models should appear in the dropdown selector
   - Click to load and verify in the 3D viewer
   - Try selecting components to test highlighting

## Usage

1. **Select Target Component**: 
   - Choose from the dropdown, OR
   - Click on nodes in the knowledge graph

2. **Select Components for Disassembly**:
   - Click nodes in the knowledge graph to add them
   - Selected components appear as chips (click × to remove)

3. **Configure Parameters**: 
   - Parameters appear for each edge (component connection)
   - Use dropdowns to select:
     - Safety Risk
     - Fastener Type
     - Tool
     - Number of Fasteners
   - No typing required - all selections are dropdown-based

4. **Choose Algorithm**: 
   - Select Dijkstra's Algorithm (fast, deterministic) OR
   - Genetic Algorithm (optimizable, with parameters)

5. **Run Algorithm**: 
   - Click "Run Algorithm"
   - View optimal disassembly sequence

6. **View Animation**: 
   - Use Play/Pause/Reset controls
   - Watch the sequence highlight in both the results list and 3D model

## API Endpoints

The Flask backend provides these endpoints:

- `GET /api/components` - Get list of all components
- `GET /api/graph` - Get knowledge graph structure (nodes and edges)
- `GET /api/parameters/options` - Get available parameter options (dropdown values)
- `POST /api/dijkstra` - Run Dijkstra's algorithm
  - Body: `{ "target": "Component Name", "edge_weights": {...} }`
- `POST /api/genetic` - Run Genetic Algorithm
  - Body: `{ "target": "Component Name", "edge_weights": {...}, "population_size": 20, "generations": 30, "mutation_rate": 0.2, "crossover_rate": 0.7 }`
- `POST /api/calculate-weights` - Calculate edge weights from parameters
  - Body: `{ "selected_components": [...], "parameters": {...} }`

## Development

### Technologies Used

- **Backend**: Flask (Python) with NetworkX for graph algorithms
- **Frontend**: Vanilla JavaScript
  - Three.js (r128) for 3D visualization
  - vis.js Network for graph visualization
  - GitHub-inspired CSS design
- **Data**: JSON metadata file for component relationships

### Local Development

1. Start backend: `python app.py`
2. Open browser: `http://localhost:5000`
3. Edit files in `static/` and refresh browser
4. Backend changes require server restart

### Customization

- **Styling**: Edit `static/css/style.css` (GitHub-inspired color scheme)
- **3D Models**: Add `.glb` files to `static/models/`
- **Knowledge Graph**: Update `gearbox_metadata.json`
- **Parameters**: Modify mappings in `app.py` (SAFETY_MAP, FASTENER_MAP, TOOL_MAP)

## Notes

- The 3D model viewer automatically loads GLB/GLTF files from the `models/` directory
- The knowledge graph is built from `gearbox_metadata.json` at backend startup
- Edge weights are calculated based on safety risk, fastener complexity, tool requirements, and fastener count
- Component highlighting works if component names in the 3D model match (or closely match) the metadata names
- All parameters use dropdown selections - no manual typing required

## Troubleshooting

**3D Models not loading?**
- Check browser console for errors
- Verify file paths: `static/models/gearbox.glb`
- Ensure GLB format (not just GLTF with separate files)
- Check CORS if loading from different domain

**Backend not connecting?**
- Verify Flask server is running on port 5000
- Check API_BASE URL in `app.js` (should match your backend URL)
- For GitHub Pages, backend must be deployed separately with CORS enabled

**Knowledge Graph not showing?**
- Check browser console
- Verify `gearbox_metadata.json` is valid JSON
- Ensure backend API `/api/graph` endpoint is accessible

**Algorithm not running?**
- Verify at least one component is selected
- Check that target component is valid
- Ensure parameters are configured for relevant edges
- Check browser console for API errors

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
