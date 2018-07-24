let spawn = require('child_process').spawn;
let exec = require('child_process').exec;
let kill = require('tree-kill');
let bot;

// Holds one "INSERT" which is received through bot output. Every 30 mins setTimeout will remove the INSERT
// If no insert (the length of limboCheck is 0) restart bot
// If INSERT is received and there is already one in the limboCheck, do nothing.
let limbo = ["ID"];
let limboCount = 5; // might be needed, if 5 limbos, terminate script just to be safe.
let botCount
live();
limboCheck();
function live() {
  exec("tasklist | grep -c node.exe", (err, stdout, stderr) => {
    if(stderr) return
    console.log(`Bot count is: ${stdout}`);
    botCount = stdout;
    if(botCount >= 2) {
      console.log(`BOT COUNT IS ${botCount}`);
      return;
    } else {
      initLive();
    }
  })

  function initLive() {
    bot = spawn('node', ['bot.js']);
    console.log(`PID: ${bot.pid}`);
    botRunning = true; 
    bot.stdout.on('data', data => {
      console.log(`${data}`);
      if(data.includes("ID")) {
        limbo[0] = "ID";
        console.log(limbo);
      }

      if(data.includes("!clone")) {
        console.log("Cloning");
        live();
      }
    });

    bot.stderr.on('data', data => {
      console.log(`stderr: ${data}`);
    });

    bot.on('error', err => console.log(`err: ${err}`));
    bot.on('close', function(code) {
      console.log(`CLOSED: ${code}, restarting..`);
      bot.stdin.end();
      kill(bot.pid)
      console.log(`CLOSING PID: ${bot.pid}`)
      delete(bot);
      setTimeout(live, 10000);
    });
  }
}

function limboCheck() {
  console.log("Checking limbo..");
  if(limbo.length == 0) {
    console.log("LIMBO, restarting");
    bot.stdin.end();
    bot.kill();
    delete(bot);
    setTimeout(live, 60000);
  } else {
    limbo.pop();
  }

  setTimeout(limboCheck, 1800000);
}
