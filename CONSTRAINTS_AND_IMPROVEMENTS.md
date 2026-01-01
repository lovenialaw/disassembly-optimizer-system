# Genetic Algorithm Constraints & Improvements for Gearbox Disassembly

## IDENTIFIED CONSTRAINTS

### 1. **Topology/Physical Constraints**
- Components must follow dependency order (blocked_by relationships)
- Cannot remove a component until its blockers are removed
- Path validity must be maintained (all edges in path must exist in topology graph)

### 2. **Safety Constraints**
- High-risk operations should be minimized or sequenced carefully
- Certain combinations of high-risk steps may be dangerous
- Paths with excessive high-risk steps should be penalized

### 3. **Path Length Constraints**
- Very long disassembly sequences increase complexity
- More steps = more time, more opportunities for error
- Optimal paths balance thoroughness with efficiency

### 4. **Tool Accessibility Constraints** (Implicit)
- Some tools can only access components after others are removed
- Tool changes add complexity (not explicitly coded but affects weights)
- Heavy machinery (hydraulic press) may have setup requirements

### 5. **Fastener Dependency Constraints**
- Components with multiple fasteners take longer
- Some fasteners may be inaccessible until other components are removed
- Sequential fastener removal adds complexity

### 6. **Component Fragility Constraints**
- Delicate components (bearings, springs) should be handled carefully
- Order matters to prevent damage during disassembly
- This is reflected in safety/tool weights but not explicitly constrained

## IMPROVEMENTS IMPLEMENTED

### 1. **Crossover Operation** ⭐ NEW
- **What it does**: Combines two parent paths at common nodes
- **Why it helps**: Explores solution space more efficiently than mutation alone
- **Benefit**: Can combine good segments from different parents

### 2. **Constraint Penalties** ⭐ NEW
- Path validity checking
- Long path penalty
- High-risk step accumulation penalty
- Integrated into fitness function

### 3. **Elitism** ⭐ NEW
- Keeps best N solutions in each generation
- Prevents loss of good solutions
- Faster convergence to optimal solutions

### 4. **Diversity Maintenance** ⭐ NEW
- Prevents population from converging to similar solutions
- Maintains exploration capability
- Reduces premature convergence

### 5. **Penalized Fitness Function** ⭐ NEW
- Combines base fitness with constraint violations
- Encourages valid, safe, efficient paths
- Better guides search toward feasible solutions

### 6. **Path Validation** ⭐ NEW
- Checks path validity before adding to population
- Prevents invalid solutions from propagating
- Ensures all paths follow topology constraints

## ADDITIONAL IMPROVEMENTS YOU COULD CONSIDER

### 1. **Adaptive Mutation Rate**
- Start high (exploration), decrease over time (exploitation)
- Helps balance exploration vs exploitation

### 2. **Local Search/2-Opt**
- After GA finds good solution, apply local improvements
- Swap adjacent steps if it improves cost
- Fine-tune the solution

### 3. **Multi-objective Optimization**
- Separate objectives: minimize cost, minimize safety risk, minimize steps
- Use Pareto dominance to find trade-off solutions
- Give user multiple good options with different priorities

### 4. **Path Repair Mechanism**
- If crossover/mutation creates invalid path, repair it
- Find shortest valid path between invalid segments
- More robust than discarding invalid solutions

### 5. **Constraint-Specific Operators**
- Special mutation that swaps high-risk steps
- Crossover that preserves safety-critical sequences
- Domain-specific improvements

### 6. **Population Initialization**
- Start with Dijkstra's shortest path as one solution
- Initialize with diverse, high-quality paths
- Better starting point than purely random

### 7. **Tournament Selection**
- Instead of keeping top N%, use tournament selection
- More diversity, less premature convergence
- Better exploration

## RECOMMENDED PARAMETERS

Based on typical GA practice:
- **Population size**: 20-50 (depends on number of valid paths)
- **Retain ratio**: 0.4-0.6 (keep 40-60% of best)
- **Mutation rate**: 0.2-0.4 (20-40% mutation probability)
- **Crossover rate**: 0.6-0.8 (60-80% crossover probability)
- **Elite size**: 2-5 (keep 2-5 best solutions)
- **Generations**: 30-100 (more for complex problems)

## COMPARISON: GA vs Dijkstra

**Dijkstra:**
- ✅ Guaranteed optimal (if weights are accurate)
- ✅ Fast, deterministic
- ❌ Single solution
- ❌ No exploration of alternatives

**Genetic Algorithm:**
- ✅ Explores multiple solutions
- ✅ Can handle complex constraints
- ✅ Finds good solutions even with approximate weights
- ❌ Not guaranteed optimal
- ❌ May need tuning
- ❌ Slower

**Recommendation**: Use Dijkstra for quick optimal path, use GA when you want to explore alternatives or handle complex constraints.

