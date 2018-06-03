const fs = require('fs');
const mysql = require("mysql");
const shell = require('shelljs');

let dbPassword = "";
fs.readFile("./keys.json", "utf8", (err, data) => {
    let keys = JSON.parse(data);
    dbPassword = keys.dbPassword;
})

function genTableData(res, keyMatch) {
    let headerData = "";
    let data = "";
    for(let key in res[0]) {
      if(["id"].includes(key)) continue;
      key = key.split(/(?=[A-Z])/).join(" ").toLowerCase();
      headerData += `<th>${key}</th>\n`;
    }
      data += 
`<tr class="tableHeaders">
  ${headerData}
</tr>
`;
    
    res.forEach(item => {
      let itemData = ""
      for(let key in item) {
        if(["id"].includes(key)) continue;
        
        itemData += (key == keyMatch) ? `<td class="selectedCol">${item[key]}</td>\n` : `<td>${item[key]}</td>\n`;
      }
      data += 
`<tr>
  ${itemData}
</tr>
`;

    })

    return data;
}

function initWebsite(callback="") {
  const connection = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: dbPassword,
      database: 'limitless',
      charset: 'utf8mb4_general_ci'
  })
  let playData, mostGrabData, hotPlayData;
  connection.query(`SELECT * FROM songs ORDER BY plays DESC LIMIT 100;`, (err, res, fields) => {
    playData = genTableData(res, "plays");
  });
  connection.query(`SELECT * FROM songs ORDER BY totalGrabs DESC LIMIT 100;`, (err, res, fields) => {
    mostGrabData = genTableData(res, "totalGrabs");
  });
  connection.query(`SELECT * FROM songs ORDER BY mostGrabs DESC LIMIT 100;`, (err, res, fields) => {
    hotPlayData = genTableData(res, "mostGrabs");
  });
  connection.query(`SELECT * FROM users ORDER BY wins DESC LIMIT 100;`, (err, res, fields) => {
    userWinData = genTableData(res, "wins");
  });
  connection.query(`SELECT * FROM users ORDER BY totalGrabs DESC LIMIT 100;`, (err, res, fields) => {
    userGrabData = genTableData(res, "totalGrabs");
    buildWebsite(playData, mostGrabData, hotPlayData, userWinData, userGrabData, callback);
  });
  
  connection.end();
}

function buildWebsite(playData, mostGrabData, hotPlayData, userWinData, userGrabData, callback) {
  var d = new Date();
  statsTemplate = 
`
<!DOCTYPE HTML>
<html>
  <head>
    <title>Stats</title>
    <link rel="stylesheet" href="stats.css">
  </head>
  <body>
    <div class="header">
      <a class="imageContainer" href="https://edwin0259.github.io/bot/">
        <image class="logo" src="./images/dubLogo.jpg"/>
      </a>
      <h1>Limitless Statistics</h1>
      <small class="lastUpdated">Last Updated: ${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}</small>
    </div>
    <div class="buttonOptions">
      <button id="mostPlayedBtn" class="option">Most Played</button>
      <button id="mostGrabbedBtn" class="option">Most Grabbed</button>
      <button id="hotPlaysBtn" class="option">Hot Plays</button>
    </div>
    <table id="mostPlayed">
      ${playData}
    </table>
    <table id="mostGrabbed">
      ${mostGrabData}
    </table>
    <table id="hotPlays">
      ${hotPlayData}
    </table>
    <script src="stats.js"></script>
  </body>
</html>
`

usersTemplate = 
`
<!DOCTYPE HTML>
<html>
  <head>
    <title>Users</title>
    <link rel="stylesheet" href="stats.css">
  </head>
  <body>
    <div class="header">
      <a class="imageContainer" href="https://edwin0259.github.io/bot/">
        <image class="logo" src="./images/dubLogo.jpg"/>
      </a>
      <h1>Limitless Users</h1>
      <small class="lastUpdated">Last Updated: ${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}</small>
    </div>
    <div class="buttonOptions">
      <button id="mostWinsBtn" class="option">Most Wins</button>
      <button id="mostGrabsBtn" class="option">Grabs Received</button>
    </div>
    <table id="mostWins">
      ${userWinData}
    </table>
    <table id="mostGrabs">
      ${userGrabData}
    </table>
    <script src="users.js"></script>
  </body>
</html>
`
  fs.writeFile("stats.html", statsTemplate, 'utf8', err => {
    if(err) {
      if(callback) callback(err)
      return err;
    }  
  })

  fs.writeFile("users.html", usersTemplate, 'utf8', err => {
    if(err) {
      if(callback) callback(err);
      return err;
    }
    
    shell.exec('commit.sh', (code, err, res) => {
      if(err) {
        return err;
      }
      if(callback) callback("Website built :hammer:. Everything might take a moment to update.")
    })
  })
}

exports.website = initWebsite;