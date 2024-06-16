log "Pulling the latest changes from the Git repository"

git fetch
git pull

# Download dependencies
log "Download dependencies"
npm ci


# Restart app
pm2 restart ecosystem.config.json
log "Deployment successful"