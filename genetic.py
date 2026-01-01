import time
import copy
import math

# =====================================================
# GENETIC ALGORITHM CONCEPTS
# =====================================================
# GENE DEFINITION:
# - Gene = A single component/step in the disassembly sequence
# - Chromosome = A complete disassembly path (sequence of components)
# - Example: Path [Component_A, Component_B, Component_C] is a chromosome
#            where Component_A, Component_B, Component_C are genes (individual steps)
#
# POPULATION SIZE CALCULATION:
# Based on number of arrangements (permutations): n components → n! arrangements
# Example: 3 components (A, B, C) → 3! = 6 arrangements:
#   ABC, ACB, BAC, BCA, CAB, CBA
#   Population size = 6 (one for each arrangement)

# =====================================================
# 1. CHECK IF DATA EXISTS FROM DIJKSTRA CELL
# =====================================================

# Check if variables from Dijkstra cell already exist
if 'G_topology' in globals() and 'G' in globals() and 'all_paths' in globals() and 'target' in globals():
    # Use existing variables (from Dijkstra cell)
    print("✅ Found existing data from Dijkstra algorithm cell. Reusing...")
    print(f"   Target: {target}")
    print(f"   Valid paths: {len(all_paths)}")
    print(f"   Graph edges: {G.number_of_edges()}")
else:
    # If variables don't exist, load data (standalone mode)
    import pandas as pd
    import networkx as nx

    print("⚠️  No existing data found. Loading from CSV...")
    edges_df = pd.read_csv("edges.csv")
    edges_df["from"] = edges_df["from"].astype(str).str.strip()
    edges_df["to"] = edges_df["to"].astype(str).str.strip()

    # Define mappings for gearbox disassembly
    safety_map = {"Low": 1, "Medium": 2, "High": 3}

    fastener_map = {
        "Snap ring": 1,
        "Bolts": 2,
        "Snap fit": 1.5,
        "Spring": 1.5,
        "Press fit": 3,
        "None": 1
    }

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
        if count == 0:
            return 1
        elif count <= 2:
            return 1.5
        elif count <= 4:
            return 2
        else:
            return 3

    # Build topology graph
    G_topology = nx.DiGraph()
    for _, row in edges_df.iterrows():
        G_topology.add_edge(row["from"], row["to"])

    # Get target component
    target = input("Enter component to disassemble: ").strip()
    if target not in G_topology.nodes:
        raise ValueError(f"Target '{target}' not in graph")

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
        raise ValueError(f"No valid disassembly paths found to '{target}'")

    print(f"\nNumber of valid disassembly paths: {len(all_paths)}")

    # Collect edge weights from user input
    edge_weights = {}
    print("\n" + "="*60)
    print("Enter disassembly details for each connection:")
    print("="*60 + "\n")

    for path in all_paths:
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            if (u, v) in edge_weights:
                continue

            print(f"\nDisassembly step: {u} → {v}")
            safety = input("  Safety risk (Low / Medium / High): ").strip()

            print(
                "  Fastener types: Snap ring / Bolts / Snap fit / Spring / Press fit / None")
            fastener = input("  Fastener type: ").strip()

            print("  Tools: Pull / Flat screwdriver 1 & flat screwdriver 2 & hammer / Bearing splitter / Cordless drill rivet gun / Puller / Bearing splitter & hydraulic press / Heel bar / Gear puller / Push")
            tool = input("  Tool used: ").strip()

            count_input = input("  Number of fasteners (0 for none): ").strip()
            count = int(count_input) if count_input else 0

            weight = (
                safety_map.get(safety, 2) +
                fastener_map.get(fastener, 2) +
                tool_map.get(tool, 2) +
                fastener_count_penalty(count)
            )

            edge_weights[(u, v)] = weight
            print(f"  → Weight assigned: {weight}")

    # Build weighted graph
    G = nx.DiGraph()
    G.add_nodes_from(G_topology.nodes)
    for (u, v), w in edge_weights.items():
        G.add_edge(u, v, weight=w)

# =====================================================
# 2. FITNESS FUNCTION & PATH VALIDATION
# =====================================================


def path_cost(path, G):
    """Calculate total cost of a disassembly path"""
    cost = 0
    for i in range(len(path) - 1):
        if not G.has_edge(path[i], path[i+1]):
            return float("inf")
        cost += G[path[i]][path[i+1]]["weight"]
    return cost


def is_valid_path(path, G_topology):
    """Check if path is valid (follows topology constraints)"""
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

# =====================================================
# 3. CONSTRAINT HANDLING
# =====================================================


def constraint_penalty(path, G, G_topology):
    """
    Apply penalties for violating constraints:
    1. Path validity (topology constraints)
    2. High safety risks should be minimized
    3. Tool changes should be minimized (continuity)
    4. Long paths with many steps
    """
    penalty = 0

    # Constraint 1: Path must be valid
    if not is_valid_path(path, G_topology):
        penalty += 1000  # Heavy penalty for invalid paths

    # Constraint 2: Penalize very long paths (more steps = more complexity)
    if len(path) > 20:  # Adjust threshold based on your gearbox
        penalty += (len(path) - 20) * 5

    # Constraint 3: Safety risk accumulation (prefer paths with fewer high-risk steps)
    high_risk_count = 0
    for i in range(len(path) - 1):
        if G.has_edge(path[i], path[i+1]):
            weight = G[path[i]][path[i+1]]["weight"]
            # If weight suggests high safety risk (weight > threshold)
            if weight > 8:  # Adjust based on your weight distribution
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

# =====================================================
# 4. GENETIC OPERATORS
# =====================================================


def crossover(parent1, parent2, G_topology, crossover_index=0):
    """
    Crossover: Combine two parent chromosomes (paths) by swapping genes (components)
    Strategy: Find common nodes, merge paths at intersection points
    Uses deterministic selection (no random variation)
    """
    # Find common nodes between paths
    common_nodes = set(parent1) & set(parent2)

    if len(common_nodes) < 2:  # Not enough common nodes for crossover
        return None

    # Deterministic crossover point selection (no random variation)
    common_list = [n for n in common_nodes if n !=
                   parent1[0] and n != parent1[-1]]
    if not common_list:
        return None

    # Use modulo to deterministically select crossover point
    crossover_point = common_list[crossover_index % len(common_list)]

    # Split parents at crossover point
    idx1 = parent1.index(crossover_point)
    idx2 = parent2.index(crossover_point)

    # Create child: first part of parent1 + second part of parent2
    child = parent1[:idx1+1] + parent2[idx2+1:]

    # Validate and fix child path
    if is_valid_path(child, G_topology):
        return child

    # If invalid, try reverse crossover
    child = parent2[:idx2+1] + parent1[idx1+1:]
    if is_valid_path(child, G_topology):
        return child

    return None


def mutate_path(path, all_paths, mutation_rate, G_topology, mutation_counter):
    """
    Mutation: Replace a gene (component/step) in the chromosome (path)
    Uses deterministic selection based on mutation_counter to avoid randomness
    (since complexity/uncertainty is already captured in edge weights)
    """
    # If mutation_rate is 0, never mutate
    if mutation_rate == 0 or mutation_rate <= 0:
        return path

    # Deterministic mutation: use counter to determine when to mutate
    # Example: mutation_rate = 0.2 means mutate 20% of the time (1 out of 5)
    mutation_interval = max(1, int(1 / mutation_rate))
    if mutation_counter % mutation_interval != 0:
        return path  # Don't mutate based on mutation_rate

    # Deterministic selection: use modulo to cycle through available paths
    path_index = mutation_counter % len(all_paths)
    return all_paths[path_index]

# =====================================================
# 5. SELECTION & POPULATION MANAGEMENT
# =====================================================


def select_population(population, G, G_topology, retain, elite_size=0):
    """
    Selection with elitism:
    - Keep top elite_size solutions
    - Keep top retain% of remaining population
    """
    # Sort by penalized fitness (higher is better)
    scored = [(p, penalized_fitness(p, G, G_topology)) for p in population]
    scored.sort(key=lambda x: x[1], reverse=True)

    # Elitism: keep best solutions
    elite = [p for p, _ in scored[:elite_size]] if elite_size > 0 else []

    # Selection: keep top retain% of population
    retain_length = max(elite_size, int(len(population) * retain))
    selected = [p for p, _ in scored[:retain_length]]

    return selected, elite


def maintain_diversity(population, new_population, min_diversity=0.7):
    """
    Ensure population diversity by removing too-similar paths
    """
    if len(new_population) <= 1:
        return new_population

    diverse = [new_population[0]]

    for candidate in new_population[1:]:
        is_diverse = True
        for existing in diverse:
            # Calculate similarity (percentage of common nodes)
            similarity = len(set(candidate) & set(existing)) / \
                max(len(candidate), len(existing))
            if similarity > (1 - min_diversity):
                is_diverse = False
                break

        if is_diverse:
            diverse.append(candidate)

    return diverse

# =====================================================
# 6. GENETIC ALGORITHM MAIN LOOP
# =====================================================


# Calculate default population size based on number of arrangements (permutations)
# Formula: n components → n! arrangements (e.g., A, B, C → 6 arrangements: ABC, ACB, BAC, BCA, CAB, CBA)
if len(all_paths) > 0:
    # Use average path length as representative number of components
    avg_path_length = sum(len(p) for p in all_paths) / len(all_paths)
    num_components = int(avg_path_length)

    # Calculate factorial (number of arrangements): n components → n! arrangements
    factorial_arrangements = math.factorial(num_components)

    # Population size = number of arrangements (factorial)
    # The GA will generate new paths through crossover and mutation
    # Use the full factorial value (no arbitrary cap)
    default_population_size = factorial_arrangements

    # Ensure at least 2 for crossover to work
    default_population_size = max(2, default_population_size)
else:
    default_population_size = 10
    avg_path_length = 0
    factorial_arrangements = 0

# DEFAULT PARAMETERS
DEFAULT_RETAIN = 0.5  # Keep top 50% of population
DEFAULT_MUTATION_RATE = 0.2  # 20% mutation rate
DEFAULT_GENERATIONS = 30  # Run for 30 generations
DEFAULT_CROSSOVER_RATE = 0.7  # 70% crossover rate

print("\n=== GENETIC ALGORITHM PARAMETERS ===")
if len(all_paths) > 0:
    print(f"Average path length: {int(avg_path_length)} components")
    print(
        f"Number of arrangements: {int(avg_path_length)}! = {factorial_arrangements}")
    print(
        f"Default population size: {default_population_size} (based on {factorial_arrangements} arrangements)")
else:
    print(f"Default population size: {default_population_size}")

# Ask user if they want to use defaults or input custom values
use_defaults = input(
    "\nUse default parameters? (y/n, default: y): ").strip().lower()
if use_defaults == '' or use_defaults == 'y':
    population_size = default_population_size
    retain = DEFAULT_RETAIN
    mutation_rate = DEFAULT_MUTATION_RATE
    generations = DEFAULT_GENERATIONS
    crossover_rate = DEFAULT_CROSSOVER_RATE
    print(f"\n✅ Using default parameters:")
    print(f"   Population size: {population_size}")
    print(f"   Retain ratio: {retain}")
    print(f"   Mutation rate: {mutation_rate}")
    print(f"   Crossover rate: {crossover_rate}")
    print(f"   Generations: {generations}")
else:
    # User wants to input custom values
    population_size = input(
        f"Population size (default: {default_population_size}): ").strip()
    population_size = int(
        population_size) if population_size else default_population_size
    # No cap - allow larger than available paths
    population_size = max(1, population_size)

    retain = input(f"Retain ratio (default: {DEFAULT_RETAIN}): ").strip()
    retain = float(retain) if retain else DEFAULT_RETAIN
    retain = max(0.1, min(retain, 1.0))

    mutation_rate = input(
        f"Mutation rate (default: {DEFAULT_MUTATION_RATE}): ").strip()
    mutation_rate = float(
        mutation_rate) if mutation_rate else DEFAULT_MUTATION_RATE
    mutation_rate = max(0.0, min(mutation_rate, 1.0))

    crossover_rate = input(
        f"Crossover rate (default: {DEFAULT_CROSSOVER_RATE}): ").strip()
    crossover_rate = float(
        crossover_rate) if crossover_rate else DEFAULT_CROSSOVER_RATE
    crossover_rate = max(0.0, min(crossover_rate, 1.0))

    generations = input(
        f"Number of generations (default: {DEFAULT_GENERATIONS}): ").strip()
    generations = int(generations) if generations else DEFAULT_GENERATIONS
    generations = max(1, generations)

elite_size = max(1, population_size // 10)  # Keep top 10% as elite

# Initialize population deterministically (no random variation)
# Take first N valid paths in order
population = []
for path in all_paths:
    if is_valid_path(path, G_topology):
        population.append(path)
        if len(population) >= population_size:
            break

# If we don't have enough paths, repeat from beginning (deterministic)
# This is fine - GA will generate new paths through crossover/mutation
if len(population) < population_size:
    path_index = 0
    max_attempts = min(population_size * 2, len(all_paths)
                       * 10)  # Limit attempts for performance
    while len(population) < population_size and len(all_paths) > 0 and path_index < max_attempts:
        path = all_paths[path_index % len(all_paths)]
        if is_valid_path(path, G_topology):
            if path not in population:  # Avoid exact duplicates
                population.append(path)
        path_index += 1

    # If still not enough, just use what we have - GA will fill the rest via operations
    if len(population) < 2:
        # Need at least 2 for crossover
        if len(all_paths) > 0:
            population.append(all_paths[0])
            if len(all_paths) > 1:
                population.append(all_paths[1])

best_overall = None
best_cost = float("inf")
best_fitness = 0.0

start_time = time.time()

print(f"\n=== EVOLUTION STARTED ===")
print(f"Initial population: {len(population)} paths")
print(f"Generations: {generations}")
print()

# Deterministic counters for operations (no random variation)
mutation_counter = 0
crossover_counter = 0
parent_selection_index = 0
crossover_point_index = 0

for gen in range(generations):
    # Selection with elitism
    selected, elite = select_population(
        population, G, G_topology, retain, elite_size)

    # Create new population
    new_population = elite.copy()

    # Fill population through crossover and mutation (deterministic)
    while len(new_population) < population_size:
        # Deterministic crossover/mutation decision based on counter
        should_crossover = (crossover_counter % int(1 / crossover_rate)) == 0

        if should_crossover and len(selected) >= 2:
            # Deterministic parent selection (cycle through selected)
            idx1 = parent_selection_index % len(selected)
            idx2 = (parent_selection_index + 1) % len(selected)
            parent1, parent2 = selected[idx1], selected[idx2]
            parent_selection_index += 2

            child = crossover(parent1, parent2, G_topology,
                              crossover_point_index)
            crossover_point_index += 1
            crossover_counter += 1

            if child and child not in new_population:
                child = mutate_path(
                    child, all_paths, mutation_rate, G_topology, mutation_counter)
                mutation_counter += 1
                if is_valid_path(child, G_topology):
                    new_population.append(child)
            else:
                # If crossover failed, use mutation instead
                parent_idx = parent_selection_index % len(selected)
                parent = selected[parent_idx]
                parent_selection_index += 1
                mutated = mutate_path(
                    parent, all_paths, mutation_rate, G_topology, mutation_counter)
                mutation_counter += 1
                if mutated not in new_population:
                    new_population.append(mutated)
        else:
            # Mutation only (deterministic parent selection)
            parent_idx = parent_selection_index % len(selected)
            parent = selected[parent_idx]
            parent_selection_index += 1
            mutated = mutate_path(
                parent, all_paths, mutation_rate, G_topology, mutation_counter)
            mutation_counter += 1
            if mutated not in new_population:
                new_population.append(mutated)
            crossover_counter += 1

    # Maintain diversity (optional, can be expensive) - run less frequently for large populations
    diversity_frequency = 10 if len(population) > 50 else 5
    if gen % diversity_frequency == 0 and gen > 0:  # Skip first generation, then every N
        new_population = maintain_diversity(
            population, new_population, min_diversity=0.6)
        # Fill to population_size if diversity removed too many (deterministic)
        fill_index = 0
        while len(new_population) < population_size and len(all_paths) > 0:
            path = all_paths[fill_index % len(all_paths)]
            if is_valid_path(path, G_topology) and path not in new_population:
                new_population.append(path)
            fill_index += 1
            # Increased safety break for larger populations
            if fill_index > len(all_paths) * 20:
                break

    population = new_population[:population_size]

    # Track best solution (optimized - only check elite paths which are most likely to improve)
    # Since we already calculated fitness in select_population, we can reuse that logic
    # Check all elite paths (should be small number)
    for path in elite:
        cost = path_cost(path, G)
        if cost < best_cost and cost != float("inf"):
            best_cost = cost
            best_overall = path
            best_fitness = penalized_fitness(path, G, G_topology)

    # Progress report (optimized - sample for average cost if population is large)
    if gen % max(1, generations // 5) == 0 or gen == generations - 1:
        # For large populations, sample for average to save computation
        if len(population) > 50:
            sample_size = min(20, len(population))
            sample_paths = population[::len(
                population)//sample_size][:sample_size]
            avg_cost = sum(path_cost(p, G) for p in sample_paths if path_cost(p, G) != float(
                "inf")) / len([p for p in sample_paths if path_cost(p, G) != float("inf")])
        else:
            avg_cost = sum(path_cost(p, G) for p in population if path_cost(p, G) != float(
                "inf")) / len([p for p in population if path_cost(p, G) != float("inf")])
        print(
            f"Generation {gen:3d} | Best cost: {best_cost:.2f} | Avg cost: {avg_cost:.2f} | Best fitness: {best_fitness:.4f}")

elapsed_time = time.time() - start_time

# =====================================================
# 7. RESULTS
# =====================================================

print("\n" + "="*60)
print("🧬 GENETIC ALGORITHM RESULT")
print("="*60)
print(f"\nTarget component: {target}")
print(f"\nBest disassembly sequence ({len(best_overall)} steps):")
for i, component in enumerate(best_overall, 1):
    print(f"  {i:2d}. {component}")

print(f"\nTotal disassembly complexity score: {best_cost:.2f}")
print(f"Best fitness: {best_fitness:.4f}")
print(f"Evolution time: {elapsed_time:.2f} seconds")
print(f"Generations: {generations}")
print("\n(Lower score = easier/safer disassembly)")
