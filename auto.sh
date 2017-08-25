#!/bin/sh
cd C:\projects\bot
git add -A 
git commit -m "update stats"
echo "Pushing.."
git push https://github.com/edwin0259/bot.git
read