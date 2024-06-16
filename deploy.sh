
git fetch
git pull

# Download dependencies
npm ci

# Restart app
pm2 restart ecosystem.config.json