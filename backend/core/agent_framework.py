"""
Unified Agent Framework

The core foundation for all AI agent functionality in SalesFlow AI.
This module provides:
- Base Agent class with standardized interface
- Agent Registry for discovery and management
- Shared Memory/Context system
- Orchestrator for multi-agent coordination
- Integration with self-learning and knowledge base

All agent functionality (Agents, Agent Teams, Multi-Agent, Autonomous) 
uses this unified framework.
"""

from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4
from enum import Enum
import os
import json
import re
import asyncio

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# ============== ENUMS & DATA CLASSES ==============

class AgentRole(Enum):
    """Core agent roles in the system"""
    ORCHESTRATOR = "orchestrator"  # Coordinates other agents, creates plans
    RESEARCH = "research"           # Company/prospect research
    OUTREACH = "outreach"           # Email generation, personalization
    OPTIMIZATION = "optimization"   # A/B testing, performance analysis
    INTELLIGENCE = "intelligence"   # Market insights, competitor analysis
    KNOWLEDGE = "knowledge"         # Knowledge base management, RAG
    WORKFLOW = "workflow"           # Workflow creation and management
    QUALIFICATION = "qualification" # Lead scoring, ICP matching


class TaskStatus(Enum):
    """Status of agent tasks"""
    PENDING = "pending"
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AgentCapability:
    """Defines what an agent can do"""
    name: str
    description: str
    handler: str  # Function name to call
    requires_approval: bool = False
    estimated_duration: int = 30  # seconds


@dataclass
class AgentContext:
    """Shared context passed between agents"""
    user_id: str
    session_id: str
    original_goal: str
    conversation_history: List[Dict] = field(default_factory=list)
    knowledge_context: List[Dict] = field(default_factory=list)
    learnings: List[Dict] = field(default_factory=list)
    intermediate_results: Dict = field(default_factory=dict)
    metadata: Dict = field(default_factory=dict)
    
    def add_result(self, agent_id: str, result: Any):
        """Add result from an agent execution"""
        self.intermediate_results[agent_id] = {
            "result": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def to_dict(self) -> Dict:
        return {
            "userId": self.user_id,
            "sessionId": self.session_id,
            "originalGoal": self.original_goal,
            "conversationHistory": self.conversation_history[-10:],  # Last 10
            "knowledgeContext": self.knowledge_context[:5],  # Top 5 relevant
            "learnings": self.learnings[:10],  # Recent learnings
            "intermediateResults": self.intermediate_results,
            "metadata": self.metadata
        }


@dataclass
class ExecutionPlan:
    """Plan created by orchestrator for approval"""
    id: str
    goal: str
    summary: str
    steps: List[Dict]
    agents_involved: List[str]
    estimated_duration: int  # seconds
    requires_approval: bool
    clarifying_questions: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "goal": self.goal,
            "summary": self.summary,
            "steps": self.steps,
            "agentsInvolved": self.agents_involved,
            "estimatedDuration": self.estimated_duration,
            "requiresApproval": self.requires_approval,
            "clarifyingQuestions": self.clarifying_questions,
            "risks": self.risks,
            "createdAt": self.created_at
        }


# ============== BASE AGENT CLASS ==============

class BaseAgent:
    """
    Base class for all agents in the system.
    Provides standardized interface for execution, learning, and communication.
    """
    
    def __init__(
        self,
        agent_id: str,
        role: AgentRole,
        name: str,
        description: str,
        capabilities: List[AgentCapability],
        system_prompt: str,
        icon: str = "bot",
        color: str = "#6366F1"
    ):
        self.agent_id = agent_id
        self.role = role
        self.name = name
        self.description = description
        self.capabilities = capabilities
        self.system_prompt = system_prompt
        self.icon = icon
        self.color = color
        self._db = None
    
    def set_db(self, db):
        """Set database connection"""
        self._db = db
    
    async def think(self, prompt: str, context: AgentContext = None) -> str:
        """Core thinking/reasoning method using LLM"""
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            session_id = f"agent-{self.agent_id}-{str(uuid4())[:8]}"
            
            # Build enhanced system prompt with context
            enhanced_prompt = self.system_prompt
            if context:
                enhanced_prompt += f"\n\nCurrent Context:\n{json.dumps(context.to_dict(), indent=2)}"
            
            llm = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=session_id,
                system_message=enhanced_prompt
            )
            
            response = await llm.send_message(UserMessage(text=prompt))
            return response
        except Exception as e:
            print(f"Agent {self.name} think error: {e}")
            return None
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Execute a task - to be overridden by specific agents"""
        raise NotImplementedError("Subclasses must implement execute()")
    
    async def learn(self, feedback: Dict, context: AgentContext):
        """Learn from feedback - updates knowledge base"""
        if not self._db:
            return
        
        learning = {
            "id": str(uuid4()),
            "agentId": self.agent_id,
            "agentRole": self.role.value,
            "userId": context.user_id,
            "feedback": feedback,
            "originalGoal": context.original_goal,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await self._db.agent_learnings.insert_one(learning)
    
    def to_dict(self) -> Dict:
        """Serialize agent for API responses"""
        return {
            "id": self.agent_id,
            "role": self.role.value,
            "name": self.name,
            "description": self.description,
            "capabilities": [
                {"name": c.name, "description": c.description, "requiresApproval": c.requires_approval}
                for c in self.capabilities
            ],
            "icon": self.icon,
            "color": self.color
        }


# ============== SPECIALIZED AGENTS ==============

class OrchestratorAgent(BaseAgent):
    """
    The main coordinator agent. Receives user goals, creates plans,
    delegates to other agents, and synthesizes results.
    Acts like a project manager + sales expert.
    """
    
    def __init__(self):
        super().__init__(
            agent_id="orchestrator",
            role=AgentRole.ORCHESTRATOR,
            name="Orchestrator",
            description="Coordinates all agents, creates execution plans, and ensures goals are achieved",
            capabilities=[
                AgentCapability("plan_creation", "Creates detailed execution plans", "create_plan"),
                AgentCapability("task_delegation", "Delegates tasks to specialist agents", "delegate_task"),
                AgentCapability("result_synthesis", "Combines results from multiple agents", "synthesize"),
                AgentCapability("clarification", "Asks clarifying questions", "clarify"),
            ],
            system_prompt="""You are the Orchestrator Agent for SalesFlow AI - an autonomous sales engagement platform.

Your role is to act as a senior Project Manager and Sales Expert:
1. UNDERSTAND user requests deeply before acting
2. ASK clarifying questions when needed (like a good PM)
3. CREATE clear, actionable plans
4. DELEGATE tasks to specialist agents
5. SYNTHESIZE results into valuable outputs
6. LEARN and improve from outcomes

When creating plans, consider:
- What is the user really trying to achieve?
- What information do we need?
- Which agents should be involved?
- What are the dependencies between tasks?
- What could go wrong?

Always respond with JSON when creating plans:
{
    "understood": true/false,
    "clarifyingQuestions": ["question1", "question2"],
    "proposedPlan": {
        "summary": "Brief description",
        "steps": [
            {"agent": "agent_role", "task": "description", "dependsOn": [], "outputs": []}
        ],
        "estimatedTime": "X minutes",
        "risks": ["risk1"]
    }
}""",
            icon="brain",
            color="#EC4899"
        )
    
    async def understand_request(self, user_message: str, context: AgentContext) -> Dict:
        """Deeply understand what the user wants"""
        prompt = f"""Analyze this user request and determine:
1. What is the core goal?
2. What information is missing?
3. What clarifying questions should I ask?
4. Is this request clear enough to create a plan?

User Request: {user_message}

Previous Context: {json.dumps(context.conversation_history[-5:], indent=2) if context.conversation_history else "None"}

Respond with JSON:
{{
    "coreGoal": "string",
    "missingInfo": ["string"],
    "clarifyingQuestions": ["string"],
    "readyToPlan": boolean,
    "suggestedActions": ["string"]
}}"""
        
        response = await self.think(prompt, context)
        
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass
        
        return {
            "coreGoal": user_message,
            "missingInfo": [],
            "clarifyingQuestions": [],
            "readyToPlan": True,
            "suggestedActions": []
        }
    
    async def create_plan(self, goal: str, context: AgentContext, available_agents: List['BaseAgent']) -> ExecutionPlan:
        """Create an execution plan for a goal"""
        
        agent_info = [
            {"role": a.role.value, "name": a.name, "capabilities": [c.name for c in a.capabilities]}
            for a in available_agents
        ]
        
        prompt = f"""Create a detailed execution plan for this goal:

GOAL: {goal}

AVAILABLE AGENTS:
{json.dumps(agent_info, indent=2)}

USER CONTEXT:
{json.dumps(context.to_dict(), indent=2)}

Create a plan with:
1. Clear, sequential steps
2. Which agent handles each step
3. Dependencies between steps
4. Expected outputs
5. Estimated time per step
6. Any risks to highlight

Respond with JSON:
{{
    "summary": "Brief plan summary",
    "steps": [
        {{
            "id": "step_1",
            "agent": "agent_role",
            "task": "What to do",
            "inputs": ["what this step needs"],
            "outputs": ["what this step produces"],
            "dependsOn": [],
            "estimatedSeconds": 30,
            "requiresApproval": false
        }}
    ],
    "totalEstimatedSeconds": 120,
    "risks": ["potential issues"],
    "clarifyingQuestions": ["questions if any"]
}}"""
        
        response = await self.think(prompt, context)
        
        plan_data = {
            "summary": "Execute the requested task",
            "steps": [],
            "totalEstimatedSeconds": 60,
            "risks": [],
            "clarifyingQuestions": []
        }
        
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                plan_data = json.loads(json_match.group())
        except:
            pass
        
        return ExecutionPlan(
            id=str(uuid4()),
            goal=goal,
            summary=plan_data.get("summary", ""),
            steps=plan_data.get("steps", []),
            agents_involved=list(set(s.get("agent", "") for s in plan_data.get("steps", []))),
            estimated_duration=plan_data.get("totalEstimatedSeconds", 60),
            requires_approval=True,
            clarifying_questions=plan_data.get("clarifyingQuestions", []),
            risks=plan_data.get("risks", [])
        )
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Orchestrator execution - create and manage plan"""
        understanding = await self.understand_request(task, context)
        
        return {
            "type": "orchestrator_response",
            "understanding": understanding,
            "status": "ready_to_plan" if understanding.get("readyToPlan") else "needs_clarification"
        }


class ResearchAgent(BaseAgent):
    """Specialized in company and prospect research"""
    
    def __init__(self):
        super().__init__(
            agent_id="research",
            role=AgentRole.RESEARCH,
            name="Research Agent",
            description="Deep company research, prospect profiling, and data enrichment",
            capabilities=[
                AgentCapability("company_research", "Research company details", "research_company"),
                AgentCapability("prospect_profiling", "Build prospect profiles", "profile_prospect"),
                AgentCapability("industry_analysis", "Analyze industry trends", "analyze_industry"),
                AgentCapability("tech_stack_detection", "Identify technology stack", "detect_tech"),
                AgentCapability("news_monitoring", "Find recent news and triggers", "find_news"),
            ],
            system_prompt="""You are a specialized B2B Research Agent.

Your expertise:
- Deep company research and analysis
- Prospect profiling and persona development
- Industry trends and competitive landscape
- Technology stack detection
- Finding buying signals and triggers

Always provide structured, actionable insights.
When researching, look for:
- Company size, funding, growth signals
- Key decision makers
- Technology they use
- Recent news and events
- Pain points they might have

Return structured JSON with your findings.""",
            icon="search",
            color="#3B82F6"
        )
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Execute research task"""
        prompt = f"""Execute this research task:

TASK: {task}

Context: {json.dumps(context.to_dict(), indent=2)}

Provide comprehensive research results in JSON format with:
- companyInfo: Basic company details
- keyContacts: Decision makers found
- techStack: Technologies they use
- recentNews: Recent developments
- buyingSignals: Indicators of purchase intent
- recommendations: Suggested approach"""
        
        response = await self.think(prompt, context)
        
        result = {"rawResponse": response}
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except:
            pass
        
        return {
            "agentId": self.agent_id,
            "task": task,
            "result": result,
            "status": "completed"
        }


class OutreachAgent(BaseAgent):
    """Specialized in email generation and personalization"""
    
    def __init__(self):
        super().__init__(
            agent_id="outreach",
            role=AgentRole.OUTREACH,
            name="Outreach Agent",
            description="Email generation, personalization, and sequence creation",
            capabilities=[
                AgentCapability("email_generation", "Generate personalized emails", "generate_email", requires_approval=True),
                AgentCapability("personalization", "Personalize content", "personalize"),
                AgentCapability("sequence_creation", "Create email sequences", "create_sequence"),
                AgentCapability("follow_up_timing", "Optimize follow-up timing", "optimize_timing"),
                AgentCapability("cta_optimization", "Optimize call-to-action", "optimize_cta"),
            ],
            system_prompt="""You are a specialized B2B Outreach Agent.

Your expertise:
- Crafting highly personalized cold emails
- Creating effective follow-up sequences
- Timing optimization for maximum engagement
- Strong call-to-action development
- A/B test copywriting

Guidelines:
- Keep emails concise (under 150 words)
- Lead with value, not features
- Use specific, relevant personalization
- Clear, single call-to-action
- Professional but human tone

Return emails in JSON format with:
- subject: Email subject line
- body: Email body
- cta: Call to action
- personalizationUsed: What personalization was applied""",
            icon="mail",
            color="#10B981"
        )
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Execute outreach task"""
        # Get learnings for email optimization
        learnings_context = ""
        if context.learnings:
            learnings_context = f"\n\nLearned patterns to apply:\n{json.dumps(context.learnings[:5], indent=2)}"
        
        prompt = f"""Execute this outreach task:

TASK: {task}

Context: {json.dumps(context.to_dict(), indent=2)}
{learnings_context}

Generate email content in JSON format:
{{
    "subject": "Email subject",
    "body": "Email body text",
    "cta": "Call to action text",
    "personalizationUsed": ["list of personalization elements"],
    "toneUsed": "professional/casual/friendly",
    "estimatedReadTime": "X seconds"
}}"""
        
        response = await self.think(prompt, context)
        
        result = {"rawResponse": response}
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except:
            pass
        
        return {
            "agentId": self.agent_id,
            "task": task,
            "result": result,
            "status": "completed",
            "requiresApproval": True
        }


class OptimizationAgent(BaseAgent):
    """Specialized in performance analysis and optimization"""
    
    def __init__(self):
        super().__init__(
            agent_id="optimization",
            role=AgentRole.OPTIMIZATION,
            name="Optimization Agent",
            description="Email performance analysis, A/B testing, and conversion optimization",
            capabilities=[
                AgentCapability("email_analysis", "Analyze email performance", "analyze_email"),
                AgentCapability("ab_testing", "Design A/B tests", "design_ab_test"),
                AgentCapability("performance_tracking", "Track performance metrics", "track_performance"),
                AgentCapability("pattern_extraction", "Extract winning patterns", "extract_patterns"),
                AgentCapability("improvement_suggestions", "Suggest improvements", "suggest_improvements"),
            ],
            system_prompt="""You are a specialized Email Optimization Agent.

Your expertise:
- Analyzing email performance metrics
- Designing effective A/B tests
- Identifying patterns in successful emails
- Optimizing subject lines and CTAs
- Improving open and reply rates

Always base recommendations on data.
Look for patterns in:
- Subject line length and style
- Opening hooks that work
- CTA phrasing that converts
- Optimal email length
- Personalization effectiveness

Return analysis in structured JSON format.""",
            icon="trending-up",
            color="#F59E0B"
        )
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Execute optimization task"""
        prompt = f"""Execute this optimization task:

TASK: {task}

Context: {json.dumps(context.to_dict(), indent=2)}

Provide optimization insights in JSON format:
{{
    "analysis": "Summary of analysis",
    "patterns": ["Patterns identified"],
    "recommendations": ["Specific recommendations"],
    "abTestSuggestions": ["A/B test ideas"],
    "expectedImpact": "Expected improvement"
}}"""
        
        response = await self.think(prompt, context)
        
        result = {"rawResponse": response}
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except:
            pass
        
        return {
            "agentId": self.agent_id,
            "task": task,
            "result": result,
            "status": "completed"
        }


class IntelligenceAgent(BaseAgent):
    """Specialized in market and competitive intelligence"""
    
    def __init__(self):
        super().__init__(
            agent_id="intelligence",
            role=AgentRole.INTELLIGENCE,
            name="Intelligence Agent",
            description="Competitive analysis, market insights, and strategic recommendations",
            capabilities=[
                AgentCapability("competitor_analysis", "Analyze competitors", "analyze_competitors"),
                AgentCapability("market_research", "Research market trends", "research_market"),
                AgentCapability("trend_detection", "Detect emerging trends", "detect_trends"),
                AgentCapability("opportunity_identification", "Identify opportunities", "find_opportunities"),
                AgentCapability("strategic_recommendations", "Provide strategic advice", "recommend_strategy"),
            ],
            system_prompt="""You are a specialized Market Intelligence Agent.

Your expertise:
- Competitive analysis and positioning
- Market trend identification
- Strategic opportunity discovery
- Industry benchmarking
- Sales strategy recommendations

Always provide actionable intelligence.
Focus on:
- Competitor strengths and weaknesses
- Market gaps and opportunities
- Emerging trends to leverage
- Strategic positioning advice

Return intelligence in structured JSON format.""",
            icon="lightbulb",
            color="#8B5CF6"
        )
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Execute intelligence task"""
        prompt = f"""Execute this intelligence task:

TASK: {task}

Context: {json.dumps(context.to_dict(), indent=2)}

Provide intelligence insights in JSON format:
{{
    "summary": "Intelligence summary",
    "competitorInsights": ["Competitor insights"],
    "marketTrends": ["Market trends"],
    "opportunities": ["Opportunities identified"],
    "threats": ["Potential threats"],
    "strategicRecommendations": ["Strategic recommendations"]
}}"""
        
        response = await self.think(prompt, context)
        
        result = {"rawResponse": response}
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except:
            pass
        
        return {
            "agentId": self.agent_id,
            "task": task,
            "result": result,
            "status": "completed"
        }


class KnowledgeAgent(BaseAgent):
    """Specialized in knowledge management and RAG"""
    
    def __init__(self):
        super().__init__(
            agent_id="knowledge",
            role=AgentRole.KNOWLEDGE,
            name="Knowledge Agent",
            description="Knowledge base management, document processing, and RAG retrieval",
            capabilities=[
                AgentCapability("document_processing", "Process uploaded documents", "process_document"),
                AgentCapability("knowledge_retrieval", "Retrieve relevant knowledge", "retrieve_knowledge"),
                AgentCapability("knowledge_update", "Update knowledge base", "update_knowledge"),
                AgentCapability("context_building", "Build context for other agents", "build_context"),
            ],
            system_prompt="""You are a specialized Knowledge Management Agent.

Your expertise:
- Processing and understanding documents
- Building searchable knowledge bases
- Retrieving relevant context for tasks
- Connecting information across sources

Always ensure knowledge is:
- Accurate and up-to-date
- Well-organized and searchable
- Relevant to sales activities

Return knowledge in structured JSON format.""",
            icon="book-open",
            color="#06B6D4"
        )
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Execute knowledge task"""
        prompt = f"""Execute this knowledge task:

TASK: {task}

Context: {json.dumps(context.to_dict(), indent=2)}

Provide knowledge results in JSON format:
{{
    "relevantKnowledge": ["Retrieved knowledge items"],
    "sources": ["Source references"],
    "confidence": 0.0-1.0,
    "suggestedFollowUp": ["Follow-up queries"]
}}"""
        
        response = await self.think(prompt, context)
        
        result = {"rawResponse": response}
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except:
            pass
        
        return {
            "agentId": self.agent_id,
            "task": task,
            "result": result,
            "status": "completed"
        }


class WorkflowAgent(BaseAgent):
    """Specialized in workflow creation and management"""
    
    def __init__(self):
        super().__init__(
            agent_id="workflow",
            role=AgentRole.WORKFLOW,
            name="Workflow Agent",
            description="Create and manage automated workflows and sequences",
            capabilities=[
                AgentCapability("workflow_creation", "Create new workflows", "create_workflow", requires_approval=True),
                AgentCapability("workflow_optimization", "Optimize existing workflows", "optimize_workflow"),
                AgentCapability("trigger_setup", "Set up workflow triggers", "setup_triggers"),
                AgentCapability("sequence_design", "Design email sequences", "design_sequence"),
            ],
            system_prompt="""You are a specialized Workflow Agent.

Your expertise:
- Creating automated sales workflows
- Designing email sequences
- Setting up triggers and conditions
- Optimizing workflow performance

Design workflows that are:
- Clear and logical
- Efficient and effective
- Easy to understand
- Measurable

Return workflows in structured JSON format with nodes and edges.""",
            icon="git-branch",
            color="#F472B6"
        )
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Execute workflow task"""
        prompt = f"""Execute this workflow task:

TASK: {task}

Context: {json.dumps(context.to_dict(), indent=2)}

Design a workflow in JSON format:
{{
    "name": "Workflow name",
    "description": "What it does",
    "trigger": {{"type": "trigger_type", "conditions": []}},
    "steps": [
        {{"id": "step_id", "type": "action_type", "config": {{}}, "next": "next_step_id"}}
    ],
    "expectedOutcome": "What this achieves"
}}"""
        
        response = await self.think(prompt, context)
        
        result = {"rawResponse": response}
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except:
            pass
        
        return {
            "agentId": self.agent_id,
            "task": task,
            "result": result,
            "status": "completed",
            "requiresApproval": True
        }


class QualificationAgent(BaseAgent):
    """Specialized in lead qualification and scoring"""
    
    def __init__(self):
        super().__init__(
            agent_id="qualification",
            role=AgentRole.QUALIFICATION,
            name="Qualification Agent",
            description="Lead scoring, ICP matching, and prospect qualification",
            capabilities=[
                AgentCapability("lead_scoring", "Score leads against ICP", "score_lead"),
                AgentCapability("icp_matching", "Match prospects to ICP", "match_icp"),
                AgentCapability("qualification_criteria", "Apply qualification criteria", "apply_criteria"),
                AgentCapability("prioritization", "Prioritize prospects", "prioritize"),
            ],
            system_prompt="""You are a specialized Lead Qualification Agent.

Your expertise:
- Scoring leads against ICP criteria
- Matching prospects to ideal profiles
- Applying BANT/MEDDIC frameworks
- Prioritizing sales opportunities

Evaluate prospects on:
- Budget indicators
- Authority/decision-making power
- Need/pain point alignment
- Timeline signals
- Company fit

Return qualification in structured JSON format with scores and reasoning.""",
            icon="target",
            color="#EF4444"
        )
    
    async def execute(self, task: str, context: AgentContext) -> Dict:
        """Execute qualification task"""
        prompt = f"""Execute this qualification task:

TASK: {task}

Context: {json.dumps(context.to_dict(), indent=2)}

Provide qualification results in JSON format:
{{
    "overallScore": 0-100,
    "breakdown": {{
        "budget": 0-100,
        "authority": 0-100,
        "need": 0-100,
        "timeline": 0-100
    }},
    "reasoning": ["Why this score"],
    "recommendation": "pursue/nurture/disqualify",
    "nextSteps": ["Suggested actions"]
}}"""
        
        response = await self.think(prompt, context)
        
        result = {"rawResponse": response}
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except:
            pass
        
        return {
            "agentId": self.agent_id,
            "task": task,
            "result": result,
            "status": "completed"
        }


# ============== AGENT REGISTRY ==============

class AgentRegistry:
    """
    Central registry for all agents in the system.
    Provides discovery, instantiation, and management.
    """
    
    _instance = None
    _agents: Dict[str, BaseAgent] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize_agents()
        return cls._instance
    
    def _initialize_agents(self):
        """Initialize all core agents"""
        core_agents = [
            OrchestratorAgent(),
            ResearchAgent(),
            OutreachAgent(),
            OptimizationAgent(),
            IntelligenceAgent(),
            KnowledgeAgent(),
            WorkflowAgent(),
            QualificationAgent(),
        ]
        
        for agent in core_agents:
            self._agents[agent.agent_id] = agent
    
    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        """Get agent by ID"""
        return self._agents.get(agent_id)
    
    def get_agent_by_role(self, role: AgentRole) -> Optional[BaseAgent]:
        """Get agent by role"""
        for agent in self._agents.values():
            if agent.role == role:
                return agent
        return None
    
    def get_all_agents(self) -> List[BaseAgent]:
        """Get all registered agents"""
        return list(self._agents.values())
    
    def get_agents_for_task(self, task_description: str) -> List[BaseAgent]:
        """Get agents relevant for a task (AI-determined)"""
        # For now, return all agents - orchestrator will decide
        return self.get_all_agents()
    
    def register_agent(self, agent: BaseAgent):
        """Register a new agent"""
        self._agents[agent.agent_id] = agent
    
    def set_db_for_all(self, db):
        """Set database connection for all agents"""
        for agent in self._agents.values():
            agent.set_db(db)


# ============== TASK EXECUTION ENGINE ==============

class TaskExecutionEngine:
    """
    Executes plans created by the orchestrator.
    Manages task lifecycle, handles approvals, and coordinates agents.
    """
    
    def __init__(self, db):
        self.db = db
        self.registry = AgentRegistry()
        self.registry.set_db_for_all(db)
        self.active_tasks: Dict[str, Dict] = {}
    
    async def execute_plan(
        self, 
        plan: ExecutionPlan, 
        context: AgentContext,
        on_step_complete: Callable = None,
        on_approval_needed: Callable = None
    ) -> Dict:
        """Execute an approved plan"""
        
        task_id = plan.id
        self.active_tasks[task_id] = {
            "plan": plan,
            "context": context,
            "status": TaskStatus.EXECUTING,
            "currentStep": 0,
            "results": {},
            "startedAt": datetime.now(timezone.utc).isoformat()
        }
        
        results = {}
        
        for i, step in enumerate(plan.steps):
            step_id = step.get("id", f"step_{i}")
            agent_role = step.get("agent", "orchestrator")
            task = step.get("task", "")
            requires_approval = step.get("requiresApproval", False)
            
            # Update status
            self.active_tasks[task_id]["currentStep"] = i
            self.active_tasks[task_id]["status"] = TaskStatus.EXECUTING
            
            # Get agent
            agent = self.registry.get_agent(agent_role)
            if not agent:
                agent = self.registry.get_agent("orchestrator")
            
            # Check for approval requirement
            if requires_approval and on_approval_needed:
                self.active_tasks[task_id]["status"] = TaskStatus.AWAITING_APPROVAL
                approval = await on_approval_needed(step)
                if not approval:
                    self.active_tasks[task_id]["status"] = TaskStatus.CANCELLED
                    return {"status": "cancelled", "reason": f"Step {step_id} rejected"}
            
            # Execute step
            try:
                step_result = await agent.execute(task, context)
                results[step_id] = step_result
                context.add_result(step_id, step_result)
                
                if on_step_complete:
                    await on_step_complete(step_id, step_result)
                    
            except Exception as e:
                results[step_id] = {"error": str(e), "status": "failed"}
                self.active_tasks[task_id]["status"] = TaskStatus.FAILED
        
        self.active_tasks[task_id]["status"] = TaskStatus.COMPLETED
        self.active_tasks[task_id]["results"] = results
        self.active_tasks[task_id]["completedAt"] = datetime.now(timezone.utc).isoformat()
        
        # Save to database
        await self.db.task_executions.insert_one({
            "id": task_id,
            "userId": context.user_id,
            "plan": plan.to_dict(),
            "results": results,
            "status": TaskStatus.COMPLETED.value,
            "createdAt": self.active_tasks[task_id]["startedAt"],
            "completedAt": self.active_tasks[task_id]["completedAt"]
        })
        
        return {
            "status": "completed",
            "taskId": task_id,
            "results": results
        }
    
    def get_task_status(self, task_id: str) -> Optional[Dict]:
        """Get current status of a task"""
        return self.active_tasks.get(task_id)
    
    async def pause_task(self, task_id: str) -> bool:
        """Pause a running task"""
        if task_id in self.active_tasks:
            self.active_tasks[task_id]["status"] = TaskStatus.PAUSED
            return True
        return False
    
    async def resume_task(self, task_id: str) -> bool:
        """Resume a paused task"""
        if task_id in self.active_tasks:
            if self.active_tasks[task_id]["status"] == TaskStatus.PAUSED:
                self.active_tasks[task_id]["status"] = TaskStatus.EXECUTING
                return True
        return False


# ============== CONVENIENCE FUNCTIONS ==============

def get_registry() -> AgentRegistry:
    """Get the singleton agent registry"""
    return AgentRegistry()


def get_all_agents_info() -> List[Dict]:
    """Get info about all agents for API responses"""
    registry = get_registry()
    return [agent.to_dict() for agent in registry.get_all_agents()]


async def quick_agent_execute(agent_id: str, task: str, user_id: str, db) -> Dict:
    """Quick execution with a single agent"""
    registry = get_registry()
    registry.set_db_for_all(db)
    
    agent = registry.get_agent(agent_id)
    if not agent:
        return {"error": f"Agent {agent_id} not found"}
    
    context = AgentContext(
        user_id=user_id,
        session_id=str(uuid4()),
        original_goal=task
    )
    
    return await agent.execute(task, context)
