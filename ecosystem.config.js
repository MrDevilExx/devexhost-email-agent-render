// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'devexhost-agent',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'devexhost-scheduler',
      script: 'src/scheduler.js',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '0 0 * * *',
      env: {
        NODE_ENV: 'production',
      },
      log_file: 'logs/scheduler.log',
    },
  ],
};
