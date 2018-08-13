const twitch = require('twitch-helix-api');
const EventEmitter = require('events');
const config = require('./config');
var game;
const streamEmitter = new EventEmitter();
let startup = false;
twitch.clientID = require('./../tokens')["twitch-client-id"];
let streams = { };
function streamLoop () {
  // Uncomment for logging.
  //console.log("Get streams...");
  //console.log(".--current streams--.");
  //console.log(streams)
  //console.log("'-------------------'");
  twitch.streams.getStreams({
    "game_id": [
      "5635" //TMC
    ],
    "community_id": [
      "5db93886-7d58-4db7-8936-9aef93910dea",
      "dbf7204e-af0f-4554-9b47-eb44bca6ff27",
      "6e940c4a-c42f-47d2-af83-0a2c7e47c421"
    ], //Zelda-speedruns, zelda-speed-runs, speedrunning
    "type": 'live'
  }).then((data) => {
    let res = data.response.data;
    let user_ids = [ ];
    for (let stream of res) {
      user_ids.push(stream["user_id"]);
      if (typeof streams[stream["user_id"]] === 'undefined') {
        streams[stream["user_id"]] = { };
      }
      streams[stream["user_id"]]["timer"] = 15;
      streams[stream["user_id"]]["title"] = stream["title"];
      streams[stream["user_id"]]["viewer_count"] = stream["viewer_count"];
      streams[stream["user_id"]]["game_id"] = stream["game_id"]
      
    }
    if (user_ids.length > 0) {
      return twitch.users.getUsers({
        "id": user_ids
      });
    }
    return null;
  }).then((data) => {
    if (data === null) {
      return;
    }
    let res = data.response.data;
    for (let stream of res) {
      if (typeof streams[stream["id"]]["url"] === 'undefined') {
        if (startup === true) {
          streamEmitter.emit('messageStreamStarted', {
            "url": 'https://www.twitch.tv/' + stream["login"],
            "name": stream["login"],
            "title": streams[stream["id"]]["title"],
            "game": "The Minish Cap",
            // "id": stream["id"],
            // "display_name": stream["display_name"],
            // "login": stream["login"]
          });
        }
      }
      streams[stream["id"]]["url"] = 'https://www.twitch.tv/' + stream["login"];
      streams[stream["id"]]["display_name"] = stream["display_name"];
      streams[stream["id"]]["login"] = stream["login"];
    }
    return;
  }).catch((e) => {
    console.error(e);
  }).then(() => {
    if (startup === false) {
      startup = true;
    }
    setTimeout(streamLoop, 30000);
  });
}
setTimeout(streamLoop, 5000);
setInterval(() => {
  for (let stream of Object.keys(streams)) {
    streams[stream]["timer"]--;
    if (streams[stream]["timer"] < 1) {
      if (typeof streams[stream]["url"] !== 'undefined' && typeof streams[stream]["title"] !== 'undefined') {
        streamEmitter.emit('messageStreamDeleted', {
          "url": streams[stream]["url"],
          "title": streams[stream]["title"],
          "id": stream
        });
      }
      delete streams[stream];
    }
  }
}, 20000);
streamEmitter.getStreams = () => {
  return streams;
}
module.exports = streamEmitter;
