import dotenv from 'dotenv'
import { getServerConfig } from './config/environment.ts'
import { createApp } from './server/app.ts'

dotenv.config({ path: '.env.local' })

const config = getServerConfig()
const app = createApp(config)

app.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'server.started',
      host: config.host,
      port: config.port,
      environment: config.environment,
      timestamp: new Date().toISOString(),
    }),
  )
})

export default app
