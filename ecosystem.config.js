module.exports = {
  apps: [{
    name: 'frontol-server',
    script: 'build/index.js',
    cwd: 'C:\\www\\frontol_server',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'C:\\www\\frontol_server\\logs\\error.log',
    out_file: 'C:\\www\\frontol_server\\logs\\output.log',
    merge_logs: true,
    max_size: '10M'
  }]
};
