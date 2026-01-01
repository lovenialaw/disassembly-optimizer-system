import pandas as pd
import networkx as nx

# 1. Load & clean data from Neo4j export
# Upload edges.csv to Google Colab first (from Neo4j export)
edges_df = pd.read_csv("gear_edges.csv")
edges_df["from"] = edges_df["from"].astype(str).str.strip()
edges_df["to"] = edges_df["to"].astype(str).str.strip()

# 2. Define mappings for gearbox disassembly
safety_map = {"Low": 1, "Medium": 2, "High": 3}

# Fastener types for gearbox
fastener_map = {
    "Snap ring": 1,
    "Bolts": 2,
    "Snap fit": 1.5,
    "Spring": 1.5,
    "Press fit": 3,
    "None": 1  # For components that just slide/pull out
}

# Tools used in gearbox disassembly
tool_map = {
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
    """Penalty based on number of fasteners"""
    if count == 0:
        return 1
    elif count <= 2:
        return 1.5
    elif count <= 4:
        return 2
    else:
        return 3

# 3. Build topology graph (disassembly sequence)
# If A is blocked_by B, then B must be removed before A
# So edge in disassembly graph: B -> A
G_topology = nx.DiGraph()

for _, row in edges_df.iterrows():
    G_topology.add_edge(row["from"], row["to"])

# 4. Target input
print("Available components:", sorted(list(G_topology.nodes)))
print()

target = input("Enter component to disassemble: ").strip()

if target not in G_topology.nodes:
    raise ValueError(f"Target '{target}' not in graph. Available components listed above.")

# 5. Find start nodes (components with no dependencies - can be removed first)
# In disassembly graph, these are nodes with no incoming edges
start_nodes = [n for n in G_topology.nodes if G_topology.in_degree(n) == 0]

if not start_nodes:
    print("Warning: No start nodes found. Graph might be cyclic.")
    # Use all nodes as potential starts if needed
    start_nodes = list(G_topology.nodes)

print(f"\nStart nodes (can be removed first): {start_nodes}")

# 6. Enumerate valid paths
all_paths = []

for start in start_nodes:
    try:
        all_paths.extend(nx.all_simple_paths(G_topology, start, target))
    except nx.NetworkXNoPath:
        pass

if not all_paths:
    raise ValueError(f"No valid disassembly paths found to '{target}'")

print(f"\nNumber of valid disassembly paths: {len(all_paths)}")

# 7. Collect EDGE weights from user input
edge_weights = {}

print("\n" + "="*60)
print("Enter disassembly details for each connection:")
print("="*60 + "\n")

for path in all_paths:
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]  # u -> v means remove u before v

        if (u, v) in edge_weights:
            continue

        print(f"\nDisassembly step: {u} → {v}")
        print("  (Remove '{u}' before '{v}')")
        
        safety = input("  Safety risk (Low / Medium / High): ").strip()
        
        print("  Fastener types: Snap ring / Bolts / Snap fit / Spring / Press fit / None")
        fastener = input("  Fastener type: ").strip()
        
        print("  Tools: Pull / Flat screwdriver 1 & flat screwdriver 2 & hammer / Bearing splitter / Cordless drill rivet gun / Puller / Bearing splitter & hydraulic press / Heel bar / Gear puller / Push")
        tool = input("  Tool used: ").strip()
        
        count_input = input("  Number of fasteners (0 for none, e.g., snap rings or press fits): ").strip()
        count = int(count_input) if count_input else 0

        # Calculate weight
        weight = (
            safety_map.get(safety, 2) +
            fastener_map.get(fastener, 2) +
            tool_map.get(tool, 2) +
            fastener_count_penalty(count)
        )
        
        edge_weights[(u, v)] = weight
        print(f"  → Weight assigned: {weight}")

# 8. Build WEIGHTED graph
G = nx.DiGraph()
G.add_nodes_from(G_topology.nodes)

for (u, v), w in edge_weights.items():
    G.add_edge(u, v, weight=w)

# 9. Run Dijkstra to find optimal path
best_path = None
best_cost = float("inf")

for start in start_nodes:
    if start not in G:
        continue

    try:
        path = nx.dijkstra_path(G, start, target, weight="weight")
        cost = nx.dijkstra_path_length(G, start, target, weight="weight")

        if cost < best_cost:
            best_cost = cost
            best_path = path
    except nx.NetworkXNoPath:
        pass

# 10. Output results
print("\n" + "="*60)
print("DIJKSTRA RESULT - OPTIMAL DISASSEMBLY SEQUENCE")
print("="*60)
print(f"\nTarget component: {target}")
print(f"\nOptimal disassembly sequence:")
for i, component in enumerate(best_path, 1):
    print(f"  {i}. {component}")
print(f"\nTotal disassembly complexity score: {best_cost}")
print("\n(Lower score = easier/safer disassembly)")

