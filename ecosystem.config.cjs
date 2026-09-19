require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'skills4e',
      script: 'src/index.js',
      instances: parseInt(process.env.API_INSTANCES || '2', 10),
      exec_mode: 'cluster',
      kill_timeout: 35000,
      env: {
        NODE_ENV: 'production',
        RUN_QUEUE_WORKERS: 'false'
      }
    },
    {
      name: 'skills4e-worker',
      script: 'src/worker.js',
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 35000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
