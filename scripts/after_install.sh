#!/bin/bash
echo 'run after_install.sh: ' >> /home/ec2-user/backtrack-backend/deploy.log

echo 'cd /home/ec2-user/backtrack-backend' >> /home/ec2-user/backtrack-backend/deploy.log
cd /home/ec2-user/backtrack-backend >> /home/ec2-user/backtrack-backend/deploy.log

echo 'npm install' >> /home/ec2-user/backtrack-backend/deploy.log
npm install >> /home/ec2-user/backtrack-backend/deploy.log

echo 'npm run build' >> /home/ec2-user/backtrack-backend/deploy.log
npm run build >> /home/ec2-user/backtrack-backend/deploy.log
