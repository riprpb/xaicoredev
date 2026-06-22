# XAICore API Integration Quick Start

**Quick reference for integrating your custom APIs with XAICore**

---

## 📋 Step 1: List Your APIs

Before you add APIs to the system, list them here:

### Your Custom APIs

**API #1:**
- Name: `[API Name]`
- Provider: `[Company/Service]`
- Base URL: `https://...`
- Authentication: `[api_key | oauth | jwt | bearer | basic]`
- Rate Limit: `[requests per minute]`
- Documentation: `[link]`

**API #2:**
- Name: `[API Name]`
- Provider: `[Company/Service]`
- Base URL: `https://...`
- Authentication: `[type]`
- Rate Limit: `[requests per minute]`
- Documentation: `[link]`

---

## 🔧 Step 2: Add API to Registry

Open `api_integration_hub.ts` and add your API to `API_REGISTRY`:

```typescript
export const API_REGISTRY: Record<string, ApiConfig> = {
  // ... existing APIs ...

  myNewApi: {
    name: 'My New API',
    description: 'What this API does',
    baseUrl: 'https://api.example.com/v1',
    authType: 'api_key',  // Change based on auth method
    timeout: 30000,        // milliseconds
    retryAttempts: 3,
    rateLimit: { 
      requestsPerMinute: 100,
      burst: 10 
    },
    endpoints: [
      {
        name: 'Get Users',
        method: 'GET',
        path: '/users',
        requiresAuth: true,
        rateLimit: 50,
        description: 'Retrieve list of users'
      },
      {
        name: 'Create User',
        method: 'POST',
        path: '/users',
        requiresAuth: true,
        description: 'Create a new user'
      },
      {
        name: 'Update User',
        method: 'PUT',
        path: '/users/{id}',
        requiresAuth: true,
        description: 'Update an existing user'
      },
      {
        name: 'Delete User',
        method: 'DELETE',
        path: '/users/{id}',
        requiresAuth: true,
        description: 'Delete a user'
      }
    ]
  }
};
```

---

## 🔐 Step 3: Register Credentials

At your server startup (typically in `main.ts` or `server.ts`):

```typescript
import { registerApiCredentials } from './api_integration_hub';

// Register your API credentials
registerApiCredentials({
  apiName: 'myNewApi',
  credentialType: 'api_key',
  secret: process.env.MY_NEW_API_KEY  // Store in .env file!
});

// For OAuth, store the token
registerApiCredentials({
  apiName: 'oauthApi',
  credentialType: 'oauth_token',
  secret: process.env.OAUTH_TOKEN,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  scopes: ['user:read', 'user:write']
});
```

### Environment Variables (.env)

```env
MY_NEW_API_KEY=your_api_key_here
OAUTH_TOKEN=your_oauth_token_here
ANOTHER_API_KEY=another_key_here
```

---

## 📝 Step 4: Create Service Functions

Create a service file in `/src/services/` to use your API:

**`src/services/myNewApi_service.ts`:**

```typescript
import { callApi } from '../api_integration_hub';

export class MyNewApiService {
  /**
   * Get all users
   */
  static async getUsers(params?: { skip?: number; limit?: number }) {
    return callApi('myNewApi', 'Get Users', params);
  }

  /**
   * Create a new user
   */
  static async createUser(userData: {
    name: string;
    email: string;
    role: string;
  }) {
    return callApi('myNewApi', 'Create User', userData);
  }

  /**
   * Update an existing user
   */
  static async updateUser(userId: string, updates: Partial<User>) {
    return callApi('myNewApi', 'Update User', {
      ...updates,
      id: userId
    });
  }

  /**
   * Delete a user
   */
  static async deleteUser(userId: string) {
    return callApi('myNewApi', 'Delete User', { id: userId });
  }
}
```

---

## 🔀 Step 5: Create tRPC Router

Add API endpoints to your tRPC router:

**`src/services/routers/myNewApi_router.ts`:**

```typescript
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { MyNewApiService } from '../myNewApi_service';

export const myNewApiRouter = router({
  /**
   * Get all users
   */
  getUsers: publicProcedure
    .input(z.object({
      skip: z.number().optional().default(0),
      limit: z.number().optional().default(50)
    }))
    .query(async ({ input }) => {
      try {
        const users = await MyNewApiService.getUsers({
          skip: input.skip,
          limit: input.limit
        });
        return { success: true, users };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }),

  /**
   * Create a user
   */
  createUser: publicProcedure
    .input(z.object({
      name: z.string(),
      email: z.string().email(),
      role: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const user = await MyNewApiService.createUser(input);
        return { success: true, user };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }),

  /**
   * Update a user
   */
  updateUser: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      try {
        const user = await MyNewApiService.updateUser(id, updates);
        return { success: true, user };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }),

  /**
   * Delete a user
   */
  deleteUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await MyNewApiService.deleteUser(input.id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    })
});
```

---

## 💻 Step 6: Use in React Components

```typescript
import { trpc } from './trpc-client';

function MyComponent() {
  // Query
  const { data: users, isLoading } = trpc.myNewApi.getUsers.useQuery({
    limit: 10
  });

  // Mutations
  const createUserMutation = trpc.myNewApi.createUser.useMutation({
    onSuccess: () => {
      console.log('User created!');
      // Refetch users
      queryClient.invalidateQueries({ 
        queryKey: [['myNewApi', 'getUsers']] 
      });
    }
  });

  return (
    <div>
      <h1>Users</h1>
      {isLoading && <p>Loading...</p>}
      <ul>
        {users?.users.map(user => (
          <li key={user.id}>{user.name} ({user.email})</li>
        ))}
      </ul>

      <button 
        onClick={() => createUserMutation.mutate({
          name: 'John Doe',
          email: 'john@example.com'
        })}
      >
        Add User
      </button>
    </div>
  );
}
```

---

## 🛡️ Error Handling

The API integration system handles:

✅ Rate limiting (automatic backoff)  
✅ Timeouts (configurable per API)  
✅ Network errors (automatic retry with exponential backoff)  
✅ Authentication failures  
✅ Invalid responses  

### Custom Error Handling

```typescript
try {
  const result = await callApi('myNewApi', 'Get Users');
  console.log('Success:', result);
} catch (error) {
  if (error.message.includes('Rate limit')) {
    console.log('Rate limited, backing off...');
  } else if (error.message.includes('Authentication')) {
    console.log('Check your API credentials');
  } else {
    console.error('API Error:', error.message);
  }
}
```

---

## 📊 Monitoring & Stats

Check API usage and statistics:

```typescript
import { apiManager } from './api_integration_hub';

// Get info for one API
const apiInfo = apiManager.getApiInfo('myNewApi');
console.log('API Name:', apiInfo.name);
console.log('Is Configured:', apiInfo.isConfigured);
console.log('Stats:', apiInfo.stats);

// Get info for all APIs
const allApis = apiManager.getAllApisInfo();
allApis.forEach(api => {
  console.log(`${api.name}: ${api.isConfigured ? '✓' : '✗'}`);
});
```

---

## 🔄 API Authentication Types

### API Key
```typescript
authType: 'api_key'
// Sends as: X-API-Key: your_key_here
```

### Bearer Token
```typescript
authType: 'bearer'
// Sends as: Authorization: Bearer your_token_here
```

### JWT
```typescript
authType: 'jwt'
// Sends as: Authorization: Bearer your_jwt_here
```

### Basic Auth
```typescript
authType: 'basic'
// Sends as: Authorization: Basic base64(username:password)
```

### OAuth
```typescript
authType: 'oauth'
// Requires refresh token flow
registerApiCredentials({
  apiName: 'oauthApi',
  credentialType: 'oauth_token',
  secret: process.env.OAUTH_ACCESS_TOKEN,
  expiresAt: expiryDate,
  scopes: ['scope1', 'scope2']
});
```

---

## 🚨 Common Issues

### Issue: Rate Limit Exceeded
**Solution**: Check `rateLimit` in API_REGISTRY, increase burst or implement queue

### Issue: Authentication Failed
**Solution**: Verify credentials in .env, check API documentation for correct auth type

### Issue: Timeout
**Solution**: Increase `timeout` value in API config, check network connectivity

### Issue: Invalid Response
**Solution**: Add response validation, check endpoint path, verify request parameters

---

## ✅ Checklist

- [ ] API added to `api_integration_hub.ts`
- [ ] Credentials stored in `.env` file
- [ ] Credentials registered at startup
- [ ] Service class created
- [ ] tRPC router created
- [ ] React component uses tRPC
- [ ] Error handling implemented
- [ ] API tested with real data
- [ ] Rate limiting configured
- [ ] Documentation updated

---

## 📚 Examples

### Real-World: Stripe Integration

```typescript
// Already in API_REGISTRY
stripe: {
  name: 'Stripe',
  baseUrl: 'https://api.stripe.com/v1',
  authType: 'bearer',
  endpoints: [...]
}

// Register at startup
registerApiCredentials({
  apiName: 'stripe',
  credentialType: 'bearer',
  secret: process.env.STRIPE_SECRET_KEY
});

// Use in service
const payment = await callApi('stripe', 'Create Payment Intent', {
  amount: 10000,
  currency: 'usd'
});
```

### Real-World: Custom Trading API

```typescript
// Add to API_REGISTRY
tradingApi: {
  name: 'My Trading API',
  baseUrl: 'https://trading.example.com/api',
  authType: 'api_key',
  endpoints: [
    {
      name: 'Place Order',
      method: 'POST',
      path: '/orders',
      requiresAuth: true
    }
  ]
}

// Register credentials
registerApiCredentials({
  apiName: 'tradingApi',
  credentialType: 'api_key',
  secret: process.env.TRADING_API_KEY
});

// Use in Trading Brain service
const order = await callApi('tradingApi', 'Place Order', {
  symbol: 'BTC/USD',
  quantity: 1,
  side: 'buy'
});
```

---

## 🎯 Next Steps

1. **List your APIs** in the section at top of this file
2. **Add each API** to `api_integration_hub.ts`
3. **Store credentials** in `.env` file
4. **Create services** for each API
5. **Create routers** for API endpoints
6. **Test thoroughly** before deployment
7. **Monitor usage** with built-in stats

---

**Ready to integrate your APIs?** Follow the 6-step process above!
