from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import networkx as nx
import json
import math
import copy
from pathlib import Path

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Load metadata
with open('gearbox_metadata.json', 'r') as f:
    metadata = json.load(f)

# Mappings
SAFETY_MAP = {"Low": 1, "Medium": 2, "High": 3}

FASTENER_MAP = {
    "Snap ring": 1,
    "Bolts": 2,
    "Snap fit": 1.5,
    "Spring": 1.5,
    "Press fit": 3,
    "None": 1
}

TOOL_MAP = {
    "Pull": 1,
    "Flat screwdriver 1 & flat screwdriver 2 & hammer": 1.5,
    "Bearing splitter": 2,
    "Cordless drill rivet gun": 2.5,
    "Puller": 1.5,
    "Bearing splitter & hydraulic press": 3,
    "Heel bar": 1.5,
    "Gear puller": 2,
    "Push": 1
}

def fastener_count_penalty(count):
    if count == 0:
        return 1
    elif count <= 2:
        return 1.5
    elif count <= 4:
        return 2
    else:
        return 3

def build_graph_from_metadata():
    """Build topology graph from metadata JSON"""
    G = nx.DiGraph()
    
    for item in metadata:
        component = item['name']
        G.add_node(component)
        
        # Add blocked_by relationships
        if 'blocked_by' in item.get('properties', {}):
            for blocker in item['properties']['blocked_by']:
                G.add_edge(blocker, component)  # blocker must be removed before component
        
        # Add attached_to relationships (also creates blocked_by)
        if 'attached_to' in item.get('properties', {}):
            attached_to = item['properties']['attached_to']
            if attached_to and attached_to != component:
                G.add_edge(attached_to, component)
    
    return G

# Build graph once at startup
G_topology = build_graph_from_metadata()

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/components', methods=['GET'])
def get_components():
    """Get list of all components"""
    components = sorted(list(G_topology.nodes))
    return jsonify(components)

@app.route('/api/graph', methods=['GET'])
def get_graph():
    """Get knowledge graph structure"""
    nodes = [{'id': node, 'label': node} for node in G_topology.nodes]
    edges = [{'from': u, 'to': v} for u, v in G_topology.edges]
    return jsonify({'nodes': nodes, 'edges': edges})

@app.route('/api/parameters/options', methods=['GET'])
def get_parameter_options():
    """Get available options for parameters"""
    return jsonify({
        'safety': list(SAFETY_MAP.keys()),
        'fasteners': list(FASTENER_MAP.keys()),
        'tools': list(TOOL_MAP.keys()),
        'fastener_counts': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    })

def path_cost(path, G):
    """Calculate total cost of a disassembly path"""
    cost = 0
    for i in range(len(path) - 1):
        if not G.has_edge(path[i], path[i+1]):
            return float("inf")
        cost += G[path[i]][path[i+1]]["weight"]
    return cost

def is_valid_path(path, G_topology):
    """Check if path is valid"""
    for i in range(len(path) - 1):
        if not G_topology.has_edge(path[i], path[i+1]):
            return False
    return True

def fitness(path, G):
    """Fitness function (higher is better)"""
    cost = path_cost(path, G)
    if cost == float("inf"):
        return 0.0
    return 1 / (1 + cost)

def constraint_penalty(path, G, G_topology):
    """Apply penalties for violating constraints"""
    penalty = 0
    
    if not is_valid_path(path, G_topology):
        penalty += 1000
    
    if len(path) > 20:
        penalty += (len(path) - 20) * 5
    
    high_risk_count = 0
    for i in range(len(path) - 1):
        if G.has_edge(path[i], path[i+1]):
            weight = G[path[i]][path[i+1]]["weight"]
            if weight > 8:
                high_risk_count += 1
    penalty += high_risk_count * 3
    
    return penalty

def penalized_fitness(path, G, G_topology):
    """Fitness with constraint penalties"""
    base_fitness = fitness(path, G)
    penalty = constraint_penalty(path, G, G_topology)
    
    if penalty > 0:
        return base_fitness / (1 + penalty * 0.1)
    return base_fitness

def crossover(parent1, parent2, G_topology, crossover_index=0):
    """Crossover operation"""
    common_nodes = set(parent1) & set(parent2)
    
    if len(common_nodes) < 2:
        return None
    
    common_list = [n for n in common_nodes if n != parent1[0] and n != parent1[-1]]
    if not common_list:
        return None
    
    crossover_point = common_list[crossover_index % len(common_list)]
    
    idx1 = parent1.index(crossover_point)
    idx2 = parent2.index(crossover_point)
    
    child = parent1[:idx1+1] + parent2[idx2+1:]
    
    if is_valid_path(child, G_topology):
        return child
    
    child = parent2[:idx2+1] + parent1[idx1+1:]
    if is_valid_path(child, G_topology):
        return child
    
    return None

def mutate_path(path, all_paths, mutation_rate, G_topology, mutation_counter):
    """Mutation operation"""
    if mutation_rate == 0 or mutation_rate <= 0:
        return path
    
    mutation_interval = max(1, int(1 / mutation_rate))
    if mutation_counter % mutation_interval != 0:
        return path
    
    path_index = mutation_counter % len(all_paths)
    return all_paths[path_index]

def select_population(population, G, G_topology, retain, elite_size=0):
    """Selection with elitism"""
    scored = [(p, penalized_fitness(p, G, G_topology)) for p in population]
    scored.sort(key=lambda x: x[1], reverse=True)
    
    elite = [p for p, _ in scored[:elite_size]] if elite_size > 0 else []
    retain_length = max(elite_size, int(len(population) * retain))
    selected = [p for p, _ in scored[:retain_length]]
    
    return selected, elite

@app.route('/api/dijkstra', methods=['POST'])
def run_dijkstra():
    """Run Dijkstra algorithm"""
    data = request.json
    target = data.get('target')
    edge_weights_data = data.get('edge_weights', {})
    
    if target not in G_topology.nodes:
        return jsonify({'error': f'Target {target} not found'}), 400
    
    # Build weighted graph
    G = nx.DiGraph()
    G.add_nodes_from(G_topology.nodes)
    
    # Handle edge weights (can be tuple keys as strings or list keys)
    for key, w in edge_weights_data.items():
        if isinstance(key, list) or isinstance(key, tuple):
            u, v = key
        elif isinstance(key, str) and '->' in key:
            u, v = key.split('->', 1)
        else:
            continue
        G.add_edge(u, v, weight=w)
    
    # Add default weights for edges in topology that don't have weights
    for u, v in G_topology.edges():
        if not G.has_edge(u, v):
            G.add_edge(u, v, weight=5.0)  # Default weight
    
    # Find start nodes
    start_nodes = [n for n in G_topology.nodes if G_topology.in_degree(n) == 0]
    if not start_nodes:
        start_nodes = list(G_topology.nodes)
    
    # Run Dijkstra from all start nodes to target
    best_path = None
    best_cost = float("inf")
    
    for start in start_nodes:
        if start not in G:
            continue
        try:
            # Check if there's a path from start to target
            if nx.has_path(G, start, target):
                path = nx.dijkstra_path(G, start, target, weight="weight")
                cost = nx.dijkstra_path_length(G, start, target, weight="weight")
                if cost < best_cost:
                    best_cost = cost
                    best_path = path
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            pass
    
    if not best_path:
        return jsonify({'error': 'No valid path found. Please check your component selection and parameters.'}), 400
    
    return jsonify({
        'path': best_path,
        'cost': best_cost,
        'algorithm': 'dijkstra'
    })

@app.route('/api/genetic', methods=['POST'])
def run_genetic():
    """Run Genetic Algorithm"""
    data = request.json
    target = data.get('target')
    edge_weights_data = data.get('edge_weights', {})
    population_size = data.get('population_size', 20)
    retain = data.get('retain', 0.5)
    mutation_rate = data.get('mutation_rate', 0.2)
    generations = data.get('generations', 30)
    crossover_rate = data.get('crossover_rate', 0.7)
    
    if target not in G_topology.nodes:
        return jsonify({'error': f'Target {target} not found'}), 400
    
    # Build weighted graph
    G = nx.DiGraph()
    G.add_nodes_from(G_topology.nodes)
    
    # Handle edge weights (can be tuple keys as strings or list keys)
    for key, w in edge_weights_data.items():
        if isinstance(key, list) or isinstance(key, tuple):
            u, v = key
        elif isinstance(key, str) and '->' in key:
            u, v = key.split('->', 1)
        else:
            continue
        G.add_edge(u, v, weight=w)
    
    # Find start nodes
    start_nodes = [n for n in G_topology.nodes if G_topology.in_degree(n) == 0]
    if not start_nodes:
        start_nodes = list(G_topology.nodes)
    
    # Enumerate all valid paths
    all_paths = []
    for start in start_nodes:
        try:
            all_paths.extend(nx.all_simple_paths(G_topology, start, target))
        except nx.NetworkXNoPath:
            pass
    
    if not all_paths:
        return jsonify({'error': 'No valid paths found'}), 400
    
    # Initialize population
    population = []
    for path in all_paths:
        if is_valid_path(path, G_topology):
            population.append(path)
            if len(population) >= population_size:
                break
    
    if len(population) < population_size:
        path_index = 0
        max_attempts = min(population_size * 2, len(all_paths) * 10)
        while len(population) < population_size and len(all_paths) > 0 and path_index < max_attempts:
            path = all_paths[path_index % len(all_paths)]
            if is_valid_path(path, G_topology):
                if path not in population:
                    population.append(path)
            path_index += 1
    
    if len(population) < 2:
        if len(all_paths) > 0:
            population.append(all_paths[0])
            if len(all_paths) > 1:
                population.append(all_paths[1])
    
    elite_size = max(1, population_size // 10)
    best_overall = None
    best_cost = float("inf")
    best_fitness = 0.0
    
    mutation_counter = 0
    crossover_counter = 0
    parent_selection_index = 0
    crossover_point_index = 0
    
    for gen in range(generations):
        selected, elite = select_population(population, G, G_topology, retain, elite_size)
        new_population = elite.copy()
        
        while len(new_population) < population_size:
            should_crossover = (crossover_counter % int(1 / crossover_rate)) == 0
            
            if should_crossover and len(selected) >= 2:
                idx1 = parent_selection_index % len(selected)
                idx2 = (parent_selection_index + 1) % len(selected)
                parent1, parent2 = selected[idx1], selected[idx2]
                parent_selection_index += 2
                
                child = crossover(parent1, parent2, G_topology, crossover_point_index)
                crossover_point_index += 1
                crossover_counter += 1
                
                if child and child not in new_population:
                    child = mutate_path(child, all_paths, mutation_rate, G_topology, mutation_counter)
                    mutation_counter += 1
                    if is_valid_path(child, G_topology):
                        new_population.append(child)
                else:
                    parent_idx = parent_selection_index % len(selected)
                    parent = selected[parent_idx]
                    parent_selection_index += 1
                    mutated = mutate_path(parent, all_paths, mutation_rate, G_topology, mutation_counter)
                    mutation_counter += 1
                    if mutated not in new_population:
                        new_population.append(mutated)
            else:
                parent_idx = parent_selection_index % len(selected)
                parent = selected[parent_idx]
                parent_selection_index += 1
                mutated = mutate_path(parent, all_paths, mutation_rate, G_topology, mutation_counter)
                mutation_counter += 1
                if mutated not in new_population:
                    new_population.append(mutated)
                crossover_counter += 1
        
        population = new_population[:population_size]
        
        for path in elite:
            cost = path_cost(path, G)
            if cost < best_cost and cost != float("inf"):
                best_cost = cost
                best_overall = path
                best_fitness = penalized_fitness(path, G, G_topology)
    
    if not best_overall:
        return jsonify({'error': 'No valid solution found'}), 400
    
    return jsonify({
        'path': best_overall,
        'cost': best_cost,
        'fitness': best_fitness,
        'algorithm': 'genetic'
    })

@app.route('/api/calculate-weights', methods=['POST'])
def calculate_weights():
    """Calculate edge weights from user input parameters"""
    data = request.json
    selected_components = data.get('selected_components', [])
    parameters = data.get('parameters', {})
    
    # Build edge weights from selected components and their parameters
    edge_weights = {}
    
    for i in range(len(selected_components) - 1):
        u = selected_components[i]
        v = selected_components[i + 1]
        
        edge_key = f"{u}->{v}"
        param = parameters.get(edge_key, {})
        
        safety = param.get('safety', 'Medium')
        fastener = param.get('fastener', 'None')
        tool = param.get('tool', 'Pull')
        count = int(param.get('count', 0))
        
        weight = (
            SAFETY_MAP.get(safety, 2) +
            FASTENER_MAP.get(fastener, 2) +
            TOOL_MAP.get(tool, 2) +
            fastener_count_penalty(count)
        )
        
        # Use string key for JSON serialization
        edge_weights[edge_key] = weight
    
    return jsonify(edge_weights)

if __name__ == '__main__':
    app.run(debug=True, port=5000)

