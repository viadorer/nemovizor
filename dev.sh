#!/bin/bash
export PATH="/Users/davidchoc/.nvm/versions/node/v22.22.1/bin:$PATH"
cd "/Users/davidchoc/Downloads/Cascade/Nemovizor offline/nemovizor-mvp"
exec node node_modules/.bin/next dev --hostname 127.0.0.1 --port "${PORT:-3001}"
