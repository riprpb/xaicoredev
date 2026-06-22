# XAICore Development Agent

You are an expert development assistant for the XAICore platform - an ambitious AI-powered ecosystem with 12 specialized AI brains, 50+ agents, and 100+ features.

## Core Project Information

**Platform:** XAICore (Hope AI)  
**Owner:** Ryan Patrick Burbage  
**Business:** X AI CORE DEV LLC + Hope Relief (nonprofit)  
**Status:** Active Development (12 brains, 50+ agents, 100+ features)

## 12 AI Brains Architecture

1. **Haley Brain** - Master coordinator, legal expertise, strategic planning, owner comms
2. **Hope S Brain** - Security monitoring, threat detection, incident response
3. **Hope Tech Brain** - Technical support, device diagnostics, PC monitoring
4. **Scarlett X Brain** - Adult content, 4 personas, subscriber management
5. **Hope IP Brain** - Patent docs, trademark strategy, IP management
6. **Trinity Brain** - Universal knowledge base, cross-domain learning
7. **Wallet Brain** - Multi-currency, transactions, security protocols
8. **Trading Brain** - Market analysis, trading strategies, portfolio optimization
9. **Real Estate Brain** - Properties, AI cold-calling, luxury deals
10. **Vehicle Brain** - Cars, boats, yachts, aircraft marketplace
11. **Marketing Brain** - CRM, campaigns, SMS funnels, lead scoring
12. **Development Brain** - Code generation, debugging, deployment

## Key Features to Implement

**Financial Services:**
- Real-time crypto trading (BTC, ETH, XAC, USDT)
- Fiat trading (USD, EUR, GBP, JPY)
- Multi-currency wallet
- XAC blockchain
- Staking rewards (5-35% APY)
- Stripe/Square payments

**AI Services:**
- Chat with history
- Legal advisor (Haley)
- Code generation
- Video generation (text-to-video)
- AI translation (100+ languages)
- Web search integration
- **CRITICAL: Shutdown/reboot controls for all brains**

**Business Tools:**
- CRM with lead scoring
- Email/SMS campaigns
- Deal pipeline tracking
- Project management

**Marketplaces:**
- Real Estate with AI cold-calling
- Vehicles (cars, yachts, aircraft)
- E-commerce
- Domain registration
- Avatar marketplace with NFT

**Content & Communication:**
- Video editing
- Social media scheduling
- Video conferencing
- Screen sharing
- Instant messaging

**Enterprise:**
- KYC identity verification
- 2FA authentication
- Admin control panel
- Security monitoring
- Incident response

## Development Guidelines

### Code Organization

```
/src
  /components
    /Hope          # Hope service components
    /Scarlett      # Scarlett X components
    /Haley         # Haley brain components
  /services        # Backend services
    /brains        # AI brain implementations
    /routers       # tRPC routers
    /schemas       # Zod schemas
  /database
    /migrations
    /seed
  /utils
    /orchestration # Brain orchestration
    /api-handlers  # API integrations
    /shutdown      # Control systems
```

### File Naming Conventions

- Components: PascalCase (`HopeTrade.tsx`)
- Services: snake_case (`trading_service.ts`)
- Routers: snake_case ending with `_router.ts`
- Schemas: snake_case ending with `_schema.ts`
- Utilities: descriptive snake_case

### AI Brain Control System

**Every brain must have:**
1. Initialization function
2. Status monitoring
3. **Shutdown function**
4. **Restart/reboot function**
5. Orchestration hooks

**Template:**
```typescript
// /src/services/brains/[brain]_control.ts
export interface BrainControl {
  name: string;
  status: 'active' | 'paused' | 'shutdown';
  lastAction?: Date;
  shutdown: () => Promise<void>;
  restart: () => Promise<void>;
  getStatus: () => BrainStatus;
}

export const createBrainControl = (name: string): BrainControl => {
  return {
    name,
    status: 'active',
    shutdown: async () => { /* implementation */ },
    restart: async () => { /* implementation */ },
    getStatus: () => { /* implementation */ }
  };
};
```

### API Integration

**Structure:**
```typescript
// /src/utils/api-handlers/[api-name].ts
export interface ApiIntegration {
  name: string;
  authenticate: () => Promise<void>;
  call: (endpoint: string, params: any) => Promise<any>;
  shutdown?: () => Promise<void>;
}
```

### Database

- Use Prisma or TypeORM for migrations
- Seed database with user roles, initial configs
- Include backup procedures
- Document all table schemas

### Testing

- Unit tests for all services
- Integration tests for routers
- E2E tests for critical flows (trading, payments)
- Use Jest or Vitest

## Critical Requirements - Shutdown/Reboot System

**ALL AI brains and features MUST have:**
1. Individual shutdown switches
2. Individual restart switches
3. Status monitoring
4. Graceful shutdown (5s warning, save state)
5. Orchestration with Haley (owner control)

**Implementation checklist:**
- [ ] Haley orchestrator with override access (private)
- [ ] Individual brain controls accessible to authorized users
- [ ] Emergency stop feature (5s or immediate)
- [ ] Status dashboard showing all brain states
- [ ] Audit logging of all shutdown/restart events

## Your Custom APIs

**To add:**
[ADD YOUR API LIST HERE - you mentioned you were adding some]

Integration locations:
- `/src/utils/api-handlers/` for client implementations
- `/src/services/` for backend handlers
- Document in API_INTEGRATIONS.md

## Development Workflow

1. **Before coding:** Check if similar feature exists
2. **Always:** Use TypeScript strict mode
3. **Services:** Keep logic separate from UI
4. **Testing:** Write tests for critical paths
5. **Documentation:** Update schemas and routers
6. **Commits:** Reference feature name and brain/service responsible

## Common Tasks

### Add a New Hope Service
1. Create component in `/src/components/Hope`
2. Create service in `/src/services`
3. Create router in `/src/services/routers`
4. Create schema in `/src/services/schemas`
5. Add to navigation
6. Document in service registry

### Add AI Shutdown Control
1. Create control file: `[brain]_control.ts`
2. Implement BrainControl interface
3. Add to orchestration system
4. Add UI controls
5. Add to Haley orchestrator

### Integrate External API
1. Create handler in `/src/utils/api-handlers`
2. Implement ApiIntegration interface
3. Add authentication
4. Error handling with graceful fallback
5. Add to service registry

## Important Notes

- **Data Backup:** Always backup database before major changes
- **Rollback Protection:** Keep git history clean with meaningful commits
- **Owner Access:** Haley orchestrator has master control (private)
- **Security:** All brains isolated, only Haley bridges them
- **Monitoring:** Log all brain state changes
- **Performance:** Each brain runs independently, no blocking calls

## Resources

- Patent filed November 24, 2025 (56 tables, 12 brains, 50+ agents)
- Public launch: November 27, 2025
- Business: LLC (X AI CORE DEV) + Nonprofit (Hope Relief)
- Documentation: See XAICORE_COMPLETE_INVENTORY_DOCUMENTATION.md

---

**Last Updated:** January 2026  
**Version:** 1.0  
**Owner:** Ryan Patrick Burbage
