const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', } });

const themes = require("./themes.js");
const nsfw = require("./nsfwThemes.js");

const PORT = process.env.PORT || 3000;

var allNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

//Liste aller verbundenen Clients
var sockets = [];

// Liste aller Spieler
var players = {};

//Liste der Themen für die Runde;
var themen = [];

//Spielstand
var game;

io.on("connection", (socket) => {
  console.log('someone connected');
  socket.emit("connected", "Welcome to Top Ten");

  if (sockets.length === 0) {
    newGame();
  }
  sockets.push(socket);

  socket.on('disconnect', function () {
    var name = 'someone';

    if (players[socket.id]) {
      name = players[socket.id].name;

      var i = game.viewer.indexOf(players[socket.id].name);
      if (i !== -1) {
        game.viewer.splice(i, 1);
      }

      var j = game.players.indexOf(players[socket.id].name);
      if (j !== -1) {
        if(game.answers[j]){
          game.players[j] = '';
        } else {
          game.players.splice(j, 1);
        }
      }

      delete (players[socket.id]);
    }
    console.log(name + ' disconnected!');
    var i = sockets.indexOf(socket);
    sockets.splice(i, 1);

    io.emit('state', game);
  });

  socket.on('join', (args) => {
    console.log('someone joined as ' + args);
    game.viewer.push(args);
    players[socket.id] = { name: args };
    io.emit('state', game);
  });

  socket.on('joinGame', (name) => {
    if (players[socket.id].name) {
      var i = game.players.indexOf('');
      if (i !== -1){
        game.players[i] = players[socket.id].name;
      } else {
        game.players.push(name);
      }
      console.log(name + ' joined the players');
      var i = game.viewer.indexOf(name);
      game.viewer.splice(i, 1);
      io.emit('state', game);
    }
  });

  socket.on('joinViewer', (name) => {
    if (players[socket.id].name) {
      console.log(name + ' joined the viewers');
      game.viewer.push(name);
      var j = game.players.indexOf(players[socket.id].name);
      if (j !== -1) {
        game.players.splice(j, 1);
      }
      io.emit('state', game);
    }
  });

  socket.on('answer', (answer) => {
    if (players[socket.id].name) {
      console.log(players[socket.id].name + ' answers ' + answer);
      var i = game.players.indexOf(players[socket.id].name);
      game.answers[i] = answer;
      io.emit('state', game);
    }
  });

  socket.on('guess', (number) => {
    if (players[socket.id].name) {
      console.log(players[socket.id].name + ' guesses ' + number + ' as the next Number');
      if (number < game.currentNumber) {
        game.unicorns--;
        game.shit++;
      }
      game.currentNumber = number;
      io.emit('state', game);
    }
  });

  socket.on('setNSFW', (args) => {
    if (players[socket.id].name) {
      console.log('NSFW Themes: ' + game.isNSFW);
      game.isNSFW = !game.isNSFW;
      io.emit('state', game);
    }
  });

  socket.on('startGame', (args) => {
    if (players[socket.id].name && !game.finished) {
      console.log(players[socket.id].name + ' starts the game');
      startGame();
      io.emit('state', game);
    }
  });

  socket.on('nextRound', (args) => {
    if (players[socket.id].name) {
      console.log(players[socket.id].name + ' starts the next Round');
      newRound();
      io.emit('state', game);
    }
  });

  socket.on('newGame', (args) => {
    if (players[socket.id].name) {
      console.log(players[socket.id].name + ' starts a new Game');
      newGame();
      io.emit('newGameStarted', game);
    }
  });
});

function newGame() {
  game = {
    players: [],
    viewer: [],
    numbers: [],
    answers: [],
    currentNumber: 0,
    captain: -1,
    round: -1,
    thema: "",
    maxUnicorns: 0,
    unicorns: 0,
    shit: 0,
    started: false,
    finished: false,
    isNSFW: false
  }

  for (socke of Object.keys(players)) {
    console.log(players[socke]);
    game.viewer.push(players[socke].name);
  }
}

function startGame() {
  newThemes();

  game.started = true;
  game.captain = Math.floor(Math.random() * game.players.length);
  if (game.players.length >= 9) {
    game.maxUnicorns = 8;
  } else {
    game.maxUnicorns = game.players.length;
  }
  game.unicorns = game.maxUnicorns;
  game.shit = 0;
  newRound();
}

function newRound() {
  game.round++;
  if (game.round >= themen.length || game.shit >= game.maxUnicorns) {
    game.started = false;
    game.finished = true;
  } else {
    game.thema = themen[game.round];
    game.answers = [];
    game.currentNumber = 0;
    if (game.captain == game.players.length - 1) {
      game.captain = 0;
    } else {
      game.captain++;
    }
    shuffleArray(allNumbers);
    if (game.players.length >= 9) {
      game.numbers = allNumbers.slice(0, 9);
    } else {
      game.numbers = allNumbers.slice(0, game.players.length);
    }
  }
}

function newThemes() {
  themen = [];
  if (game.isNSFW) {
    const max = nsfw.length;
    const used = [];
    for (i = 0; i < 5; i++) {
      let j;
      do {
        j = Math.floor(Math.random() * max);
      } while (used.indexOf(j) !== -1)
      themen.push(nsfw[j]);
      used.push(j);
    }
  } else {
    const max = themes.length;
    const used = [];
    for (i = 0; i < 5; i++) {
      let j;
      do {
        j = Math.floor(Math.random() * max);
      } while (used.indexOf(j) !== -1)
      themen.push(themes[j]);
      used.push(j);
    }
  }
}

//Durstenfeld Shuffle, SHUFFLE THEORY IS A RABBITHOLE!!! STAY AWAY!!!
//Funktion für Mischen der Zahlenkarten für die aktuelle Runde
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

httpServer.listen(PORT, () => {
  console.log("Listening at: " + PORT + " ...");
});