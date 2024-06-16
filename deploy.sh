# Download dependencies
log "Download dependencies"
npm ci

# Restart app
pm2 restart ecosystem.config.json
log "Deployment successful"