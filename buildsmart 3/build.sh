#!/bin/bash
set -e
cd /home/claude/buildsmart
NODE_PATH=/opt/npm-tools/node_modules /opt/npm-tools/node_modules/.bin/esbuild src/App.tsx --bundle --minify --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=dist/app.js --log-level=warning
python3 - <<'PY'
t=open('/home/claude/buildsmart/index.template.html').read()
js=open('/home/claude/buildsmart/dist/app.js').read().replace('</script','<\\/script')
open('/home/claude/buildsmart/dist/index.html','w').write(t.replace('/*__BUNDLE__*/',js))
import os; print('built', os.path.getsize('/home/claude/buildsmart/dist/index.html')//1024, 'KB')
PY
