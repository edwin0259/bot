const DubAPI = require('dubapi');
const YouTube = require('youtube-node');
const fs = require('fs');
const mysql = require("mysql");
const compArr = require('./composerArray.js');
const buildWeb = require('./buildWeb.js');
let baseCommands = {};
let mode = "normal";
let month = new Date().getMonth();

fs.readFile("./keys.json", "utf8", (err, data) => {
    let keys = JSON.parse(data);

    main(keys.youtubeKey, keys.dbPassword, keys.botPassword);
})

function fetchBaseCommands() {
    fs.readFile("./bot-commands/base.json", "utf8", (err, data) => {
        baseCommands = JSON.parse(data);
    })
}
fetchBaseCommands()


function updateMonthlyCommands() {
    fetchBaseCommands();

    
    fs.readFile("./monthlyCommands.json", "utf8", (err, data) => {
        let mCommands = JSON.parse(data);
        fs.readFile("./bot-commands/commands.json", "utf8", (err, c) => {
            //console.log(JSON.stringify(c));
            let commands = JSON.parse(c);
            mCommands.month = month;
            mCommands.commands = [];
            let commandKeys = Object.keys(commands);
            for(let i = 0; i < 2; i++) {

                random = Math.floor(Math.random() * commandKeys.length - 1);
                let commandKey = commandKeys[random];
                console.log(commandKey)
                let command = {}
                command[commandKey] = commands[commandKey];
                commandKeys.splice(random, 1);
                mCommands.commands.push(command);
            }

            fs.writeFile("./monthlyCommands.json", JSON.stringify(mCommands), err => console.log(err));
        })
            
        monthlyCommandString = "Commands of the month: ";
        mCommands.commands.forEach(obj => {
            if(Object.keys(obj).length != 0) {
                let key = Object.keys(obj)[0]
                baseCommands[key] = obj[key];
                monthlyCommandString += key.split("|").join(", ") + ", ";

            }
        })
    })
}


function main(youtubeKey, dbPassword, botPassword) {
    let YT = new YouTube();
    YT.setKey(youtubeKey);

    const connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: dbPassword,
        database: 'limitless',
        charset: 'utf8mb4_general_ci'
    })

    connection.connect();

    let un = 'maestroBot'

    new DubAPI({username: un, password: botPassword}, function(err, bot) {
        if (err) return console.error(err);

        console.log('Running DubAPI v' + bot.version);

        function connect() {bot.connect('limitless');}
        connect();

        let activeUsers = new Map;
        let connectionTime = new Date;
        bot.on('connected', function(name) {
            console.log('Connected to ' + name);
            setTimeout(shouldUpDub, 2000);
            bot.getUsers().forEach(user => {
                activeUsers.set(user.id, {name: user.username, time: new Date})
            })
        });

        bot.on('disconnected', function(name) {
            console.log('Disconnected from ' + name);
            setTimeout(connect, 15000);
        });

        bot.on('error', function(err) {
            console.error(err);
        });

        bot.on(bot.events.chatMessage, function(data) {
            if(data.user) {
                //console.log(data.user.username + ': ' + data.message);
                let message = data.message;
                let user = data.user.username;
                respondToMessage(message, user, data.raw.chatid);
            }
        });

        bot.on(bot.events.userJoin, (data) => {
            console.log(data.user.username + " has joined.");
            updateUser(data.user);
        })

        let totalGrabs = 0;
        bot.on(bot.events.roomPlaylistGrab, (data) => { 
            let djName = bot.getDJ().username;
            let grabbingUser = data.user.username;
            if(activeUsers.get(data.user.id)) {
                activeUsers.set(data.user.id, {name: data.user.username, time: new Date()})
            }
            console.log(djName + ' ' + grabbingUser);
            if(djName != grabbingUser) {
                totalGrabs += 1 
            }
        });

        // My functions
        let currentId; // Current Music id - Changes on each new video.
        let roullete = false;
        let entered = [];
        let songStats;
        
        /* shouldUpDub */
        /*  - If there is something being played and the bot has not regestered it before then the bot will updub the song. It will also send to chat a "Now Playing" message. It will then sent the currentId to this new songs id song it does not try to updub twice. It thens sets a timeout for the shouldUpDub function to be called again in 10 seconds.
            - If the song has already been registered then the shouldUpDub will be called again in 10 seconds via a setTimeout.
            - If no song is currently playing then first a 10 second timeout will call shouldUpDub with its only parameter called radio. If nothing has still not been queued after the 10 seconds then if the bot has it's radio mode enabled it will add to it's radio queue and start playing some music. It will also call shouldUpDub in a setTimeout as normal.
        */

        let currentSong = {};
        let currentDJ;
        
        function shouldUpDub() {
            if(bot.getMedia()) {
                let song = bot.getMedia();
                let {id, name, type, fkid} = bot.getMedia();
                
                if (currentId != id) {
                    if(currentId) {
                        updateSong(JSON.parse(JSON.stringify(currentSong)), JSON.parse(JSON.stringify(currentDJ)))
                    }
                    currentSong.id = id;
                    currentSong.name = name;
                    currentSong.type = type;
                    currentSong.fkid = fkid;
                    currentDJ = bot.getDJ();
                    if(!activeUsers.get(currentDJ.id)) {
                        activeUsers.set(currentDJ.id, {name: currentDJ.username, time: new Date})
                    };
                    
                    bot.updub();
                    currentId = id;

                    setTimeout(() => {shouldUpDub()}, +bot.getTimeRemaining());
                } else {
                    setTimeout(() => {shouldUpDub()}, +bot.getTimeRemaining());
                }
            } else {
                setTimeout(() => {shouldUpDub(true)}, 10000);
            }

            //if(new Date().getMonth() != month) {
                //month = new Date().getMonth();
                //updateMonthlyCommands();
                //bot.sendChat("Featured commands have been updated.");
            //}
        }

        function updateSong(songObj, djObj, callback=null) {
            let [djName, dj, djRole] = [djObj.username, djObj.id, djObj.role];
            let {id, name, type, fkid} = songObj;
            let tgs = totalGrabs;
            totalGrabs = 0;
            console.log(`ID: ${id}`)
            connection.query(`SELECT * FROM songs WHERE id="${id}"`, (err, res, fields) => {
                if(res.length != 0) {
                    plays = res[0].plays;
                    mostGrabs = (tgs > res[0].mostGrabs) ? tgs : res[0].mostGrabs;
                    
                    connection.query(`UPDATE songs SET plays=${plays + 1}, totalGrabs=${res[0].totalGrabs + tgs}, mostGrabs=${mostGrabs} WHERE id="${id}"`)
                } else {
                    plays = (callback != null) ? 0 : 1;
                    queryString = `INSERT INTO songs VALUES("${id}", ${plays}, ${tgs}, "${name.replace(/"/g, '\\"')}", "${type}", "${fkid}", ${tgs})`;
                    console.log(queryString);
                    connection.query(queryString)
                    if(callback != null) {
                        callback(id, false, true)
                    }
                }
            });
            // Add totalGrabs to user who played song
            connection.query(`SELECT * FROM users WHERE id="${djObj.id}"`, (err, res, fields) => {
                if(res.length != 0) {
                    if(tgs > 0) {
                        connection.query(`UPDATE users SET totalGrabs="${res[0].totalGrabs + tgs}" WHERE id="${djObj.id}"`);
                    }
                } else {
                    createUser(djObj);
                }
            })
        }

        let times = [3000000, 3600000, 2400000];
        let time = times[Math.floor(Math.random() * times.length)];
        setTimeout(() => { startRoullete() }, time);
        function startRoullete() {
            if(mode == "normal") {
                bot.sendChat("@maestroBot !r");
            }
            
            
            // random time
            time = times[Math.floor(Math.random() * times.length)];
            setTimeout(() => { startRoullete() }, time);
        }

        function createUser(usr, callback="") {
            console.log(usr)
            console.log("CREATING USER");
            let d = new Date();
            connection.query(`INSERT INTO users VALUES("${usr.id}", "${usr.username}", 0, 0, "${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}", "${usr.role || "null"}")`);
            if(callback) callback();
        }

        function updateUser(usr, callback="", optionalSet="") {
            console.log("UPDATING USER");
            connection.query(`SELECT * FROM users WHERE id="${usr.id}"`, (err, res, fields) => {
                if(res.length != 0) {
                    let d = new Date();
                    connection.query(`UPDATE users SET username="${usr.username}", lastSeen="${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}", role="${usr.role || "null"}" WHERE id="${usr.id}"`);
                } else {
                    if(callback) {
                        createUser(usr, () => callback());
                    } else {
                        createUser(usr);
                    }
                }
            });
        }

        function getUser(usr) {
            userCount((count) => {
                totalUsers = count;
            
                connection.query("SET @pos = 0;");
                connection.query(`SELECT * FROM (SELECT @pos := @pos + 1 as pos, id, username, wins, totalGrabs FROM users ORDER BY wins DESC) users WHERE id="${usr.id}";`, (err, res, fields) => {
                    if(res.length != 0) {
                        bot.sendChat(`*${usr.username}*`);
                        bot.sendChat(`\nWins: ${res[0].wins} (${res[0].pos}/${totalUsers})\nGrabs Received: ${res[0].totalGrabs}`);
                    } else {
                        updateUser(usr, () => getUser(user));
                    }
                });
            });
        }

        // callback function for external scripts
        function sendChat(message) {
            bot.sendChat(message);
        }

        function ping() {
            connection.query(`SELECT * FROM pings WHERE entity="maestro"`, (err, res, fields) => {
                bot.sendChat(`Ping: ${res[0].ping + 1}`);
                if(res.length != 0) connection.query(`UPDATE pings SET ping=${res[0].ping + 1} WHERE entity="maestro"`);
            });
        }

        function buildWebsite() {
            buildWeb.website(sendChat);
        }

        function exit() {
            
            bot.disconnect();

            process.exit();
        }

        function userCount(callback) {
            connection.query("SELECT COUNT(*) AS COUNT FROM users", (err, res, fields) => {
                callback(res[0].COUNT)
            })
        }

        function getStats(id, idSelected, updated=false) {
            let {currentId} = bot.getMedia();
            connection.query(`SELECT * FROM songs WHERE id="${id}"`, (err, res, fields) => {
                try {
                    if(res.length == 0 && !updated) {
                        bot.sendChat("_First time being played!_");
                        updateSong(JSON.parse(JSON.stringify(currentSong)), JSON.parse(JSON.stringify(currentDJ)), getStats)
                    } else {
                        bot.sendChat(res[0].name);
                        plays = (idSelected) ? res[0].plays : res[0].plays + 1;
                        try {
                            bot.sendChat(`Total grabs: ${res[0].totalGrabs + totalGrabs}, Times played: ${plays}`)
                        } catch(err) {
                            bot.sendChat(`song stats: total grabs - ${res[0].totalGrabs}, times played: - ${plays}.`)
                        }
                    }
                } catch(err) {
                    bot.sendChat("Song was not found.");
                }
            });
        }
        
        function respondToMessage(message, user, cid) {
            let bot_response = false;
            let userInfo = bot.getUserByName(user);
            activeUsers.set(userInfo.id, {name: user, time: new Date()})
            function checkMessage(command) {
                if(message.includes(command) && message.includes(`@${un}`) && bot_response == false && (user == "edwin0259" || user == "maestroBot")) {
                    return true;
                } 
                return false;
            }

            if(message.includes("!mode") && approveUser(user) && message.split(' ').length == 2) {
                if(message.split(' ')[1] == "silent") {
                    bot.sendChat("Going into silent mode. `!mode normal` to return to normal mode.")
                    mode = "silent";
                } else if(message.split(' ')[1] == "normal") {
                    bot.sendChat("Returning to normal mode.")
                    mode = "normal";
                }
            }

            if(mode == "silent") {
                return true; // Just return, do not proccess anything, silent mode
            }

            if(message == "!count" && user == "edwin0259") {
                connection.query("SELECT COUNT(*) AS COUNT FROM songs", (err, res, fields) => {
                    console.log(res[0].COUNT)
                    bot.sendChat(JSON.stringify(res[0].COUNT));
                })
            }

            if(message.includes("!stats") && user != "maestroBot") {
                let {id, name, type, fkid} = bot.getMedia();

                idSelected = false;
                if(message.includes("id")) {
                    message = message.split(' ');
                    id = message[message.length - 1];
                    idSelected = true;
                }

                //bot.sendChat(`ID: ${id}`);

                getStats(id, idSelected);
            }

            if(message.includes("!clone") && user == "edwin0259") {
                //bot.sendChat("Cloning...")
                console.log("!clone");
                console.log("CLONING")
            }

            if(message.includes("!ping") && user == "edwin0259") {
                ping();
            }

            if(message == "!refresh" && approveUser(user)) {
                bot.sendChat("Refreshing, brb :wave:");
                setTimeout(exit, 5000);
            }
            if(message == "!build" && approveUser(user)) {
                bot.sendChat("Building Website..");
                console.log(`BUILDING WEBSITE, TRIGGERED BY: ${user}`)
                setTimeout(buildWebsite, 10000);
            }
            if(message == "!exit" && user == "edwin0259") {
                bot.sendChat("Disconnecting, goodbye.");
                setTimeout(exit, 5000);
            }

            if(message == "!limbo" && user == "edwin0259") {
                bot.sendChat(":dancer:")
                bot.disconnect();
            }
            
            if(message == "!topgrabbed") {
                bot.sendChat('Most grabbed songs (total grabs):');
                connection.query(`SELECT * FROM songs ORDER BY totalGrabs DESC LIMIT 3`, (err, res, fields) => {
                    try {
                        console.log(res)
                        res.forEach(item => {
                            bot.sendChat(`${item.name} - ${item.totalGrabs}`);
                        })
                    } catch(err) {
                        console.log(err);
                    }
                });
            }
            
            

            if(message == "!hotplays") {
                bot.sendChat('Most grabbed songs (single play):');
                connection.query(`SELECT * FROM songs ORDER BY mostGrabs DESC LIMIT 3`, (err, res, fields) => {
                    try {
                        console.log(res)
                        res.forEach(item => {
                            bot.sendChat(`${item.name} - ${item.mostGrabs}`);
                        })
                    } catch(err) {
                        console.log(err);
                    }
                });
            }

            // Get info of another user, causes error if just !info for me..
            //if(message.includes("!info") && user == "edwin0259") {
            //    let usr = bot.getUserByName(message.split(' ')[1]);
            //    getUser(usr);
            //}

            if(message == "!info") {
                let queryUser = user;
                let usr = bot.getUserByName(queryUser);
                
                getUser(usr);
            }

            if(message == "!issue" || message == "!suggestion") {
                bot.sendChat("You may submit command suggestions and issues here lol https://github.com/edwin0259/bot-commands");
            }
            
            if(message == "!mostplayed") {
                bot.sendChat('Most played songs:');
                connection.query(`SELECT * FROM songs ORDER BY plays DESC LIMIT 3`, (err, res, fields) => {
                    try {
                        console.log(res)
                        res.forEach(item => {
                            bot.sendChat(`${item.name} - ${item.plays}`);
                        })
                    } catch(err) {
                        console.log(err);
                    }
                });
            }

            if(message == "!winners") {
                connection.query(`SELECT * FROM users ORDER BY wins DESC LIMIT 3`, (err, res, fields) => {
                    if(res.length != 0) {
                        bot.sendChat("Users with the most wins:");
                        res.forEach(user => {
                            bot.sendChat(`${user.username} - ${user.wins}`);
                        })
                    } else {
                        bot.sendChat("I was unable to fetch the winners :(");
                    }
                })
            }

            if(checkMessage("!r")) {
                roullete = true;
                bot.sendChat("@djs The roulette is starting! Have a song queued and type anything in chat to enter the roulette!");
                
                setTimeout(endRoulette, 60000);
            }

            function approveUser(u) {
                return bot.hasPermission(bot.getUserByName(u), "ban");
            }

            function approveManagerPlus(u) {
                return bot.hasPermission(bot.getUserByName(u), 'set-roles');
            }

            function monthDiff(d1, d2) {
                var months;
                months = (d2.getFullYear() - d1.getFullYear()) * 12;
                months -= d1.getMonth() + 1;
                months += d2.getMonth();
                return months <= 0 ? 0 : months;
            }

            function endRoulette() {
                let n = Math.floor(Math.random() * entered.length);
                let position = Math.floor(Math.random() * 3);
                let users = bot.getQueue().reduce((obj, item) => {
                    obj[item.user.username] = item.user.id;
                    return obj;
                },[]);
                let winner = entered[n];
                if(winner != undefined) {
                    bot.sendChat(`@${winner} wins.`);
                    if(users[winner] == undefined) {
                        entered.splice(n, 1);
                        bot.sendChat('User has left queue, trying again.')
                        setTimeout(endRoulette, 10000);
                    } else if(bot.getUserByName(winner)) {
                        usr = bot.getUserByName(winner);
                        //let role = bot.getUserByName(winner).role
                        connection.query(`SELECT * FROM users WHERE id="${usr.id}";`, (err, res, fields) => {
                            if(res.length != 0) {
                                user = res[0];
                                let d = new Date();
                                connection.query(`UPDATE users SET wins=${user.wins + 1}, username="${winner}", lastSeen="${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}", role="${usr.role || "null"}" WHERE id="${usr.id}"`)
                                console.log("WINNER: " + winner);
                            } else {
                                createUser(usr);
                            }
                        })
                       
                        bot.sendChat(`Moving ${winner} to position 1`);
                        bot.moderateMoveDJ(users[entered[n]], 0);
                        entered = [];
                        roullete = false;
                    } else {
                        entered.splice(n, 1);
                        bot.sendChat('User not found, trying again.')
                        setTimeout(endRoulette, 10000);
                    }
                } else {
                    bot.sendChat('Looks like no one wins.');
                    entered = [];
                    roullete = false;
                }
            }
            
            if(roullete) {
                let queuedUsers = bot.getQueue().reduce((arr, item) => {
                    arr.push(item.user.username);
                    return arr;
                },[]);
                if(user != "maestroBot" && message && !entered.includes(user)) {
                    if(queuedUsers.includes(user)) {
                        entered.push(user);
                        entered = [...new Set(entered)];
                    }
                }
            }
            
            // !cq stands for clear queue, this will clear the bots queue.
            if(checkMessage )
            if(checkMessage("!cq")){
                console.log(`cleared by ${user}`);
                
                bot.pauseQueue(true, () => {
                    bot.clearQueue();
                });
                fs.writeFile('songsQueued.txt','',(err) => {if(err) console.log(err) })
                bot_response = true;
            }

            if(message.includes("!afk") && message.split(' ').length == 2 && message.split(' ')[0] == "!afk" && (approveUser(user) || user == "edwin0259")) {
                let hours = message.split(' ')[1];
                if(hours == +hours) {
                    let users = [];
                    let afkUsers = [];
                    let userKeys = [...activeUsers.keys()];
                    let lastConnected = ((new Date - connectionTime) / 1000) / 3600;

                    let queuedUsers = bot.getQueue().reduce((arr, x) => {
                        arr.push(x.user.id);
                        return arr;
                    },[]);
                    
                    userKeys.filter((x,i) => {
                        if(!queuedUsers.includes(x)) {
                            activeUsers.delete(x);
                            return;
                        } else {
                            return x;
                        }
                    });
                    
                    let names = activeUsers.forEach(u => {
                        let afkTime = (new Date - u.time) / 1000;
                        if(afkTime > (3600 * hours)) {
                            afkUsers.push(u.name);
                        }
                    });
                    
                    bot.openPM(bot.getUserByName(user).id,(data) => {
                        bot.sendPM(data.id, `Users that have been afk for the last ${hours} hours: \n${afkUsers.join(",\n")}\n . Bot joined ${lastConnected} hours ago.`);
                    })
                } else {
                    bot.sendChat("Hours are not a number.")
                }
            }

            if(message.includes("!removerole") && (approveManagerPlus(user) || user == "edwin0259")) {
                let queryUser = message.split(' ')[1];
                connection.query(`SELECT * FROM users WHERE username="${queryUser}";`, (err, res, fields) => {
                    if(res.length != 0) {
                        connection.query(`UPDATE users SET role="null" WHERE username="${queryUser}"`);
                        bot.sendChat(`Set role for ${queryUser} to null`);
                    } else {
                        bot.sendChat("User not found.");
                    }
                })
            }

            if(message.includes("!lastseenlist") && approveUser(user)) {
                let months = message.split(' ')[1];
                let usersFound = [];
                connection.query(`SELECT * FROM users WHERE role LIKE "5%";`, (err, res, fields) => {
                    if(res.length != 0) {
                        res.forEach(u => {
                            let diff = monthDiff(new Date(u.lastSeen), new Date());
                            if(diff >= months) {
                                usersFound.push(u.username);
                            }
                        })
                    }

                    if(!usersFound.length) {
                        bot.sendChat("No users found.");
                    } else {
                        bot.openPM(bot.getUserByName(user).id, data => bot.sendPM(data.id, `Found ${usersFound.length} users (Out of ${res.length} staff members): \n${usersFound.join("\n, ")}`));
                    }
                })
            }

            if(message.includes("!lastseen") && message.split(' ').length == 2 && message.split(' ')[0] == "!lastseen" && approveUser(user)) {
                let queryUser = message.split(' ')[1];
                let mes = "";
                connection.query(`SELECT * FROM users WHERE username="${queryUser}";`, (err, res, fields) => {
                    if(res.length != 0) {
                        res.forEach(u => {
                            date = new Date(u.lastSeen);
                            mes += `${u.username} was last seen ${
                                    date.getFullYear().toString() + "-" + (date.getMonth()+1).toString() + "-" + date.getDate().toString()}, `
                        })
                    }

                    bot.openPM(bot.getUserByName(user).id, data => bot.sendPM(data.id, `Found ${res.length} users: ` + mes));
                })
            }
            
            if(message == "!afk") {
                bot.sendChat("You need to specify # of hours after afk.");
            }

            if(message.includes("!afk") && message.split(' ').length == 2 && message.split(' ')[0] == "!afk" && !approveUser(user) && user != "edwin0259") {
                bot.sendChat("Not authorized");
            }

            if(message == "!lastseen") {
                bot.sendChat("You need to specify a username after lastseen.");
            }

            if(checkMessage("!qs")) {
                fs.readFile('./tempStats.json',"utf8", (err, data) => {
                    let stats = JSON.parse(data);
                    let songKey = Object.keys(stats)[Math.floor(Math.random() * Object.keys(stats).length)];
                    if(stats[songKey].type == "youtube") {
                        bot.queueMedia('youtube', stats[songKey].fkid);
                        bot.pauseQueue(false);
                    } else {
                        bot.sendChat("Could not queue.");
                    }
                })
            }
            // !qr stands for queue related.
            if(checkMessage("!qr")) {
                let id = bot.getMedia().fkid;
                YT.related(id, 5, function(error, result) { 
                    if (error) throw error;
                
                    let video = result;
                    //fileVideos(video);
                    video.items.forEach(vid => {
                        if(vid.id.videoId != undefined) {
                            let vID = vid.id.videoId.toString();
                            var vName = vid.snippet.title.toString();
                            bot.queueMedia('youtube', vID);
                            fs.appendFile("songsQueued.txt", vID + " name: " + vName + '\n' , (err) => {
                                if(err){
                                    console.log(err);
                                }
                            });
                        }
                    });
                });
                bot.pauseQueue(false);
                bot_response = true;
            }


            // Base commands
            if(message[0] == "!") {
                foundCommand = false;
                commandMessage = undefined;
                for(let key in baseCommands) {
                    if(foundCommand) {
                        // nothin
                    } else if(key.split("|").includes(message.slice(1))) {
                        commandMessage = baseCommands[key]
                        foundCommand = true;
                    }
                }
                
                if(commandMessage) {
                    if(typeof commandMessage == "object") {
                        random = Math.floor(Math.random() * commandMessage.length - 1);
                        bot.sendChat(commandMessage[random]);
                    } else {
                        bot.sendChat(commandMessage);
                    }
                } 
            }
            
            if(message == "!sign") {
                fs.appendFile("guestbook.txt", `${user} - ${new Date}\n`, () => {
                    bot.sendChat(`Thankyou for signing the guestbook, ${user}!`);
                })
            }
            
        }
    });
}
