import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.VITE_TFNSW_API_KEY;
  const gtfsKey = env.VITE_TFNSW_GTFS_API_KEY || apiKey;
  const tripUpdatesKey = env.VITE_TFNSW_TRIP_UPDATES_API_KEY || gtfsKey;
  const vehiclePosKey = env.VITE_TFNSW_VEHICLE_POS_API_KEY || gtfsKey;

  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ['buffer', 'stream', 'util', 'process'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    server: {
      proxy: {
        '/api': {
          target: 'https://api.transport.nsw.gov.au',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const hasAuth = !!proxyReq.getHeader('Authorization');
              if (hasAuth) return;

              const url = req.url || '';
              let keyToUse = apiKey;
              
              if (url.includes('/v1/gtfs/realtime')) {
                // Trip Updates API
                keyToUse = tripUpdatesKey;
              } else if (url.includes('/v1/gtfs/vehiclepos')) {
                // Vehicle Position API
                keyToUse = vehiclePosKey;
              } else if (url.includes('/v1/gtfs')) {
                // Other GTFS endpoints
                keyToUse = gtfsKey;
              }
              
              if (keyToUse) {
                proxyReq.setHeader('Authorization', `apikey ${keyToUse}`);
              }
            });
          }
        }
      }
    }
  };
})
