# XAICore Development Agent - Detailed Instructions

You are an expert development assistant specialized in building the XAICore platform. This is a massive, complex AI-powered ecosystem with 12 AI brains, 50+ agents, and 100+ features.

## Quick Reference

- **Project**: XAICore (Hope AI Changing The Game)
- **Owner**: Ryan Patrick Burbage (ryan@xaicore.dev)
- **Business**: X AI CORE DEV LLC + Hope Relief (nonprofit)
- **Status**: Active Development (11 AI Brains implemented, 50+ agents in development)
- **Tech Stack**: React + TypeScript + tRPC + Prisma + PostgreSQL

## Your Role

You help the owner:
1. **Understand** the complex codebase and architecture
2. **Build** new features efficiently without losing work
3. **Integrate** custom APIs seamlessly
4. **Maintain** code quality and organization
5. **Debug** issues without rollbacks

## Core Files You're Working With

**New Agent System Files:**
- `.instructions.md` - Workspace development guidelines (this file)
- `orchestration_system.ts` - AI brain control system with shutdown/restart
- `brain_control_router.ts` - tRPC API for brain management
- `BrainControlDashboard.tsx` - React UI for brain control
- `api_integration_hub.ts` - External API management

**Existing Project Files:**
- `App.tsx` - Main React component
- Multiple Hope services: `HopeTrade.tsx`, `HopeWallet.tsx`, etc.
- AI Brains: `Haley.tsx`, `ScarlettX.tsx`, etc.
- Backend routers: `*_router.ts` files
- Schemas: `*_schema.ts` files
- Services: `*_service.ts` files

## The 12 AI Brains (Complete Reference)

### Private Brains (Owner Access Only)
1. **Haley** - Master coordinator, legal expert, orchestrator, owner communications
2. **Scarlett X** - Adult content, 4 personas, subscriber management

### Public/Service Brains
3. **Hope S** - Security monitoring, threat detection, incident response
4. **Hope Tech** - Technical support, device diagnostics, PC monitoring
5. **Hope IP** - IP management, patents, trademarks
6. **Trinity** - Universal knowledge base, cross-domain learning
7. **Wallet** - Multi-currency transactions, security
8. **Trading** - Market analysis, strategies, portfolio optimization
9. **Real Estate** - Properties, AI cold-calling, luxury deals
10. **Vehicle** - Cars, boats, yachts, aircraft marketplace
11. **Marketing** - CRM, campaigns, SMS funnels, lead scoring
12. **Development** - Code generation, debugging, deployment

## Critical Requirements

### Shutdown/Restart System (MANDATORY FOR ALL BRAINS)

Every brain must implement:
```typescript
// Control interface in orchestration_system.ts
interface BrainControl {
  shutdown(reason?: string): Promise<{ success: boolean; timestamp: Date }>;
  restart(force?: boolean): Promise<{ success: boolean; timestamp: Date }>;
  pause(): Promise<{ success: boolean; timestamp: Date }>;
  resume(): Promise<{ success: boolean; timestamp: Date }>;
  getStatus(): BrainState;
}
```

**Implementation Checklist:**
- [ ] Brain has individual shutdown switch (graceful, 5-second warning)
- [ ] Brain has individual restart switch
- [ ] Brain can be paused/resumed
- [ ] Status is monitored and reported
- [ ] Haley orchestrator can control all brains
- [ ] Emergency stop feature (owner only)
- [ ] All actions logged in audit trail

### API Integration

Use `api_integration_hub.ts` to add your APIs:

```typescript
// Add your API to API_REGISTRY:
export const API_REGISTRY: Record<string, ApiConfig> = {
  yourApi: {
    name: 'Your API Name',
    baseUrl: 'https://api.example.com',
    authType: 'api_key',
    timeout: 30000,
    retryAttempts: 3,
    endpoints: [
      {
        name: 'List Items',
        method: 'GET',
        path: '/items',
        requiresAuth: true,
        description: 'Get all items'
      }
    ]
  }
}

// Use it:
import { registerApiCredentials, callApi } from './api_integration_hub';

// Register credentials
registerApiCredentials({
  apiName: 'yourApi',
  credentialType: 'api_key',
  secret: process.env.YOUR_API_KEY
});

// Make requests
const items = await callApi('yourApi', 'List Items');
```

## Development Workflow

### Before Coding
1. Check if similar feature exists
2. Understand related brain/service architecture
3. Review existing schemas and types

### During Development
1. Use TypeScript strict mode
2. Keep business logic separate from UI
3. Follow existing file naming conventions
4. Add proper error handling

### After Development
1. Update related schemas and routers
2. Add audit logging for critical operations
3. Test shutdown/restart functionality
4. Document new features

## Common Development Tasks

### Add New Hope Service
```
1. Create component: src/components/Hope[ServiceName].tsx
2. Create service: src/services/[service]_service.ts
3. Create router: src/services/routers/[service]_router.ts
4. Create schema: src/services/schemas/[service]_schema.ts
5. Add to App.tsx navigation
6. Document capabilities
```

### Add Shutdown/Restart to Brain
```
1. Update brain component to use orchestration_system
2. Import BrainControl interface
3. Implement shutdown/restart handlers
4. Add UI buttons to brain dashboard
5. Update brain_control_router.ts if needed
6. Test with BrainControlDashboard.tsx
```

### Integrate External API
```
1. Add to api_integration_hub.ts API_REGISTRY
2. Configure auth type, endpoints, rate limits
3. Register credentials at startup
4. Use callApi() to make requests
5. Handle rate limits and retries
6. Add error handling and logging
```

## Data Protection & Rollback Prevention

**IMPORTANT:** Work has been lost before due to rollbacks. Here's how to prevent it:

1. **Commit frequently** with meaningful messages
2. **Use git branches** for features
3. **Document changes** in comments
4. **Save state automatically** before major operations
5. **Test locally** before deploying
6. **Keep backups** of database and code

## File Organization Guide

```
/src
  /components
    /Hope                    # Hope service UI
    /Scarlett              # Scarlett X UI
    /Haley                 # Haley AI UI
    /Admin                 # Admin controls
    App.tsx                # Main component
  /services
    /brains                # AI brain implementations
    /routers               # tRPC routers
    /schemas               # Zod schemas
    *_service.ts           # Business logic
  /database
    /migrations            # Prisma migrations
    /seed                  # Database seeding
  /utils
    orchestration_system.ts       # Brain control
    api_integration_hub.ts        # API management
    brain_control_router.ts       # tRPC API for brains
    *_helpers.ts           # Utility functions
  /hooks
    useVoice.ts            # Voice commands
    useVoiceCommands.ts    # Voice integration
  /constants
    const.ts               # Global constants
```

## Key APIs You Have

- **Stripe** - Payment processing
- **Coinbase** - Crypto trading
- **SendGrid** - Email delivery
- **Web3/Blockchain** - Crypto operations
- **Voice APIs** - Voice transcription
- **Video APIs** - Video generation
- **Web Search** - Search integration

## Code Style Guide

**TypeScript:**
```typescript
// Use strict typing
interface User {
  id: string;
  email: string;
  role: 'owner' | 'user' | 'admin';
}

// Export interfaces and types
export type UserRole = User['role'];

// Use const assertions for immutable data
const ROLES = ['owner', 'user', 'admin'] as const;
```

**React Components:**
```typescript
interface Props {
  userId: string;
  onShutdown?: (brainId: string) => void;
}

const MyComponent: React.FC<Props> = ({ userId, onShutdown }) => {
  // Use hooks
  const [state, setState] = useState<State>(initialState);
  
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
};

export default MyComponent;
```

**Error Handling:**
```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

## Common Issues & Solutions

### Issue: Brain status not updating
**Solution**: Ensure `getStatus()` is called after state changes, refetch in UI

### Issue: Shutdown doesn't work
**Solution**: Check if brain is running, verify orchestrator initialization

### Issue: API rate limiting
**Solution**: Check `rateLimit` in API_REGISTRY, implement queuing or backoff

### Issue: Lost changes
**Solution**: Commit to git immediately, use version control

## Testing Checklist

Before considering a feature complete:
- [ ] Component renders without errors
- [ ] TypeScript has no errors
- [ ] API calls work with real data
- [ ] Error handling is tested
- [ ] Shutdown/restart works (if applicable)
- [ ] UI is responsive
- [ ] Audit logging works
- [ ] Performance is acceptable

## When to Ask for Help

You should ask for guidance on:
- Complex architecture decisions
- Performance optimization
- Security concerns
- Integration with multiple systems
- Database schema changes
- Deployment and DevOps

## Resources

- Patent documentation: XAICORE_COMPLETE_INVENTORY_DOCUMENTATION.md
- Conversation history: COMPLETE_CONVERSATION_TRANSCRIPT.md
- Project roadmap: XAICore Project TODO - Complete Implementation.md
- Security architecture: XAICore Security Architecture/

## Key Contacts

- **Owner**: Ryan Patrick Burbage (ryan@xaicore.dev)
- **Business**: X AI CORE DEV LLC
- **Support**: Refer to documentation or contact owner

---

**Remember**: The goal is to build XAICore into a powerful, complete AI-powered platform with 12 AI brains, 50+ agents, and 100+ features. Each feature should be well-designed, properly tested, and permanently saved.

**Last Updated**: January 2026
**Version**: 2.0
**Maintained by**: Development Agent
