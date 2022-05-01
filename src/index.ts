import * as fs from 'fs';
import { builtinModules } from 'module';
import type { Plugin, OnLoadArgs, OnLoadResult, Loader } from 'esbuild';

// Latest: https://deno.land/x/std/node
const DENO_STD_PATH = 'https://deno.land/std@0.137.0/node';
const getPolyfillPath = (name: string) => `${DENO_STD_PATH}/node/${name}.ts`;

const builtins = new RegExp(builtinModules.join('|'));

export const denoPlugin = (): Plugin => ({
  name: 'deno',
  setup({ onResolve, onLoad }) {
    onResolve({ filter: builtins }, () => ({ external: true })),
    onLoad({ filter: /\.(js|mjs|jsx|ts|tsx)$/ }, async (args: OnLoadArgs) => {
      const loader = args.path.match(/\.(\w+)$/)[1] as Loader;

      let code = await fs.promises.readFile(args.path, "utf-8");
      
      if(code.match(/\bprocess\b/)) {
          return {
              contents: `import processModule from "${getPolyfillPath('process')}";
              !globalThis.process && Object.defineProperty(globalThis, "process", {
                value: processModule,
                enumerable: false,
                writable: true,
                configurable: true,
              });` + code,
              loader,
          }
      }

      if(code.match(/\bglobal\b/)) {
          return {
              contents: `!globalThis.global && Object.defineProperty(globalThis, "global", {
                  value: globalThis,
                  writable: false,
                  enumerable: false,
                  configurable: true,
                });` + code,
              loader,
          }
      }

      if(code.match(/\bBuffer\b/)) {
          return {
              contents: `import { Buffer as bufferModule } from "${getPolyfillPath('buffer')}";
              !globalThis.Buffer && Object.defineProperty(globalThis, "Buffer", {
                value: bufferModule,
                enumerable: false,
                writable: true,
                configurable: true,
              });` + code,
              loader,
          }
      }

      if(code.match(/\b(setImmediate|clearImmediate)\b/)) {
          return {
              contents: `import _node_timers from "${getPolyfillPath('timers')}";
              !globalThis.setImmediate && Object.defineProperty(globalThis, "setImmediate", {
                value: _node_timers.setImmediate,
                enumerable: true,
                writable: true,
                configurable: true,
              });
              !globalThis.clearImmediate && Object.defineProperty(globalThis, "clearImmediate", {
                value: _node_timers.clearImmediate,
                enumerable: true,
                writable: true,
                configurable: true,
              });` + code,
              loader,
          }
      }

      if(code.match(/\b(__filename|__dirname)\b/g)) {
          code = code.replace(/\b(__filename|__dirname)\b/g, (_, m) => {
              return m === '__filename'
                ? `_deno_path.fromFileUrl(import.meta.url)`
                : `_deno_path.dirname(_deno_path.fromFileUrl(import.meta.url))`
          });

          return {
              contents: `import * as _deno_path from '${DENO_STD_PATH}/path/mod.ts';\n` + code,
              loader,
          }
      }

      return {
          contents: code,
          loader,
      } as OnLoadResult;
    });
  },
});
