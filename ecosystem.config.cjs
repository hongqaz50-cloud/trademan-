module.exports = {
  apps: [
    {
      name: 'ap-efficiency-bot',
      script: 'npm',
      args: 'run bot',
      restart_delay: 5000,
      max_restarts: 50,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
