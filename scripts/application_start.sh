#!/bin/bash

echo 'run application_start.sh: ' >> /home/ec2-user/backtrack-backend/deploy.log

echo 'pm2 restart backtrack-backend --update-env' >> /home/ec2-user/backtrack-backend/deploy.log
pm2 restart backtrack-backend --update-env >> /home/ec2-user/backtrack-backend/deploy.log
