import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Injecte l'empreinte du bundle dans le service worker.
 *
 * `public/sw.js` est copié tel quel : il ne passe pas par le bundler et ne porte
 * donc aucun hash. Son nom de cache restait figé d'un déploiement à l'autre, si
 * bien que le handler `activate` — qui ne supprime que les caches au nom
 * différent — ne purgeait jamais rien. Un `index.html` périmé pouvait survivre
 * et réclamer des assets supprimés depuis : écran blanc.
 *
 * On reprend le hash de l'entrée JS, qui est calculé sur le contenu : une
 * reconstruction sans changement garde le même identifiant et n'invalide pas
 * le cache pour rien.
 */
function serviceWorkerBuildId() {
  let buildId = 'dev'
  let outDir = 'dist'
  // Renseigné par `configResolved`, qui s'exécute toujours avant `closeBundle`.
  let root = '.'

  return {
    name: 'lvlrise-sw-build-id',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = config.build.outDir
    },
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry)
      const hash = entry && entry.fileName.match(/-([A-Za-z0-9_-]+)\.js$/)
      if (hash) buildId = hash[1]
    },
    closeBundle() {
      const swPath = path.resolve(root, outDir, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const source = fs.readFileSync(swPath, 'utf8')
      fs.writeFileSync(swPath, source.replaceAll('__BUILD_ID__', buildId))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), serviceWorkerBuildId()],
})
