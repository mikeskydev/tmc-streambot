const Discord = require('discord.js');
const discordClient = new Discord.Client();
const discordToken = require('./../tokens')["discord-token"];
const twitch = require('./twitch-helix');
const config = require('./config');
class DiscordChannel {
  constructor (id) {
    this.id = id;
  }
  send (msg) {
    return new Promise ((resolve, reject) => {
      if (discordClient.ws.connection !== null && discordClient.status === 0) {
        let channel = discordClient.channels.get(this.id);
        if (typeof channel !== 'undefined') {
          resolve(channel.send(msg));
        } else {
          reject('Failed to send discord message (Discord connection open, but channel not found.');
        }
      } else {
        reject('Failed to send discord message (Discord connection not open)');
      }
    });
  }
}
const responseDiscordChannel = new DiscordChannel(config['discord-response-channel-id']);
const notifyDiscordChannel = new DiscordChannel(config['discord-notifications-channel-id']);

setTimeout(() => {
  console.log("Logging in to discord...");
  discordClient.login(discordToken).then(() => {
    console.log("Discord login success");
  }).catch((e) => {
    console.log("Discord login failure");
    console.log(e);
  });
}, 5000);
twitch.on('messageStreamStarted', (stream) => {
  let notificationMessage = stream.url +' just went live on Twitch playing ' + stream.game + ': ' + stream.title;
  //console.log(notificationMessage);
  let channel = discordClient.channels.get(config['discord-notifications-channel-id']); 
  var postDate = JSON.parse(JSON.stringify(new Date()));
  const embed = {
    "title": stream.url + " just went live: " + stream.title,
    "url": stream.url,
    "color": 1369976,
    "timestamp": postDate,
    "footer": {
      "icon_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Triforce.svg/1200px-Triforce.svg.png",
      "text": "Playing " + stream.game
    },
    "thumbnail": {
      "url": "https://vignette.wikia.nocookie.net/zelda/images/3/33/The_Legend_of_Zelda_-_The_Minish_Cap_%28logo%29.png"
    },
    "author": {
      "name": stream.name + " is now live on Twitch!",
      "url": stream.url,
      "icon_url": "https://vignette.wikia.nocookie.net/zelda/images/3/3e/Link_Artwork_1_%28The_Minish_Cap%29.png"
    }
  };
  channel.send({ embed }).catch((e) => {
    console.log(e);
  });
 
 /* notifyDiscordChannel.send(notificationMessage).then((message) => {
    //console.log(message);
  })*/
});
twitch.on('messageStreamDeleted', (stream) => {
  console.log (stream.url + " went offline");
  let channel = discordClient.channels.get(config['discord-notifications-channel-id']); 
  channel.fetchMessages({limit: 30})
    .then(messages => messages.forEach(message => {
     if ((message.embeds) && (message.embeds.length >0)) {
        if (message.embeds[0].message.embeds[0].url == stream.url) {
          message.delete();
          console.log(message.id + " live message deleted!");
        }
      }
      /*if (message.content.includes(stream.url))
      message.delete();*/
      
    }))
    .catch(console.error);
});
discordClient.on('ready', () => {
  function failToSet(setting) {return (e) => {
    console.log('Failed to set ' + setting);
    console.log(e);
  }}
  discordClient.user.setPresence({
    "status": 'online',
    "game": {
      "name": config['bot-currently-playing'],
      "type": "streaming",
      "url": "https://www.twitch.tv/directory/game/The%20Legend%20of%20Zelda%3A%20The%20Minish%20Cap"
    }
  }).catch(failToSet('presence'));
});
function toWeirdCase (pattern, str) {
  return str.split('').map((v, i) => pattern[i%7+1] === pattern[i%7+1].toLowerCase() ? v.toLowerCase() : v.toUpperCase()).join('');
}
discordClient.on('message', (message) => {
  let streamCommandRegex = /^(\.|!)streams$/i;
  let streamNotCased = /^(\.|!)streams$/;
  let channel = discordClient.channels.get(config['discord-notifications-channel-id']); 
  let testCommand = /^(\.|!)test$/;
  if (message.channel.id === responseDiscordChannel.id && testCommand.test(message.content)) {
    var postDate = JSON.parse(JSON.stringify(new Date()));
    const embed = {
      "title": "Test" + " just went live playing " + "TP",
      "url": "https://twitch.tv",
      "color": 1369976,
      "timestamp": postDate,
      "footer": {
        "icon_url": "https://i.imgur.com/7zzwfz8.png",
        "text": "Live on Twitch now!"
      },
      "thumbnail": {
        "url": "https://i.imgur.com/8QvKAk4.png"
      },
      "author": {
        "name": "Test" + " is live on Twitch!",
        "url": "https://twitch.tv",
        "icon_url": "https://cdn.discordapp.com/app-icons/467693631986466825/f6b52aef5431c2814e2c164a36383955.png"
      }
    };
    channel.send({ embed }).catch((e) => {
      console.log(e);
    });
    var delay = setTimeout(() => {
      channel.fetchMessages({limit: 30})
      .then(messages => messages.forEach(message => {
       if (message.embeds) 
        console.log("url: " + message.embeds[0].message.embeds[0].url);
      }));
    }, 2000);
  }
  if (message.channel.id === responseDiscordChannel.id && streamCommandRegex.test(message.content)) {
    let applyWeirdCase = !streamNotCased.test(message.content);
    let streams = twitch.getStreams();
    let nobodyStreaming = 'Nobody is streaming.';
    let unknownStreaming = 'At least 1 person is streaming. I\'ll push notification(s) after I finish gathering data.';
    if (applyWeirdCase) {
      nobodyStreaming = toWeirdCase(message.content, nobodyStreaming);
      unknownStreaming = toWeirdCase(message.content, unknownStreaming);
    }
    if (Object.keys(streams).length === 0) {
      message.channel.send(nobodyStreaming);
    } else {
      let streamsString = '';
      for (let stream of Object.keys(streams)) {
        let streamTitle = streams[stream]["title"];
        if (applyWeirdCase) {
          streamTitle = toWeirdCase(message.content, streamTitle);
        }
        if (typeof streams[stream]["login"] !== 'undefined') {
          streamsString += '<' + streams[stream]["url"] + '> - ' + streamTitle + '\n';
        }
      }
      if (streamsString === '') {
        message.channel.send(unknownStreaming);
      } else {
        streamsString = streamsString.slice(0, -1);
        message.channel.send(streamsString);
      }
    }
  }
});