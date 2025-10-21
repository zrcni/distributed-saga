import { SagaOrchestrator } from "../SagaOrchestrator"
import { SagaPlugin, SagaTreeNode } from "./types"

export interface ExecutionTreeOptions {
  /**
   * Callback when tree is updated
   */
  onTreeUpdate?: (tree: SagaTreeNode[]) => void | Promise<void>

  /**
   * Store historical trees (memory intensive)
   */
  keepHistory?: boolean

  /**
   * Maximum depth to track (prevents infinite recursion)
   */
  maxDepth?: number
}

/**
 * Execution Tree Tracker Plugin
 * 
 * Builds and maintains a tree structure of saga executions showing parent-child
 * relationships. Useful for visualizing complex saga hierarchies and debugging.
 * 
 * @example
 * ```typescript
 * const treeTracker = new ExecutionTreeTracker({
 *   onTreeUpdate: async (tree) => {
 *     await renderTreeVisualization(tree)
 *   },
 *   keepHistory: true
 * })
 * 
 * const orchestrator = new SagaOrchestrator()
 * treeTracker.attach(orchestrator)
 * 
 * // Later, get the tree
 * const tree = treeTracker.getTree()
 * console.log(JSON.stringify(tree, null, 2))
 * ```
 */
export class ExecutionTreeTracker implements SagaPlugin {
  readonly name = "ExecutionTreeTracker"
  
  private options: Required<ExecutionTreeOptions>
  private nodes: Map<string, SagaTreeNode> = new Map()
  private rootNodes: Set<string> = new Set()
  private history: SagaTreeNode[][] = []
  private listeners: Map<string, Function> = new Map()

  constructor(options: ExecutionTreeOptions = {}) {
    this.options = {
      onTreeUpdate: options.onTreeUpdate || (() => {}),
      keepHistory: options.keepHistory ?? false,
      maxDepth: options.maxDepth ?? 10
    }
  }

  attach(orchestrator: SagaOrchestrator): void {
    const onSagaStarted = (event: any) => this.handleSagaStarted(event)
    const onSagaSucceeded = (event: any) => this.handleSagaEnded(event, 'completed')
    const onSagaFailed = (event: any) => this.handleSagaEnded(event, 'failed')
    const onCompensationStarted = (event: any) => this.handleCompensationStarted(event)
    const onCompensationSucceeded = (event: any) => this.handleCompensationEnded(event)

    orchestrator.on('sagaStarted', onSagaStarted)
    orchestrator.on('sagaSucceeded', onSagaSucceeded)
    orchestrator.on('sagaFailed', onSagaFailed)
    orchestrator.on('compensationStarted', onCompensationStarted)
    orchestrator.on('compensationSucceeded', onCompensationSucceeded)

    this.listeners.set('sagaStarted', onSagaStarted)
    this.listeners.set('sagaSucceeded', onSagaSucceeded)
    this.listeners.set('sagaFailed', onSagaFailed)
    this.listeners.set('compensationStarted', onCompensationStarted)
    this.listeners.set('compensationSucceeded', onCompensationSucceeded)
  }

  detach(orchestrator: SagaOrchestrator): void {
    this.listeners.forEach((listener, eventName) => {
      orchestrator.off(eventName as any, listener as any)
    })
    this.listeners.clear()
  }

  private handleSagaStarted(event: { sagaId: string; data: unknown }): void {
    const node: SagaTreeNode = {
      sagaId: event.sagaId,
      parentSagaId: null, // Would come from saga context
      parentTaskId: null, // Would come from saga context
      status: 'running',
      startTime: new Date(),
      children: [],
      metadata: {
        data: event.data
      }
    }

    this.nodes.set(event.sagaId, node)

    // If no parent, this is a root node
    if (!node.parentSagaId) {
      this.rootNodes.add(event.sagaId)
    } else {
      // Add to parent's children
      const parent = this.nodes.get(node.parentSagaId)
      if (parent) {
        parent.children.push(node)
      }
    }

    this.notifyUpdate()
  }

  private handleSagaEnded(
    event: { sagaId: string; data: unknown; error?: unknown },
    status: 'completed' | 'failed'
  ): void {
    const node = this.nodes.get(event.sagaId)
    if (!node) return

    node.status = status
    node.endTime = new Date()
    
    if (event.error) {
      node.metadata.error = event.error
    }

    this.notifyUpdate()
  }

  private handleCompensationStarted(event: { sagaId: string }): void {
    const node = this.nodes.get(event.sagaId)
    if (!node) return

    node.status = 'compensating'
    this.notifyUpdate()
  }

  private handleCompensationEnded(event: { sagaId: string }): void {
    const node = this.nodes.get(event.sagaId)
    if (!node) return

    node.status = 'compensated'
    this.notifyUpdate()
  }

  private notifyUpdate(): void {
    const tree = this.getTree()
    
    if (this.options.keepHistory) {
      this.history.push(JSON.parse(JSON.stringify(tree)))
    }
    
    this.options.onTreeUpdate(tree)
  }

  /**
   * Get the current execution tree
   */
  getTree(): SagaTreeNode[] {
    return Array.from(this.rootNodes)
      .map(sagaId => this.nodes.get(sagaId))
      .filter((node): node is SagaTreeNode => node !== undefined)
  }

  /**
   * Get a specific node by saga ID
   */
  getNode(sagaId: string): SagaTreeNode | undefined {
    return this.nodes.get(sagaId)
  }

  /**
   * Get all children of a saga
   */
  getChildren(sagaId: string): SagaTreeNode[] {
    const node = this.nodes.get(sagaId)
    return node ? node.children : []
  }

  /**
   * Get the path from root to a specific saga
   */
  getPath(sagaId: string): SagaTreeNode[] {
    const path: SagaTreeNode[] = []
    let currentNode = this.nodes.get(sagaId)

    while (currentNode) {
      path.unshift(currentNode)
      if (!currentNode.parentSagaId) break
      currentNode = this.nodes.get(currentNode.parentSagaId)
    }

    return path
  }

  /**
   * Get all leaf nodes (sagas with no children)
   */
  getLeafNodes(): SagaTreeNode[] {
    return Array.from(this.nodes.values()).filter(
      node => node.children.length === 0
    )
  }

  /**
   * Get tree depth
   */
  getDepth(sagaId?: string): number {
    if (sagaId) {
      return this.getPath(sagaId).length
    }

    // Get max depth across all trees
    let maxDepth = 0
    this.rootNodes.forEach(rootId => {
      const depth = this.calculateDepth(this.nodes.get(rootId))
      maxDepth = Math.max(maxDepth, depth)
    })
    return maxDepth
  }

  private calculateDepth(node: SagaTreeNode | undefined): number {
    if (!node || node.children.length === 0) return 1
    
    const childDepths = node.children.map(child => this.calculateDepth(child))
    return 1 + Math.max(...childDepths)
  }

  /**
   * Get statistics about the tree
   */
  getStats(): {
    totalSagas: number
    rootSagas: number
    running: number
    completed: number
    failed: number
    compensating: number
    compensated: number
    averageDepth: number
    maxDepth: number
  } {
    const nodes = Array.from(this.nodes.values())
    
    return {
      totalSagas: nodes.length,
      rootSagas: this.rootNodes.size,
      running: nodes.filter(n => n.status === 'running').length,
      completed: nodes.filter(n => n.status === 'completed').length,
      failed: nodes.filter(n => n.status === 'failed').length,
      compensating: nodes.filter(n => n.status === 'compensating').length,
      compensated: nodes.filter(n => n.status === 'compensated').length,
      averageDepth: this.calculateAverageDepth(),
      maxDepth: this.getDepth()
    }
  }

  private calculateAverageDepth(): number {
    const depths = Array.from(this.nodes.keys()).map(id => this.getDepth(id))
    if (depths.length === 0) return 0
    return depths.reduce((a, b) => a + b, 0) / depths.length
  }

  /**
   * Export tree as ASCII art
   */
  exportAsASCII(): string {
    const lines: string[] = []
    
    this.rootNodes.forEach(rootId => {
      const node = this.nodes.get(rootId)
      if (node) {
        this.buildASCII(node, '', true, lines)
      }
    })

    return lines.join('\n')
  }

  private buildASCII(
    node: SagaTreeNode,
    prefix: string,
    isLast: boolean,
    lines: string[]
  ): void {
    const statusIcon = this.getStatusIcon(node.status)
    const connector = isLast ? '└── ' : '├── '
    const line = `${prefix}${connector}${statusIcon} ${node.sagaId.substring(0, 8)}...`
    lines.push(line)

    const childPrefix = prefix + (isLast ? '    ' : '│   ')
    node.children.forEach((child, index) => {
      const isLastChild = index === node.children.length - 1
      this.buildASCII(child, childPrefix, isLastChild, lines)
    })
  }

  private getStatusIcon(status: SagaTreeNode['status']): string {
    const icons = {
      running: '⏳',
      completed: '✅',
      failed: '❌',
      compensating: '↩️',
      compensated: '↩️✓'
    }
    return icons[status]
  }

  /**
   * Export tree as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.getTree(), null, 2)
  }

  /**
   * Export tree as DOT (for Graphviz)
   */
  exportAsDOT(): string {
    const lines = ['digraph SagaTree {']
    lines.push('  rankdir=TB;')
    lines.push('  node [shape=box];')

    this.nodes.forEach(node => {
      const color = this.getNodeColor(node.status)
      lines.push(`  "${node.sagaId}" [label="${node.sagaId.substring(0, 8)}..." color="${color}"];`)
      
      node.children.forEach(child => {
        lines.push(`  "${node.sagaId}" -> "${child.sagaId}";`)
      })
    })

    lines.push('}')
    return lines.join('\n')
  }

  private getNodeColor(status: SagaTreeNode['status']): string {
    const colors = {
      running: 'blue',
      completed: 'green',
      failed: 'red',
      compensating: 'orange',
      compensated: 'purple'
    }
    return colors[status]
  }

  /**
   * Get historical snapshots (if keepHistory is enabled)
   */
  getHistory(): SagaTreeNode[][] {
    return [...this.history]
  }

  /**
   * Clear the tree (useful for testing or resetting)
   */
  clear(): void {
    this.nodes.clear()
    this.rootNodes.clear()
    this.history = []
  }
}
