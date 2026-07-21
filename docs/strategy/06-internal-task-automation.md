# Phase 0: Internal Task Automation

> **Status:** Spec  
> **Priority:** Highest - this is the first thing to build  
> **Goal:** Automate Techstream's internal Kanban task management before any client-facing automation. Proves the OpenCode fork, model routing, agent delegation, and human-in-the-loop review all work in a low-risk internal context.

---

## 1. Current State

- Client requests arrive via email, messaging, or calls
- Team manually creates tasks in Techstream Kanban board
- Tasks are manually triaged: what type, priority, who should handle it
- Task details (description, requirements, acceptance criteria) written manually
- Status updates require manual checking and updating
- No automated tracking of what's in progress across all clients

## 2. Target State

- Client request arrives → AI classifies it → AI creates Kanban task with populated details
- AI suggests: task type, priority (high/medium/low), estimated effort (hours), which agent/skill to use, dependencies on other tasks
- Human reviews the AI-generated task in the Kanban, adjusts if needed, approves
- As work progresses through the pipeline, AI updates task status automatically
- Weekly: AI generates a "what's in progress" summary for the team
- Monthly: AI generates workload analytics (tasks completed, avg turnaround, bottlenecks)

---

## 3. Task Classification

When a client request comes in, the AI classifies it into one of:

| Request Type | Example | Routes To | Priority |
|---|---|---|---|
| Content creation | "Need a blog post about X" | Content Writer agent | Medium |
| SEO work | "Can you improve our Google ranking?" | SEO Auditor agent | Medium |
| Design change | "Update the hero image on homepage" | Site Builder agent | Low |
| Bug fix | "Contact form isn't submitting" | Site Builder agent | High |
| New feature | "Can we add a booking calendar?" | IA Planner → Site Builder | Medium |
| Brand work | "We need a new logo" | Brand Strategist agent | Medium |
| Strategy | "What should we focus on next quarter?" | Campaign Planner agent | Low |
| Report request | "Send me this month's numbers" | Report Generator agent | Medium |
| General inquiry | "How do I update my hours?" | Human (not automated) | Low |

### Classification Schema

```json
{
  "classification": {
    "requestType": "bug_fix | content_creation | seo_work | design_change | new_feature | brand_work | strategy | report_request | general_inquiry",
    "priority": "high | medium | low",
    "estimatedEffortHours": 4,
    "suggestedAgent": "site-builder",
    "suggestedSkill": "bug-fix",
    "dependencies": ["task-id-123"],
    "requiresHumanReview": true,
    "confidence": 0.92
  }
}
```

---

## 4. Kanban Integration

The AI integrates with the existing Techstream Kanban board.

### 4.1 Task Creation

When a request is classified, the AI creates a card with:

| Field | Description |
|---|---|
| **Title** | AI-generated summary of the request |
| **Description** | Expanded details with requirements |
| **Labels** | Type (content/seo/design/bug/feature), Priority (high/medium/low), Client name |
| **Checklist** | AI-generated subtasks if the task is complex |
| **Estimated effort** | In hours (AI estimate, human can adjust) |
| **Suggested agent** | Which agent/skill should handle this |
| **Dependencies** | Links to other tasks if applicable |
| **Due date** | AI-suggested based on priority and workload |

#### Task Creation Payload

```json
{
  "title": "Fix contact form submission error on Pawdora site",
  "description": "The contact form at /contact on pawdora.com is returning a 500 error when users submit. Investigation needed on the form handler and email integration.",
  "labels": ["bug", "high", "pawdora"],
  "checklist": [
    "Reproduce the error on staging",
    "Check server logs for form submission endpoint",
    "Fix the underlying issue",
    "Test form submission end-to-end",
    "Deploy fix to production"
  ],
  "estimatedEffortHours": 3,
  "suggestedAgent": "site-builder",
  "suggestedSkill": "bug-fix",
  "dependencies": [],
  "dueDate": "2026-06-26T00:00:00Z",
  "clientId": "pawdora",
  "sourceRequest": {
    "channel": "email",
    "rawMessage": "Hey team, our contact form on the homepage isn't working...",
    "receivedAt": "2026-06-24T14:30:00Z"
  }
}
```

### 4.2 Status Automation

As work moves through the pipeline, status updates automatically:

| Status | Trigger |
|---|---|
| `Backlog` | Task created, awaiting human review |
| `Approved` | Human has reviewed and approved the AI-generated task |
| `In Progress` | Agent has started work |
| `In Review` | Agent work complete, awaiting human review |
| `Done` | Human approved and delivered to client |
| `Blocked` | Waiting on client input or external dependency |

#### Status Transition Payload

```json
{
  "taskId": "task-abc-123",
  "status": "in_review",
  "agentOutput": {
    "summary": "Fixed form handler validation and email service config",
    "artifacts": ["https://github.com/techstream/pawdora/pull/42"],
    "notes": "Needs manual review of email template copy"
  },
  "updatedBy": "agent:site-builder",
  "timestamp": "2026-06-24T16:45:00Z"
}
```

### 4.3 Weekly Summary

Every Monday, AI generates:

- Tasks completed last week (by client, by type)
- Tasks in progress (with status)
- Blocked tasks (with reason)
- Upcoming deadlines this week
- Workload distribution across team members

#### Weekly Summary Payload

```json
{
  "weekStart": "2026-06-16",
  "weekEnd": "2026-06-22",
  "completedTasks": [
    {
      "taskId": "task-001",
      "title": "Add booking calendar to Pawdora",
      "clientId": "pawdora",
      "type": "new_feature",
      "completedAt": "2026-06-18T15:00:00Z",
      "effortHours": 8
    }
  ],
  "inProgressTasks": [
    {
      "taskId": "task-002",
      "title": "SEO audit for GreenLeaf",
      "clientId": "greenleaf",
      "type": "seo_work",
      "status": "in_progress",
      "startedAt": "2026-06-20T09:00:00Z"
    }
  ],
  "blockedTasks": [
    {
      "taskId": "task-003",
      "title": "Redesign hero section",
      "clientId": "pawdora",
      "blockedReason": "Waiting on client image assets",
      "blockedSince": "2026-06-15T10:00:00Z"
    }
  ],
  "upcomingDeadlines": [
    {
      "taskId": "task-004",
      "title": "Monthly analytics report",
      "clientId": "greenleaf",
      "dueDate": "2026-06-25T00:00:00Z"
    }
  ],
  "workloadDistribution": [
    { "agent": "site-builder", "activeTasks": 4, "totalEffortHours": 18 },
    { "agent": "content-writer", "activeTasks": 2, "totalEffortHours": 6 },
    { "agent": "seo-auditor", "activeTasks": 1, "totalEffortHours": 4 }
  ]
}
```

---

## 5. Human-in-the-Loop Touchpoints

| Stage | Human Action | Time Estimate |
|---|---|---|
| Task creation | Review AI-generated task, adjust priority/effort/assignment, approve | 2-5 min |
| Work review | Review AI-generated output, request revisions or approve | 5-15 min |
| Client delivery | Write personal note, attach deliverables, send | 5-10 min |
| Weekly review | Review AI-generated summary, adjust priorities | 10-15 min |

**Total human time per task:** ~15-30 minutes (down from 30-60 minutes without automation)

---

## 6. Technical Implementation

### 6.1 BullMQ Jobs

```typescript
// Queue: task-intake
interface TaskIntakeJob {
  clientId: string;
  requestSource: "email" | "slack" | "web_form" | "manual";
  rawMessage: string;
  attachments?: {
    filename: string;
    url: string;
    mimeType: string;
  }[];
}

// Queue: task-status-sync
interface TaskStatusSyncJob {
  taskId: string;
  newStatus: "backlog" | "approved" | "in_progress" | "in_review" | "done" | "blocked";
  agentOutput?: {
    summary: string;
    artifacts: string[];
    notes?: string;
  };
  updatedBy: string;
}

// Queue: weekly-summary
interface WeeklySummaryJob {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
}
```

### 6.2 OpenCode Server Call

```
POST /execute
Content-Type: application/json

{
  "agent": "task-classifier",
  "model": "deepseek-v4-flash",
  "input": {
    "rawMessage": "Client email text...",
    "clientId": "pawdora",
    "clientContext": {
      "brand": "Pawdora",
      "industry": "Pet supplies e-commerce",
      "activeModules": ["website", "seo", "content"]
    }
  }
}
```

**Response:**

```json
{
  "classification": {
    "requestType": "bug_fix",
    "priority": "high",
    "estimatedEffortHours": 3,
    "suggestedAgent": "site-builder",
    "suggestedSkill": "bug-fix",
    "dependencies": [],
    "requiresHumanReview": true,
    "confidence": 0.94
  },
  "generatedTask": {
    "title": "Fix contact form submission error on Pawdora site",
    "description": "The contact form at /contact on pawdora.com is returning a 500 error when users submit. Investigation needed on the form handler and email integration.",
    "checklist": [
      "Reproduce the error on staging",
      "Check server logs for form submission endpoint",
      "Fix the underlying issue",
      "Test form submission end-to-end",
      "Deploy fix to production"
    ],
    "dueDate": "2026-06-26T00:00:00Z"
  }
}
```

### 6.3 Kanban API

The Techstream platform exposes a Kanban API that the OpenCode server calls:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/kanban/tasks` | Create task |
| `PATCH` | `/api/kanban/tasks/:id` | Update task status/details |
| `GET` | `/api/kanban/tasks?clientId=X` | Get tasks for client |
| `GET` | `/api/kanban/summary?week=YYYY-MM-DD` | Get weekly summary data |

#### API Contracts

**POST /api/kanban/tasks**

```json
// Request
{
  "title": "string",
  "description": "string",
  "labels": ["string"],
  "checklist": ["string"],
  "estimatedEffortHours": "number",
  "suggestedAgent": "string",
  "suggestedSkill": "string",
  "dependencies": ["string (taskId)"],
  "dueDate": "ISO8601",
  "clientId": "string",
  "sourceRequest": {
    "channel": "string",
    "rawMessage": "string",
    "receivedAt": "ISO8601"
  }
}

// Response 201
{
  "id": "task-abc-123",
  "status": "backlog",
  "createdAt": "2026-06-24T14:30:00Z",
  "...all fields from request"
}
```

**PATCH /api/kanban/tasks/:id**

```json
// Request
{
  "status": "in_progress",
  "agentOutput": {
    "summary": "string",
    "artifacts": ["string"],
    "notes": "string?"
  },
  "updatedBy": "string"
}

// Response 200
{
  "id": "task-abc-123",
  "status": "in_progress",
  "updatedAt": "2026-06-24T16:45:00Z"
}
```

**GET /api/kanban/tasks?clientId=X**

```json
// Response 200
{
  "tasks": [
    {
      "id": "task-abc-123",
      "title": "string",
      "status": "in_progress",
      "labels": ["string"],
      "clientId": "string",
      "dueDate": "ISO8601",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "total": 12
}
```

**GET /api/kanban/summary?week=YYYY-MM-DD**

```json
// Response 200
{
  "weekStart": "2026-06-16",
  "weekEnd": "2026-06-22",
  "completedTasks": [...],
  "inProgressTasks": [...],
  "blockedTasks": [...],
  "upcomingDeadlines": [...],
  "workloadDistribution": [...]
}
```

---

## 7. Success Metrics

| Metric | Current (Manual) | Target (Automated) |
|---|---|---|
| Time from request to task created | 30-60 min | <5 min |
| Task detail quality | Inconsistent | Consistent, AI-populated |
| Status update lag | Hours-days | Real-time |
| Weekly reporting time | 1-2 hours | Automated |
| Tasks missed/dropped | Occasional | Near zero (everything tracked) |

---

## 8. Implementation Steps

1. **Build Kanban API endpoints** on Techstream platform
   - `POST /api/kanban/tasks`
   - `PATCH /api/kanban/tasks/:id`
   - `GET /api/kanban/tasks`
   - `GET /api/kanban/summary`

2. **Build task-classifier agent** in OpenCode fork
   - Prompt engineering for classification accuracy
   - Client context injection (brand, industry, active modules)
   - Confidence scoring with fallback to human review below threshold

3. **Build BullMQ workers**
   - `task-intake` worker: receives raw request → calls OpenCode classifier → creates Kanban task
   - `task-status-sync` worker: listens for agent completions → updates Kanban status
   - `weekly-summary` worker: cron job every Monday → generates and posts summary

4. **Build weekly summary agent**
   - Queries Kanban API for completed, in-progress, blocked tasks
   - Generates workload distribution
   - Formats output for team consumption (Slack/email)

5. **Test with real client requests** (human reviews everything)
   - Run in parallel with manual process for 1-2 weeks
   - Compare AI-generated tasks against manually created ones
   - Track classification accuracy and task quality

6. **Iterate** on classification accuracy and task quality
   - Tune prompts based on misclassifications
   - Adjust priority heuristics
   - Refine effort estimation

7. **Graduate** - once stable for 2+ weeks with no critical misses, consider Phase 0 complete and begin Phase 1 (client-facing automation)

---

## 9. Architecture Diagram

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Request     │     │  BullMQ         │     │  OpenCode Server │
│  Sources     │────▶│  task-intake    │────▶│  /execute        │
│  (email,     │     │  queue          │     │  (task-          │
│   slack,     │     └─────────────────┘     │   classifier)    │
│   web)       │              │              └────────┬─────────┘
└──────────────┘              │                       │
                              ▼                       ▼
                      ┌─────────────────┐    ┌──────────────────┐
                      │  Kanban API     │◀───│  AI-generated    │
                      │  POST /tasks    │    │  task payload    │
                      └────────┬────────┘    └──────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  Human Review   │
                      │  (approve /     │
                      │   adjust)       │
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐     ┌──────────────────┐
                      │  Agent Executes │────▶│  OpenCode Server │
                      │  Work           │     │  /execute        │
                      │                 │     │  (work agent)    │
                      └────────┬────────┘     └────────┬─────────┘
                               │                       │
                               ▼                       ▼
                      ┌─────────────────┐     ┌──────────────────┐
                      │  BullMQ         │◀────│  Agent output    │
                      │  task-status-   │     │  + artifacts     │
                      │  sync queue     │     └──────────────────┘
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  Kanban API     │
                      │  PATCH /tasks   │
                      │  (status update)│
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  Human Review   │
                      │  (approve /     │
                      │   request       │
                      │   changes)      │
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  Deliver to     │
                      │  Client         │
                      └─────────────────┘
```

---

## 10. Open Questions

- [ ] Which Kanban board provider does Techstream use? (Linear, Jira, custom?)
- [ ] What is the request ingestion mechanism? (Email forwarding, Slack bot, web form?)
- [ ] How is client context stored and retrieved? (CRM, database, config file?)
- [ ] What is the confidence threshold for auto-approval vs. mandatory human review?
- [ ] Should the weekly summary be posted to Slack, email, or both?
- [ ] How do we handle multi-client requests (e.g., "update all client sites with new footer")?
