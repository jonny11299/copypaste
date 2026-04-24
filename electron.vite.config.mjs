import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [svelte()],
    build: {
      rollupOptions: {
        input: {
          index:          'src/renderer/index.html',
          menu:           'src/renderer/menu.html',
          payloadtable:   'src/renderer/payloadtable.html',
          genericsqltable: 'src/renderer/genericsqltable.html',
        }
      }
    }
  }
})
