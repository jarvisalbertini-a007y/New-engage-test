"""
SalesFlow AI Core Module

Contains the unified agent framework and core functionality.
"""

from .agent_framework import (
    # Classes
    BaseAgent,
    AgentRegistry,
    AgentContext,
    ExecutionPlan,
    TaskExecutionEngine,
    AgentCapability,
    
    # Specialized Agents
    OrchestratorAgent,
    ResearchAgent,
    OutreachAgent,
    OptimizationAgent,
    IntelligenceAgent,
    KnowledgeAgent,
    WorkflowAgent,
    QualificationAgent,
    
    # Enums
    AgentRole,
    TaskStatus,
    
    # Functions
    get_registry,
    get_all_agents_info,
    quick_agent_execute,
)

__all__ = [
    'BaseAgent',
    'AgentRegistry', 
    'AgentContext',
    'ExecutionPlan',
    'TaskExecutionEngine',
    'AgentCapability',
    'OrchestratorAgent',
    'ResearchAgent',
    'OutreachAgent',
    'OptimizationAgent',
    'IntelligenceAgent',
    'KnowledgeAgent',
    'WorkflowAgent',
    'QualificationAgent',
    'AgentRole',
    'TaskStatus',
    'get_registry',
    'get_all_agents_info',
    'quick_agent_execute',
]
