const DubAPI = require('dubapi');
const YouTube = require('youtube-node');
const fs = require('fs');
const mysql = require("mysql");
const compArr = require('./composerArray.js');
let baseCommands = {};
fs.readFile("./keys.json", "utf8", (err, data) => {
    let keys = JSON.parse(data);

    main(keys.youtubeKey, keys.dbPassword, keys.botPassword);
})

fs.readFile("./bot-commands/base.json", "utf8", (err, data) => {
    baseCommands = JSON.parse(data);
})

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
            updateUser(data.user.username, () => {});
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
        //let blacklistingUser = "";
        
        function shouldUpDub() {
            if(bot.getMedia()) {
                //blacklistingUser = "";
                let song = bot.getMedia();
                let {id, name, type, fkid} = bot.getMedia();
                
                if (currentId != id) {
                    console.log("NEW SONG")
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
                    
                    tgs += res[0].totalGrabs;
                    connection.query(`UPDATE songs SET plays=${plays + 1}, totalGrabs=${tgs}, mostGrabs=${mostGrabs} WHERE id="${id}"`)
                } else {
                    queryString = `INSERT INTO songs VALUES("${id}", 0, ${tgs}, "${name.replace(/"/g, '\\"')}", "${type}", "${fkid}", ${tgs})`;
                    console.log(queryString);
                    connection.query(queryString)
                    if(callback != null) {
                        callback(id, false, true)
                    }
                }
            });
            
        }

        let times = [3000000, 3600000, 2400000];
        let time = times[Math.floor(Math.random() * times.length)];
        setTimeout(() => { startRoullete() }, time);
        function startRoullete() {
            bot.sendChat("@maestroBot !r");
            // random time
            time = times[Math.floor(Math.random() * times.length)];
            setTimeout(() => { startRoullete() }, time);
        }

        function updateUser(user, callback) {
            let uid = bot.getUserByName(user).id;
            let role = bot.getUserByName(user).role
            fs.readFile('./users.json',"utf8", (err, data) => {
                let stats = JSON.parse(data);
                stats[uid] = stats[uid] || {"wins": 0, "username": user};
                if(typeof stats[uid].username == "undefined" || stats[uid].username != user) {
                    stats[uid].username = user;
                }
                stats[uid].lastSeen = new Date;
                stats[uid].role = role || "null"
                fs.writeFile('./users.json', JSON.stringify(stats), (err) => {
                    if(err) throw err;
                    callback();
                })
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

            if(message == "!info") {
                let queryUser = user;
                //bot.sendChat('This feature is still experimental.')
                fs.readFile('./users.json',"utf8", (err, data) => {
                    let users = JSON.parse(data);
                    let usernames = {};
                    let usr = bot.getUserByName(queryUser);
                    // If user is found and id is not found in users file.
                    let sortedWins = Object.keys(users).sort((a, b) => {
                        return users[b].wins - users[a].wins
                    })
                    if(usr && !users[usr.id]) {
                        updateUser(queryUser, () => {
                            bot.sendChat('You have just been added to users, try again.');
                        })
                    } else if (users[usr.id]) {
                        let userInFile = users[usr.id];
                        bot.sendChat(`User: ${queryUser}`);
                        bot.sendChat(`Wins: ${userInFile.wins} (${sortedWins.indexOf(usr.id) + 1}/${sortedWins.length})`);
                        if(userInFile.totalGrabs != undefined) {
                            bot.sendChat(`Grabs Received: ${userInFile.totalGrabs}`);
                        }
                    } else {
                        bot.sendChat('User is not registered.');
                    }
                });
            }
            
            if(message == "!commands" || message == "!help") {
                bot.sendChat("Commands are: !stats, !sign, !mostplayed, !topgrabbed, !hotplays, !winners, !info, !afk, !lastseen, !suggestion, !issue");
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
                fs.readFile('./users.json',"utf8", (err, data) => {
                    let stats = JSON.parse(data);
                    let topPlayerKeys = Object.keys(stats).sort((a, b) => {
                        return stats[b].wins - stats[a].wins
                    })
                    bot.sendChat('Users with the most wins:');
                    for(let x = 0; x < 3; x++) {
                        if(topPlayerKeys[x]) {
                            bot.sendChat(`${stats[topPlayerKeys[x]].username} - ${stats[topPlayerKeys[x]].wins}`);
                        }
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
                        let uid = bot.getUserByName(winner).id;
                        let role = bot.getUserByName(winner).role
                        fs.readFile('./users.json',"utf8", (err, data) => {
                            let users = JSON.parse(data);
                            users[uid] = users[uid] || {};
                            users[uid].wins = users[uid].wins + 1 || 1;
                            users[uid].role = role || "null";
                            if(!users[uid].username || users[uid].username != winner) {
                                users[uid].username = winner;
                                console.log(users[uid].username);
                            }

                            bot.getUsers().reduce((arr, user) => {
                                arr.push(user.id);
                                return arr;
                            }, []).forEach(u => {
                                if(users[u]) {
                                    users[u].lastSeen = new Date;
                                }
                            })

                            fs.writeFile('./users.json', JSON.stringify(users), (err) => {
                                if(err) throw err;
                            })
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

            if(message.includes("!lastseenlist") && message.split(' ')[0] == "!lastseenlist" && (approveUser(user) || user == "edwin0259")) {

            }

            if(message.includes("!lastseenlist") && approveUser(user)) {
                let staff = ["iotadart","kessu","sheena1990","aldersees","sharp","alise","Swivy","Kyuto","theinfinite","Inspector420","FruitKake","DUSTY_MCDUSENBERG","Neoblackguard","spanky","DracusApollyonPhoenix","maestroBot","DJRevenant - C","DJRevenant - C","DJRevenant - C","flat","the1xman","MarianCavlovic","Mozzle","bimmyohara","solstitialcold","Syntheract","ANDREW_S","fru","lia","Puffin","esoteric","tripster","AdvaGoldfreind","Monstah","LiuseRooney","Yung_Kanax","Eleftheria","Ganjaman","Rayadito","tay.justine","Giupatamon","grendel462","HowCanINotHentai","DB-Cooper","Darkiss","LOISTAVA","Reforced","Zuzana","queenofthekittys","TanyaOgr","Zerro","TAYLORR","UnitedHell","Citramon","Yurei","playjoyx","noaltcodessadface","KannibleKlown","cloudysierra","314ro","skippy01","Risblood","Lili","lashundra","SeaCucumber","dp","davd2017","funkynoiz","inthefade","ZennaTiffany","slyconrad","ibi","Kurotsuno","domshoe","epicnate98","testiculartorsion","Kaebsong","Riyuuta","Clifford","Sharonne","hadone","fork","Nieknuggets","grimmusic","arontjuh","TheBiggestBoss","platypus","Teamp","GXLLX","AspirationDeath","Akiruru","Dionisio","Nibzy","ferzrrn","Grimantis","djarkanoid","trunkbass","misaki","1029chrisB","EMPTYCage","HappyHarold","Denski","wwaavvyy","ufuksarp","tewcurll","bubu2bubu","visualkitten","hellcat","_brandon_","sirpansylot","lCookiesl","Papapoof","pmys","seanmcswiggan","RidingSerena","TwelveShillings","30thCenturyMan","its_david_again","dday694","HerrZafft","Mousecel","Herbie","moistcarrot","Aslin","joshlmao","latadelixo","PotatoBread23","J3THUsoldier","Here2fukuupm8","NotJuan","TheDirtyRomancer","Tooqie1","puggarooreid","ZarUnity","Timberg","LUGUBRIOUS","Ukam","shiltoner","TheDoctorPandass","Anonononon","IxVingPk","sleeping_moose","Asllani","DarthNihilus","farnmut","Aphelion","Sextans","SierraBeach","qwre9","Crimsonze","ItsMeJunior","Stickstack","pastorkoala_mmango","Spectres","LifeSav3r","LordDilip","0ceanMan","Azatha","GandalfTheMetal","Pulltheleverkronk2266","Adylas","Mordecaii","thomascookiehead","Violator","HellcatHijinx","nuit","Josh_15","Atrocity_","isChachi","hydroknight","RaFaXfLaSh","Music","ThePinkMoon","SaikaTotsuka","GabrielG.N","orangicle","Moonrasor","Mirindiba","genderAss00mer","zero_ataraxia","ayylmao_damen","TacticalTracer","doodlewang","SCOOPS","Angkasawan","King_Satanas_Holokaustos","PsychoGoat","nightowlsociety","HiBEARnation","lurd","GotShrimpBoi","EFoE","Mario_bro","Doniel","FraggleRock","Johrm","sonicstaff","Sweet__Leaf","JosephineLee","koiebee","ZafkiElohim","FuzzyFoofi","mystem","wowoopwoopwo","ciri","MaxChandeliers","nonvoyezme","Samsus","spasticbutterfree","poent","JoJosfanboy","ModestyBlaise","Dragunlucas","MrMe","Theuso","Plati","MathR.","FedericoReali","Mathmaticcs","Douchebag","F0x3r","Guimaroes","Evellyn","JohnRoth","mrmcpunchface","KingkoPop","knaet","LoLotad","GabrielSunlight","MyFeetAreCute","Deepcold","KeyOst","teamdippy4lyfe","GarlandChaos","prazision","mouveon","TOYSTHATK1LL","laspelotastristes","FukuCuku","Mieko","RAW-Hardstyle","Unseen_Charmer","OreoSpeedwgn","solaar","Moclath","Rivalry","babalin","SHUGAH","Pop2222","chuckleslovakia","KySoon","SkyFlare","Achyrashi","averagedork255","_th3sister","DinduMuffins","SycaiDefranco","UntamedAnomaly","STLTH","TrapsAintGay","Mokou","FujiwaraMokou","http.bry","DNE","Y.Ho","8.29","Lazyabe","Prophessor","AfluxD","DakotaSpalsbury","McBigMouse","Honkey","Arrikii","LehFez","Habacuc","Aclion","WickedDeathKilla","loleq80","boots-n-pants-n-boots-n-pants","IsraelLeite","Kajakoro","Bezonian","MadNESS_","Leilaila","Nel","jmart","TenzinKhan","den_drummer","2312313","vlastelin","Alexsa","RedneckPieceOfWhiteTrash","nelo","MissT","GustavForsbergZ1","UltraliteBeamz","Kanari","LeticiaBelm","Mr.Cornflakes","lionanisimov","sigmundvoid","Kthulhu","NaneekMot","Fazerina","Betellgeuse","drumloaf","Balonso","Ahiru","Parden"];
                let months = message.split(' ')[1];
                console.log()
                let found = false;
                fs.readFile('./users.json',"utf8", (err, data) => {
                    let users = JSON.parse(data);
                    let usersFound = [];
                    for(x in users) {
                        let diff = monthDiff(new Date(users[x].lastSeen), new Date());
                        if(diff >= months && staff.includes(users[x].username)) {
                            usersFound.push(users[x].username);
                            console.log(users[x].username, monthDiff(new Date(users[x].lastSeen), new Date()));
                            found = true;
                        }
                    }
                    if(found == false) {
                        bot.sendChat("No users found.");
                    } else {
                        
                        bot.openPM(bot.getUserByName(user).id,(data) => {
                            bot.sendPM(data.id, `Found ${usersFound.length} users: \n` + usersFound.join("\n, "));
                        })
                    }
                })
            }

            if(message.includes("!lastseen") && message.split(' ').length == 2 && message.split(' ')[0] == "!lastseen" && (approveUser(user) || user == "edwin0259")) {
                let u = message.split(' ')[1];
                let found = false;
                fs.readFile('./users.json',"utf8", (err, data) => {
                    let users = JSON.parse(data);
                    let usersFound = [];
                    for(x in users) {
                        if(users[x].username == u) {
                            usersFound.push(users[x]);
                            found = true;
                        }
                    }
                    if(found == false) {
                        bot.sendChat("User not found.");
                    } else {
                        let mes = ""
                        usersFound.forEach(queryUser => {
                            console.log("FOUND");
                            date = new Date(queryUser.lastSeen);
                            mes += `${queryUser.username} was last seen ${
                                    date.getFullYear().toString() + "-" + (date.getMonth()+1).toString() + "-" + date.getDate().toString()}, `
                        })
                        bot.openPM(bot.getUserByName(user).id,(data) => {
                            bot.sendPM(data.id, `Found ${usersFound.length} users: ` + mes);
                        })
                    }
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

            if(message.includes("!lastseen") && message.split(' ').length == 2 && message.split(' ')[0] == "!lastseen" && !approveUser(user) && user != "edwin0259") {
                bot.sendChat("Not authorized");
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
