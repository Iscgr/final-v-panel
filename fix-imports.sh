#!/bin/bash
find ./dist/server -type f -name "*.js" -print0 | while IFS= read -r -d $'\0' file; do
  sed -i "s/\.js\.js'/\.js'/g" "$file"
  sed -i "s/\.js\.js\"/\.js\"/g" "$file"
  sed -i "s|shared/schema\([\"']\)|shared/schema.js\1|g" "$file"
done
