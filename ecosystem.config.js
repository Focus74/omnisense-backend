module.exports = {
  apps: [
    {
      name: "omnisense-api",
      script: "src/server.js",
      cwd: "D:/omnisense-backend",
      exec_mode: "fork",      // ⬅️ บังคับ fork mode
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 20,
      env: { NODE_ENV: "production" },
      error_file: "D:/omnisense-backend/logs/pm2-error.log",
      out_file:   "D:/omnisense-backend/logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
