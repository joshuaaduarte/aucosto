#!/usr/bin/env sh
# Installs the git pre-push hook that type-checks the project before every push.
# Run once after cloning: `npm run setup-hooks`.
# The hook runs `prisma generate && tsc --noEmit` and blocks the push on any type error,
# preventing bad deploys from ever reaching Vercel.

HOOK=".git/hooks/pre-push"
cat > "$HOOK" << 'EOF'
#!/usr/bin/env sh
echo "⏳ Running prisma generate..."
npx prisma generate --silent
echo "⏳ Type-checking..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ Type errors found. Fix them before pushing."
  exit 1
fi
echo "✅ Type check passed."
EOF
chmod +x "$HOOK"
echo "✅ pre-push hook installed."
