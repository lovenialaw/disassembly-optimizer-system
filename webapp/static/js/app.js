// Application State
const state = {
    components: [],
    selectedComponents: [],
    targetComponent: null,
    graphData: null,
    parameters: {},
    currentSequence: null,
    animationInterval: null,
    currentStep: 0,
    scene: null,
    camera: null,
    renderer: null,
    model: null,
    parameterOptions: null,
    controls: null,
    modelParts: {},  // Store individual parts of the model for highlighting
    validPaths: [],  // All valid disassembly paths to target
    pathEdges: []    // Unique edges from all valid paths
};

// API Base URL
// For local development: uses 'http://localhost:5000/api'
// For production/GitHub Pages: update to your deployed backend URL
// You can also set window.API_BASE_URL in index.html before scripts load
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : (window.API_BASE_URL || 'https://your-backend-url.herokuapp.com/api');

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    await loadGraphData();
    await loadParameterOptions();
    initializeEventListeners();
    initialize3DViewer();
    initializeKnowledgeGraph();
    setupGraphZoomControls();
    setup3DZoomControls();
});

// Load Components
async function loadComponents() {
    try {
        const response = await fetch(`${API_BASE}/components`);
        state.components = await response.json();
        populateComponentSelect();
    } catch (error) {
        console.error('Error loading components:', error);
        showError('Failed to load components. Make sure the backend server is running.');
    }
}

// Load Graph Data
async function loadGraphData() {
    try {
        const response = await fetch(`${API_BASE}/graph`);
        state.graphData = await response.json();
        renderKnowledgeGraph();
        renderParameters(); // Render parameters for all graph edges initially
    } catch (error) {
        console.error('Error loading graph:', error);
    }
}

// Switch Model
async function switchModel(modelName) {
    try {
        const response = await fetch(`${API_BASE}/model/${modelName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            const errorMsg = result.error || 'Failed to switch model';
            throw new Error(errorMsg);
        }

        // Reload components and graph data
        await loadComponents();
        await loadGraphData();

        // Clear selected components and parameters
        state.selectedComponents = [];
        state.targetComponent = null;
        state.parameters = {};
        state.currentSequence = null;
        state.validPaths = [];
        state.pathEdges = [];
        renderSelectedComponents();

        // Refresh knowledge graph
        renderKnowledgeGraph();

        console.log(`Switched to model: ${modelName}`);
    } catch (error) {
        console.error('Error switching model:', error);
        showError(error.message || 'Failed to switch model. Please try again.');
    }
}

// Load Parameter Options
async function loadParameterOptions() {
    try {
        const response = await fetch(`${API_BASE}/parameters/options`);
        state.parameterOptions = await response.json();
    } catch (error) {
        console.error('Error loading parameter options:', error);
    }
}

// Populate Component Select
function populateComponentSelect() {
    const select = document.getElementById('target-component');
    select.innerHTML = '<option value="">Select target component...</option>';
    state.components.forEach(comp => {
        const option = document.createElement('option');
        option.value = comp;
        option.textContent = comp;
        select.appendChild(option);
    });
}

// Load Valid Paths
async function loadValidPaths(target) {
    try {
        const response = await fetch(`${API_BASE}/paths/${target}`);
        if (!response.ok) {
            throw new Error('Failed to load paths');
        }
        const data = await response.json();
        state.validPaths = data.paths;
        state.pathEdges = extractUniqueEdgesFromPaths(data.paths);
        // Refresh knowledge graph to show only valid paths
        renderKnowledgeGraph();
        return data;
    } catch (error) {
        console.error('Error loading paths:', error);
        throw error;
    }
}

// Extract unique edges from all valid paths
function extractUniqueEdgesFromPaths(paths) {
    const edgeSet = new Set();
    paths.forEach(path => {
        for (let i = 0; i < path.length - 1; i++) {
            const edgeKey = `${path[i]}->${path[i + 1]}`;
            edgeSet.add(edgeKey);
        }
    });
    return Array.from(edgeSet).map(edgeKey => {
        const [from, to] = edgeKey.split('->');
        return { from, to, key: edgeKey };
    });
}

// Initialize Event Listeners
function initializeEventListeners() {
    // Target component selection
    document.getElementById('target-component').addEventListener('change', async (e) => {
        state.targetComponent = e.target.value;
        if (state.targetComponent) {
            try {
                await loadValidPaths(state.targetComponent);
                renderParameters();
            } catch (error) {
                showError('Failed to load valid paths. Please try again.');
            }
        } else {
            state.validPaths = [];
            state.pathEdges = [];
            state.currentSequence = null;
            renderParameters();
            renderKnowledgeGraph(); // Show full graph when no target selected
        }
    });

    // Algorithm selection
    document.querySelectorAll('input[name="algorithm"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const geneticParams = document.getElementById('genetic-params');
            geneticParams.style.display = e.target.value === 'genetic' ? 'block' : 'none';
        });
    });

    // Run algorithm button
    document.getElementById('run-algorithm').addEventListener('click', runAlgorithm);

    // Animation controls
    document.getElementById('play-animation').addEventListener('click', playAnimation);
    document.getElementById('pause-animation').addEventListener('click', pauseAnimation);
    document.getElementById('reset-animation').addEventListener('click', resetAnimation);
}

// Add Component to Selection
function addComponentToSelection(component) {
    if (!state.selectedComponents.includes(component)) {
        state.selectedComponents.push(component);
        renderSelectedComponents();
        renderParameters();
    }
}

// Remove Component from Selection
function removeComponentFromSelection(component) {
    state.selectedComponents = state.selectedComponents.filter(c => c !== component);
    renderSelectedComponents();
    renderParameters();
}

// Render Selected Components
function renderSelectedComponents() {
    const container = document.getElementById('selected-components-list');
    container.innerHTML = '';

    state.selectedComponents.forEach(comp => {
        const chip = document.createElement('span');
        chip.className = 'component-chip';
        chip.innerHTML = `
            ${comp}
            <span class="remove" onclick="removeComponentFromSelection('${comp}')">×</span>
        `;
        container.appendChild(chip);
    });
}

// Render Parameters
function renderParameters() {
    const container = document.getElementById('parameters-container');
    container.innerHTML = '';

    // Show parameters only for edges in valid paths (if target is selected)
    let edgesToShow = [];

    if (state.targetComponent && state.pathEdges && state.pathEdges.length > 0) {
        // Show edges from valid paths
        edgesToShow = state.pathEdges;
        container.innerHTML = `<p class="info-text">Found ${state.validPaths.length} valid path(s). Configure parameters for disassembly steps:</p>`;
    } else if (!state.targetComponent) {
        container.innerHTML = '<p class="info-text">Select a target component to disassemble first</p>';
        return;
    } else {
        // Fallback: show all graph edges if paths not loaded yet
        if (!state.graphData || !state.graphData.edges || state.graphData.edges.length === 0) {
            container.innerHTML = '<p class="info-text">Loading valid paths...</p>';
            return;
        }
        edgesToShow = state.graphData.edges.map(e => ({ from: e.from, to: e.to, key: `${e.from}->${e.to}` }));
    }

    if (edgesToShow.length === 0) {
        container.innerHTML = '<p class="info-text">No edges to configure. Select a target component first.</p>';
        return;
    }

    // Create table structure for easier comparison
    const table = document.createElement('div');
    table.className = 'parameters-table-wrapper';
    table.innerHTML = `
        <table class="parameters-table">
            <thead>
                <tr>
                    <th class="step-header">Disassembly Step</th>
                    <th>Safety Risk</th>
                    <th>Fastener Type</th>
                    <th>Tool</th>
                    <th># Fasteners</th>
                </tr>
            </thead>
            <tbody>
                ${edgesToShow.map(edge => {
        const from = edge.from;
        const to = edge.to;
        const edgeKey = edge.key || `${from}->${to}`;

        // Initialize parameters if not exists
        if (!state.parameters[edgeKey]) {
            state.parameters[edgeKey] = {
                safety: 'Medium',
                fastener: 'None',
                tool: 'Pull',
                count: 0
            };
        }

        return `
                        <tr>
                            <td class="step-name">
                                <strong>${from}</strong> <span class="arrow">→</span> <strong>${to}</strong>
                            </td>
                            <td>
                    <select class="select-input param-input" data-edge="${edgeKey}" data-param="safety">
                        ${state.parameterOptions.safety.map(opt =>
            `<option value="${opt}" ${state.parameters[edgeKey].safety === opt ? 'selected' : ''}>${opt}</option>`
        ).join('')}
                    </select>
                            </td>
                            <td>
                    <select class="select-input param-input" data-edge="${edgeKey}" data-param="fastener">
                        ${state.parameterOptions.fasteners.map(opt =>
            `<option value="${opt}" ${state.parameters[edgeKey].fastener === opt ? 'selected' : ''}>${opt}</option>`
        ).join('')}
                    </select>
                            </td>
                            <td>
                    <select class="select-input param-input" data-edge="${edgeKey}" data-param="tool">
                        ${state.parameterOptions.tools.map(opt =>
            `<option value="${opt}" ${state.parameters[edgeKey].tool === opt ? 'selected' : ''}>${opt}</option>`
        ).join('')}
                    </select>
                            </td>
                            <td>
                    <select class="select-input param-input" data-edge="${edgeKey}" data-param="count">
                        ${state.parameterOptions.fastener_counts.map(count =>
            `<option value="${count}" ${state.parameters[edgeKey].count == count ? 'selected' : ''}>${count}</option>`
        ).join('')}
                    </select>
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
        `;
    container.appendChild(table);

    // Add event listeners for parameter changes
    document.querySelectorAll('.param-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const edgeKey = e.target.dataset.edge;
            const param = e.target.dataset.param;
            state.parameters[edgeKey][param] = e.target.value;
        });
    });
}

// Calculate Edge Weights
async function calculateEdgeWeights() {
    try {
        const response = await fetch(`${API_BASE}/calculate-weights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selected_components: state.selectedComponents,
                parameters: state.parameters
            })
        });
        const weights = await response.json();

        // Convert object keys from string to tuple format
        const edgeWeights = {};
        for (const [key, value] of Object.entries(weights)) {
            const [u, v] = key.slice(1, -1).split(', ').map(s => s.replace(/['"]/g, ''));
            edgeWeights[[u, v]] = value;
        }
        return edgeWeights;
    } catch (error) {
        console.error('Error calculating weights:', error);
        throw error;
    }
}

// Run Algorithm
async function runAlgorithm() {
    if (!state.targetComponent) {
        showError('Please select a target component to disassemble');
        return;
    }

    const algorithm = document.querySelector('input[name="algorithm"]:checked').value;
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '<p class="info-text">Running algorithm...</p>';

    try {
        // Build edge weights from topology graph, not just selected components
        // We need to get all valid edges from the knowledge graph
        const edgeWeights = {};
        const graph = state.graphData;

        // First, build weights for all edges in the graph based on user parameters
        // If user hasn't set parameters for an edge, use defaults
        if (graph && graph.edges) {
            graph.edges.forEach(edge => {
                const from = edge.from;
                const to = edge.to;
                const edgeKey = `${from}->${to}`;

                // Check if user has set parameters for this edge
                const param = state.parameters[edgeKey] || {
                    safety: 'Medium',
                    fastener: 'None',
                    tool: 'Pull',
                    count: 0
                };

                const safetyMap = { "Low": 1, "Medium": 2, "High": 3 };
                const fastenerMap = { "Snap ring": 1, "Bolts": 2, "Snap fit": 1.5, "Spring": 1.5, "Press fit": 3, "None": 1 };
                const toolMap = { "Pull": 1, "Flat screwdriver 1 & flat screwdriver 2 & hammer": 1.5, "Bearing splitter": 2, "Cordless drill rivet gun": 2.5, "Puller": 1.5, "Bearing splitter & hydraulic press": 3, "Heel bar": 1.5, "Gear puller": 2, "Push": 1 };

                function fastenerCountPenalty(count) {
                    count = parseInt(count);
                    if (count == 0) return 1;
                    if (count <= 2) return 1.5;
                    if (count <= 4) return 2;
                    return 3;
                }

                const weight = safetyMap[param.safety] + fastenerMap[param.fastener] + toolMap[param.tool] + fastenerCountPenalty(param.count);
                edgeWeights[edgeKey] = weight;
            });
        }

        // Prepare request payload
        const payload = {
            target: state.targetComponent,
            edge_weights: edgeWeights
        };

        if (algorithm === 'genetic') {
            // Population size is calculated automatically by the backend (factorial)
            payload.generations = parseInt(document.getElementById('generations').value);
            payload.mutation_rate = parseFloat(document.getElementById('mutation-rate').value);
            payload.crossover_rate = parseFloat(document.getElementById('crossover-rate').value);
        }

        const endpoint = algorithm === 'genetic' ? 'genetic' : 'dijkstra';
        const response = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Algorithm failed');
        }

        const result = await response.json();
        state.currentSequence = result.path;
        displayResults(result);
        showAnimationControls();
        // Refresh knowledge graph to highlight optimal path
        renderKnowledgeGraph();

    } catch (error) {
        console.error('Error running algorithm:', error);
        showError(error.message || 'Failed to run algorithm');
    }
}

// Display Results
function displayResults(result) {
    const container = document.getElementById('results-container');
    container.innerHTML = `
        <div class="result-path">
            <h3>Optimal Disassembly Sequence</h3>
            <div class="result-stats">
                <span>Algorithm: ${result.algorithm}</span>
                <span>Total Cost: ${result.cost.toFixed(2)}</span>
                ${result.fitness ? `<span>Fitness: ${result.fitness.toFixed(4)}</span>` : ''}
            </div>
            <div class="path-steps" id="path-steps">
                ${result.path.map((step, index) =>
        `<div class="path-step" data-step="${index}">${index + 1}. ${step}</div>`
    ).join('')}
            </div>
        </div>
    `;
}

// Show Animation Controls
function showAnimationControls() {
    const controls = document.getElementById('animation-controls');
    controls.style.display = 'block';
    document.getElementById('animation-total').textContent = state.currentSequence ? state.currentSequence.length : 0;
}

// Play Animation
function playAnimation() {
    if (!state.currentSequence) return;

    pauseAnimation(); // Clear any existing animation

    state.currentStep = 0;
    updateAnimationStep(0);

    state.animationInterval = setInterval(() => {
        state.currentStep++;
        if (state.currentStep >= state.currentSequence.length) {
            pauseAnimation();
            return;
        }
        updateAnimationStep(state.currentStep);
    }, 1000);
}

// Pause Animation
function pauseAnimation() {
    if (state.animationInterval) {
        clearInterval(state.animationInterval);
        state.animationInterval = null;
    }
}

// Reset Animation
function resetAnimation() {
    pauseAnimation();
    state.currentStep = 0;
    updateAnimationStep(0);
}

// Update Animation Step
function updateAnimationStep(step) {
    document.getElementById('animation-step').textContent = step;

    // Update visual steps
    document.querySelectorAll('.path-step').forEach((el, index) => {
        el.classList.remove('active', 'completed');
        if (index === step) {
            el.classList.add('active');
        } else if (index < step) {
            el.classList.add('completed');
        }
    });

    // Update 3D model highlighting (if model is loaded)
    if (state.model && state.currentSequence[step]) {
        highlightComponent(state.currentSequence[step]);
    }
}

// Initialize 3D Viewer
function initialize3DViewer() {
    const container = document.getElementById('model-viewer');
    if (!container) return;

    // Scene setup
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x1a1a1a);

    // Camera setup
    state.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    state.camera.position.set(0, 0, 5);

    // Renderer setup
    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(container.clientWidth, container.clientHeight);
    state.renderer.shadowMap.enabled = true;
    container.appendChild(state.renderer.domElement);

    // OrbitControls for camera interaction
    if (typeof THREE.OrbitControls !== 'undefined') {
        state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);
        state.controls.enableDamping = true;
        state.controls.dampingFactor = 0.05;
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    state.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    state.scene.add(directionalLight);

    // Additional lights for better visibility
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, -5, -5);
    state.scene.add(directionalLight2);

    // Load model selector (both selectors - top and in 3D viewer)
    const modelSelectorTop = document.getElementById('model-selector-top');
    const modelSelector3D = document.getElementById('model-selector');

    const handleModelChange = async (modelName) => {
        if (modelName) {
            try {
                await switchModel(modelName);
                // Load the 3D model automatically
                loadModel(modelName);
                // Sync both selectors
                if (modelSelectorTop) modelSelectorTop.value = modelName;
                if (modelSelector3D) modelSelector3D.value = modelName;
            } catch (error) {
                console.error('Error switching model:', error);
            }
        }
    };

    if (modelSelectorTop) {
        modelSelectorTop.addEventListener('change', async (e) => {
            await handleModelChange(e.target.value);
        });
    }

    if (modelSelector3D) {
        modelSelector3D.addEventListener('change', async (e) => {
            await handleModelChange(e.target.value);
        });
    }

    // Placeholder geometry (until models are loaded)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const placeholder = new THREE.Mesh(geometry, material);
    state.scene.add(placeholder);
    state.model = placeholder; // Store as current model

    // Render loop
    function animate() {
        requestAnimationFrame(animate);
        if (state.controls) {
            state.controls.update();
        }
        state.renderer.render(state.scene, state.camera);
    }
    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        state.camera.aspect = container.clientWidth / container.clientHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// Load 3D Model
function loadModel(modelName) {
    if (!modelName) return;

    console.log(`Loading model: ${modelName}`);

    // Clear existing model and parts
    if (state.model) {
        state.scene.remove(state.model);
        state.model = null;
    }
    state.modelParts = {};

    // Check if GLTFLoader is available
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.warn('GLTFLoader not available, using placeholder');
        // Create placeholder geometry
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0x4a90e2 });
        state.model = new THREE.Mesh(geometry, material);
        state.scene.add(state.model);
        return;
    }

    // Try to load GLTF/GLB model from Blender
    const loader = new THREE.GLTFLoader();
    const modelPath = `models/${modelName}.glb`;  // Try .glb first

    loader.load(
        modelPath,
        (gltf) => {
            console.log('Model loaded successfully:', gltf);

            // Clear placeholder if exists
            if (state.model && state.model !== gltf.scene) {
                state.scene.remove(state.model);
            }

            state.model = gltf.scene;

            // Calculate bounding box and center the model
            const box = new THREE.Box3().setFromObject(state.model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Center the model
            state.model.position.x = -center.x;
            state.model.position.y = -center.y;
            state.model.position.z = -center.z;

            // Scale to fit view (optional)
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            state.model.scale.multiplyScalar(scale);

            state.scene.add(state.model);

            // Store individual parts for highlighting (if named in Blender)
            state.model.traverse((child) => {
                if (child.isMesh) {
                    const partName = child.name || child.parent?.name;
                    if (partName) {
                        state.modelParts[partName] = child;
                    }
                }
            });

            console.log('Model parts found:', Object.keys(state.modelParts));
        },
        (progress) => {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
            console.error('Error loading model:', error);
            console.log('Falling back to placeholder');

            // Fallback to placeholder
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshStandardMaterial({
                color: 0x4a90e2,
                wireframe: false
            });
            state.model = new THREE.Mesh(geometry, material);
            state.scene.add(state.model);
        }
    );
}

// Highlight Component in 3D
function highlightComponent(componentName) {
    if (!state.model || !state.modelParts) return;

    // Reset all highlights first
    Object.values(state.modelParts).forEach(part => {
        if (part.material) {
            if (Array.isArray(part.material)) {
                part.material.forEach(mat => {
                    if (mat.emissive) mat.emissive.setHex(0x000000);
                    if (mat.color) mat.color.setHex(mat.userData.originalColor || 0xffffff);
                });
            } else {
                if (part.material.emissive) part.material.emissive.setHex(0x000000);
                if (part.material.color) part.material.color.setHex(part.material.userData.originalColor || 0xffffff);
            }
        }
    });

    // Try to find the component in model parts (case-insensitive search)
    const normalizedName = componentName.toLowerCase().replace(/\s+/g, '_');
    let foundPart = null;

    // Direct match
    if (state.modelParts[componentName]) {
        foundPart = state.modelParts[componentName];
    } else {
        // Try to find by partial name match
        Object.keys(state.modelParts).forEach(key => {
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
            if (normalizedKey.includes(normalizedName) || normalizedName.includes(normalizedKey)) {
                foundPart = state.modelParts[key];
            }
        });
    }

    if (foundPart) {
        // Store original color if not stored
        if (foundPart.material) {
            if (Array.isArray(foundPart.material)) {
                foundPart.material.forEach(mat => {
                    if (!mat.userData.originalColor && mat.color) {
                        mat.userData.originalColor = mat.color.getHex();
                    }
                    if (mat.emissive) mat.emissive.setHex(0xff6600); // Orange glow
                    if (mat.color) mat.color.setHex(0xffaa00); // Orange highlight
                });
            } else {
                if (!foundPart.material.userData.originalColor && foundPart.material.color) {
                    foundPart.material.userData.originalColor = foundPart.material.color.getHex();
                }
                if (foundPart.material.emissive) foundPart.material.emissive.setHex(0xff6600);
                if (foundPart.material.color) foundPart.material.color.setHex(0xffaa00);
            }
        }
        console.log(`Highlighted component: ${componentName}`);
    } else {
        console.log(`Component not found in model: ${componentName}`);
    }
}

// Initialize Knowledge Graph
function initializeKnowledgeGraph() {
    renderKnowledgeGraph();
}

// Render Knowledge Graph
function renderKnowledgeGraph() {
    const container = document.getElementById('knowledge-graph');
    if (!container) return;

    // If target is selected and we have valid paths, show only those paths
    let nodesToShow = [];
    let edgesToShow = [];
    let optimalPath = state.currentSequence || null;

    // Debug logging
    console.log('renderKnowledgeGraph - targetComponent:', state.targetComponent);
    console.log('renderKnowledgeGraph - validPaths:', state.validPaths?.length || 0);

    if (state.targetComponent && state.validPaths && state.validPaths.length > 0) {
        console.log('Showing only valid paths for target:', state.targetComponent);
        // Extract unique nodes and edges from all valid paths
        const nodeSet = new Set();
        const edgeSet = new Set();

        state.validPaths.forEach(path => {
            path.forEach(node => nodeSet.add(node));
            for (let i = 0; i < path.length - 1; i++) {
                edgeSet.add(`${path[i]}->${path[i + 1]}`);
            }
        });

        // Create nodes array
        nodesToShow = Array.from(nodeSet).map(nodeId => ({
            id: nodeId,
            label: nodeId,
            color: {
                background: '#ffffff',
                border: '#0969da',
                highlight: { background: '#ddf4ff', border: '#0969da' }
            }
        }));

        // Create edges array from valid paths
        edgesToShow = Array.from(edgeSet).map(edgeKey => {
            const [from, to] = edgeKey.split('->');
            return {
                from: from,
                to: to,
                id: edgeKey,
                arrows: 'to',
                color: { color: '#656d76' },
                width: 2
            };
        });
    } else if (!state.targetComponent && state.graphData) {
        // Show full graph only if no target selected
        console.log('Showing full graph (no target selected)');
        nodesToShow = state.graphData.nodes.map(node => ({
            ...node,
            color: { background: '#ffffff', border: '#0969da', highlight: { background: '#ddf4ff', border: '#0969da' } }
        }));
        edgesToShow = state.graphData.edges.map(edge => ({
            ...edge,
            arrows: 'to',
            color: { color: '#656d76' },
            width: 2
        }));
    } else {
        // No graph data available or waiting for paths to load
        if (state.targetComponent) {
            container.innerHTML = '<p class="info-text">Loading valid paths...</p>';
        } else {
            container.innerHTML = '<p class="info-text">No graph data available</p>';
        }
        return;
    }

    // Highlight optimal path edges if available
    if (optimalPath && optimalPath.length > 1) {
        const optimalEdges = new Set();
        for (let i = 0; i < optimalPath.length - 1; i++) {
            optimalEdges.add(`${optimalPath[i]}->${optimalPath[i + 1]}`);
        }

        edgesToShow = edgesToShow.map(edge => {
            const edgeKey = edge.id || `${edge.from}->${edge.to}`;
            if (optimalEdges.has(edgeKey)) {
                return {
                    ...edge,
                    color: { color: '#28a745' }, // Green for optimal path
                    width: 4, // Thicker line
                    dashes: false
                };
            }
            return edge;
        });

        // Highlight optimal path nodes
        const optimalNodes = new Set(optimalPath);
        nodesToShow = nodesToShow.map(node => {
            if (optimalNodes.has(node.id)) {
                return {
                    ...node,
                    color: {
                        background: '#d4edda', // Light green
                        border: '#28a745', // Green border
                        highlight: { background: '#c3e6cb', border: '#28a745' }
                    },
                    font: { ...node.font, bold: true }
                };
            }
            return node;
        });
    }

    // Destroy existing network if it exists
    if (state.network) {
        state.network.destroy();
        state.network = null;
    }

    // Clear container
    container.innerHTML = '';

    const nodes = new vis.DataSet(nodesToShow);
    const edges = new vis.DataSet(edgesToShow);

    const data = { nodes, edges };
    const options = {
        nodes: {
            shape: 'box',
            font: { size: 12, face: 'Arial' },
            margin: 10
        },
        edges: {
            width: 2,
            smooth: { type: 'curvedCW', roundness: 0.3 }
        },
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'directed'
            }
        },
        physics: {
            enabled: false
        },
        interaction: {
            dragNodes: true,
            zoomView: true,
            dragView: true
        }
    };

    const network = new vis.Network(container, data, options);

    // Store network reference for future use
    state.network = network;
}

// Zoom Controls for Knowledge Graph
function setupGraphZoomControls() {
    document.getElementById('zoom-in-graph')?.addEventListener('click', () => {
        if (state.network) {
            const scale = state.network.getScale();
            state.network.moveTo({ scale: scale * 1.2, animation: true });
        }
    });

    document.getElementById('zoom-out-graph')?.addEventListener('click', () => {
        if (state.network) {
            const scale = state.network.getScale();
            state.network.moveTo({ scale: scale * 0.8, animation: true });
        }
    });

    document.getElementById('reset-graph')?.addEventListener('click', () => {
        if (state.network) {
            state.network.fit({ animation: true });
        }
    });
}

// Zoom Controls for 3D Viewer
function setup3DZoomControls() {
    document.getElementById('zoom-in-3d')?.addEventListener('click', () => {
        if (state.camera) {
            state.camera.position.multiplyScalar(0.9);
            state.camera.updateProjectionMatrix();
        }
    });

    document.getElementById('zoom-out-3d')?.addEventListener('click', () => {
        if (state.camera) {
            state.camera.position.multiplyScalar(1.1);
            state.camera.updateProjectionMatrix();
        }
    });

    document.getElementById('reset-3d')?.addEventListener('click', () => {
        if (state.camera && state.model) {
            // Calculate bounding box and center
            const box = new THREE.Box3().setFromObject(state.model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 2;

            // Reset camera position
            state.camera.position.set(center.x, center.y, center.z + distance);
            state.camera.lookAt(center);
            state.camera.updateProjectionMatrix();

            // Reset controls target if OrbitControls exists
            if (state.controls) {
                state.controls.target.copy(center);
                state.controls.update();
            }
        }
    });
}

// Show Error
function showError(message) {
    const container = document.getElementById('results-container');
    container.innerHTML = `<p class="info-text" style="color: var(--error-color);">${message}</p>`;
}

// Make functions available globally for inline event handlers
window.removeComponentFromSelection = removeComponentFromSelection;

