#!/bin/sh
#!/bin/sh
while true;
do
cd C:\projects\bot
echo "{\"date\": \"$(date)\"}" >| date.json
git add -A 
git commit -m "update stats"
echo "Pushing.."
git push https://github.com/edwin0259/bot.git;
sleep 3600;
done;
