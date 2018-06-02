let spawn = require('child_process').spawn;
let bot;

// Holds one "INSERT" which is received through bot output. Every 30 mins setTimeout will remove the INSERT
// If no insert (the length of limboCheck is 0) restart bot
// If INSERT is received and there is already one in the limboCheck, do nothing.
let limbo = ["ID"];
let limboCount = 5; // might be needed, if 5 limbos, terminate script just to be safe.

live();
limboCheck();
function live() {
  bot = spawn('node', ['bot.js']);

  bot.stdout.on('data', data => {
    console.log(`${data}`);
    if(data.includes("ID")) {
      limbo[0] = "ID";
      console.log(limbo);
    }
  });

  bot.stderr.on('data', data => {
    console.log(`stderr: ${data}`);
  });

  bot.on('error', err => console.log(`err: ${err}`));
  bot.on('close', function(code) {
    console.log(`CLOSED: ${code}, restarting..`);
    bot.stdin.end();
    bot.kill();
    delete(bot);
    setTimeout(live, 60000);
  });
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
