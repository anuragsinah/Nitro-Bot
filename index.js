const Discord = require('discord.js');
const client = new Discord.Client();
const admin = require('firebase-admin');
fs = require('fs');
var unirest = require('unirest');
const express = require('express') ;
var http = require('http');
var exp = new express() ;
var PORT = process.env.PORT || 5000;

var keepAliveTimeId;
var keepAliveTimeId1;

var serviceAccount = {
    "type": "service_account",
    "project_id": process.env.project_id,
    "private_key_id": process.env.private_key_id,
    "private_key": process.env.private_key.replace(/\\n/g, '\n'),
    "client_email": process.env.client_email,
    "client_id": process.env.client_id,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": process.env.client_x509_cert_url
};

var userPermissionApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

let db = userPermissionApp.firestore();

client.login(process.env.discordBotToken);


client.on('ready', () => {
    console.log("Login successful");
    getCollection();
});

emoteMap = {};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getCollection() {
    console.log('getCollection');
    db.collection('nitroBot').onSnapshot(function(snapshot){
      snapshot.forEach(doc => {
          if (doc.id == 'emotes') {
              console.log(doc.id, "=>", doc.data());
              emoteMap = doc.data();
          }
      });
    });
}

async function updateDataToFirebase(emoteNameToSave,valueToSave) {
    try {
        console.log("updateDataToFirebase");
        var obj = {}
        obj[emoteNameToSave] = valueToSave;
        await db.collection('nitroBot').doc('emotes').set(obj, {
            merge: true
        })
        console.log("updateDataToFirebase done");
    } catch (err) {
        console.error(err);
    }
}

function checkForEmoteIncache(emoteName) {
    var emoteString = "";
    var emoteInCache = client.emojis.cache.find(emoji => emoji.name == emoteName);
    if (emoteInCache != undefined) {
        if (!emoteInCache.deleted  && emoteInCache.available ) {
            if (emoteInCache.animated) {
                emoteString = "<a:" + emoteInCache.name + ":" + emoteInCache.id + ">"
            } else {
                emoteString = "<:" + emoteInCache.name + ":" + emoteInCache.id + ">"
            }
            return emoteString
        } else {
            return emoteString;
        }
    } else {
        return emoteString;
    }
}

function checkForEmoteInDb(emoteName) {
    if (emoteMap[emoteName] != undefined) {
        return emoteMap[emoteName];
    } else {
        return "";
    }
}

function checkForEmote(emoteName) {
    console.log("emoteName", emoteName);
    var emoteString = "";
    emoteString = checkForEmoteIncache(emoteName);
    if (emoteString != "") {
        console.log("emoteString in cache", emoteString);
        return emoteString;
    } else {
        console.log("emoteString in db", checkForEmoteInDb(emoteName));
        return checkForEmoteInDb(emoteName)
    }
}

var emoteArrayIndex = [];
var emoteRegex = /<:[a-zA-Z0-9_~]+:[0-9]+>/g;
var emoteAnimatedRegex = /<a:[a-zA-Z0-9_~]+:[0-9]+>/g;
var emoteRegexString = /^<:[a-zA-Z0-9_~]+:[0-9]+>$/g;
var emoteAnimatedRegexString = /^<a:[a-zA-Z0-9_~]+:[0-9]+>$/g;

function createEmoteArray(message) {
    while ((match = emoteRegex.exec(message)) != null) {
        var obj = {
            "startIndex": match.index,
            "lastIndex": emoteRegex.lastIndex
        };
        emoteArrayIndex.push(obj);
    }
    console.log(emoteArrayIndex);
}

function createAnimatedEmoteArray(message) {
    while ((match = emoteAnimatedRegex.exec(message)) != null) {
        var obj = {
            "startIndex": match.index,
            "lastIndex": emoteAnimatedRegex.lastIndex
        };
        emoteArrayIndex.push(obj);
    }
    console.log(emoteArrayIndex);
}

function saveEmoteInDb(realEmoteName,realEmoteId,animated){
  console.log("saveEmoteInDb");
  if(emoteMap[realEmoteName]==undefined){
    var url = "https://cdn.discordapp.com/emojis/"+ realEmoteId;
    console.log("URL",url);
    unirest.get(url)
    .end(function(res) {
      if (res.error) {
        console.log('error in finding emote') ;
        console.log(res.error);
      }
      else {
        var emoteValue = "";
        console.log("Emote is valid");
        if(animated){
          emoteValue = "<a:" +realEmoteName+":"+realEmoteId+">"
        }else {
          emoteValue = "<:" +realEmoteName+":"+realEmoteId+">"
        }
        updateDataToFirebase(realEmoteName,emoteValue);
     }
   });
  }
}

async function referencedMessage(message) {
  console.log(message.reference);
  if (!message.reference) return null;
  const referenceChannel = await message.client.channels.fetch(message.reference.channelID);
  if (!referenceChannel) return null;
  return await message.channel.messages.fetch(message.reference.messageID);
}

async function removeReaction(message,emote) {
  console.log("removeReaction");
  await sleep(15000);
  message.reactions.cache.find(r => r.emoji.name == emote).users.remove(client.user.id );
}

client.on('message', async (message) => {
    try {
        console.log("Incoming message ",message.content);
        console.log(message.author);
        createEmoteArray(message.content);
        createAnimatedEmoteArray(message.content);
        console.log(emoteArrayIndex);
        const PREFIX = '';
	      let args = message.content.substring(PREFIX.length).split(" ");
        args[0] = args[0].toLowerCase();
        messageRefrenced =await referencedMessage(message);
        if(messageRefrenced != null && args[0] == 'e.r'){
          if(args[1].match(emoteRegexString) || args[1].match(emoteAnimatedRegexString)){
            await messageRefrenced.react(args[1]);
            var indexOfFirstColon = args[1].indexOf(":");
            var indexOfEmoteEndColon =  args[1].indexOf(":",indexOfFirstColon+1);
            var realEmoteName = args[1].substring(indexOfFirstColon+1,indexOfEmoteEndColon);
            removeReaction(messageRefrenced,realEmoteName);
          }
          else{
            if (args[1].charAt(0) == ':' && args[1].charAt(args[1].length-1)==':'){
              args[1] = args[1].substring(1,args[1].length-1);
            }
            var emote = checkForEmoteIncache(args[1]);
            if(emote == ''){
              var emoteinDb = checkForEmoteInDb(args[1]);
              console.log("emoteinDb",emoteinDb);
              if(emoteinDb == ''){
                message.channel.send("Could not find emote: \n`"+args[1]+"`").then(msg => {
                               msg.delete({ timeout: 10000 })
                            })
                            .catch(e=> console.log(e));
              }else{
                message.channel.send("The following emote cannot be used in reactions:\n`"+args[1]+"`\nIf you upload it to a server the bot's in, it will become usable in reactions!").then(msg => {
                               msg.delete({ timeout: 10000 })
                            })
                            .catch(e=> console.log(e));
              }
            }
            else{
              await messageRefrenced.react(emote);
              removeReaction(messageRefrenced,args[1]);
            }
          }
          return await message.delete();
        }
        else{
        var replyMessage = "";
        var emoteAdded = false;
        var findingColon = false;
        var currentColon = 0;
        var lastColon = 0;
        if (message.content[0] == ":") {
            findingColon = true;
        } else {
            replyMessage = replyMessage + message.content[0];
        }

        while (message.content.indexOf(":", lastColon + 1) != -1) {
            console.log("currentColon", currentColon);
            currentColon = message.content.indexOf(":", lastColon + 1);
            console.log("lastColon", lastColon);
            console.log("currentColon", currentColon);
            var realEmote = emoteArrayIndex.find(obj => obj.startIndex == currentColon - 1);
            var realAnimatedEmote = emoteArrayIndex.find(obj => obj.startIndex == currentColon - 2);
            var isRealEmote = (realEmote != undefined);
            var isRealAnimatedEmote = (realAnimatedEmote != undefined)
            if (!isRealEmote && !isRealAnimatedEmote) {
                console.log("findingColon", findingColon);
                if (findingColon) {
                    var emoteName = message.content.substring(lastColon + 1, currentColon);
                    if (checkForEmote(emoteName) != '') {
                        replyMessage = replyMessage + checkForEmote(emoteName);
                        emoteAdded = true;
                    } else {
                        replyMessage = replyMessage + message.content.substring(lastColon, currentColon + 1)
                    }
                    findingColon = false;
                } else {
                    replyMessage = replyMessage + message.content.substring(lastColon + 1, currentColon);
                    findingColon = true
                }
                console.log("replyMessage", replyMessage);
                lastColon = currentColon;
            } else {
                var realEmoteName="";
                var realEmoteId = "";
                var indexOfEmoteEndColon =  message.content.indexOf(":",currentColon+1);
                realEmoteName = message.content.substring(currentColon+1,indexOfEmoteEndColon);
                if (isRealEmote) {
                    replyMessage = replyMessage + message.content.substring(lastColon + 1, realEmote.lastIndex);
                    lastColon = realEmote.lastIndex;
                    realEmoteId  = message.content.substring(indexOfEmoteEndColon+1,realEmote.lastIndex-1);
                    if(message.content.length != realEmote.lastIndex ){
                      if(message.content[lastColon]==":"){
                        findingColon =true;
                      }
                      else{
                        replyMessage = replyMessage + message.content[lastColon];
                        findingColon = false;
                      }
                    }
                    saveEmoteInDb(realEmoteName,realEmoteId,false);
                } else {
                    replyMessage = replyMessage + message.content.substring(lastColon + 1, realAnimatedEmote.lastIndex);
                    lastColon = realAnimatedEmote.lastIndex;
                    realEmoteId  = message.content.substring(indexOfEmoteEndColon+1,realAnimatedEmote.lastIndex-1);
                    if(message.content.length != realAnimatedEmote.lastIndex ){
                      if(message.content[lastColon]==":"){
                        findingColon =true;
                      }
                      else{
                        replyMessage = replyMessage + message.content[lastColon];
                        findingColon = false;
                      }
                    }
                    saveEmoteInDb(realEmoteName,realEmoteId,true);
                }
                console.log("replyMessage", replyMessage);
            }
        }

        if (findingColon) {
            if (message.content.substring(lastColon) != undefined) {
                replyMessage = replyMessage + message.content.substring(lastColon);
            }
        } else {
            if (message.content.substring(lastColon) != undefined) {
                replyMessage = replyMessage + message.content.substring(lastColon + 1);
            }
        }
        emoteArrayIndex = []
        if (message.author.bot) {
            return;
        }
        if (emoteAdded) {
            var userName= "";
            if(message.member.nickname == null){
              userName = message.author.username;
            }
            else {
              userName = message.member.nickname;
            }
            const webhooks = await message.channel.fetchWebhooks();
            var webhook = webhooks.find(wb => { return wb.name === 'Nito-Bot'  });
            if (webhook == undefined) {
                webhook = await message.channel.createWebhook('Nito-Bot');
                console.log(`Created webhook hi ${JSON.stringify(webhook, null, 2)}`);
            }
            if(messageRefrenced != null){
                var messageUrl = "https://discord.com/channels/"+message.reference.guildID+"/"+message.reference.channelID+"/"+message.reference.messageID;
                const exampleEmbed = new Discord.MessageEmbed()
                    .setColor('#0099ff')
                    .setAuthor(messageRefrenced.author.username, "https://cdn.discordapp.com/avatars/" + messageRefrenced.author.id + "/" + messageRefrenced.author.avatar + ".png")
                    .setDescription(messageRefrenced.content)
                    .addField('**Jump**', '[Go to message]('+messageUrl+')')
                    .setFooter('#'+messageRefrenced.channel.name+' - EIN-Bot')
                    .setTimestamp(messageRefrenced.createdAt);
                var webhookResponse = await webhook.send(replyMessage, {
                    username:   userName,
                    avatarURL: "https://cdn.discordapp.com/avatars/" + message.author.id + "/" + message.author.avatar + ".png",
                    embeds: [exampleEmbed]
                });
            }
            else{
              var webhookResponse = await webhook.send(replyMessage, {
                  username:   userName,
                  avatarURL: "https://cdn.discordapp.com/avatars/" + message.author.id + "/" + message.author.avatar + ".png"
              });
            }
            console.log(message.content + " to delete");
            console.log(webhookResponse + " webhookResponse");
            if(webhookResponse != null || webhookResponse != undefined){
              await message.delete();
              console.log("deleted");
            }
        }
      }
    } catch (err) {
        console.error(err);
    }
});

exp.get('/', async (req, res)=>{
    try{
       var htmlContent = '<html><h2> Number of emotes- '+Object.keys(emoteMap).length+'</h2>'
       htmlContent = htmlContent+ '<table border=1>';
       htmlContent = htmlContent+ '<tr><th>Emote Name</th>';
       htmlContent = htmlContent+ '<th>Image/Gif</th>';
       htmlContent = htmlContent+ '<th>Emote Id</th></tr>';
       const ordered = Object.keys(emoteMap).sort().reduce(
         (obj, key) => {
           obj[key] = emoteMap[key];
           return obj;
         },
         {}
       );
       console.log(Object.keys(emoteMap).length);
       for (const [key, value] of Object.entries(ordered)) {
         var name = ':'+key+':';
         var lastIndexOfColon = value.lastIndexOf(":");
         var id = value.substring(lastIndexOfColon+1,value.length-1)
         var url = "https://cdn.discordapp.com/emojis/"+id;//"http://i.stack.imgur.com/SBv4T.gif";//"https://cdn.discordapp.com/emojis/786905231119089675.gif";//"https://cdn.discordapp.com/emojis/"+id+'.gif';
         htmlContent = htmlContent+ '<tr><td>'+name+'</td>';
         htmlContent = htmlContent+ '<td>'+'<img src='+url+ ' alt=""  width=100/>'+'</td>';
         //htmlContent = htmlContent+'<td>'+ url+'</td>'
         htmlContent = htmlContent+ '<td>'+id+'</td></tr></html>';
       }
       res.writeHead(200, { 'Content-Type': 'text/html' });
       res.write(htmlContent);
       //res.write('<table border=1><tr><th>Firstname</th><th>Lastname</th><th>Age</th>  </tr>  <tr>  <td>Jill</td>  <td>Smith</td>  <td>50</td></tr>  <tr>    <td>Eve</td>  <td>Jackson</td>  <td>94</td>  </tr></table> ');
       res.end();
    }
    catch(error){
      console.log(error);
      res.send(error);
    }
});


function startKeepAlive(){
console.log("startKeepAlive");
keepAliveTimeId = setInterval(async function() {
  console.log("Pinging to herokuapp");
  var url = 'https://nitro-bot-discord-97.herokuapp.com/';
  unirest.get(url)
  .end(function(res) {
    if (res.error) {
      console.log('error in pinging') ;
    }
    else {
      console.log("Pinging done with response - "+ res.raw_body);
   }
 });
}, 60000*10);//keep pinging server in 10 min
}

function startKeepAlive1(){
console.log("startKeepAlive1");
keepAliveTimeId = setInterval(async function() {
  console.log("Pinging to herokuapp 1");
  var url = 'https://nitro-bot-971.herokuapp.com/';
  unirest.get(url)
  .end(function(res) {
    if (res.error) {
      console.log('error in pinging') ;
    }
    else {
      console.log("Pinging done with response - "+ res.raw_body);
   }
 });
}, 60000*10);//keep pinging server in 10 min
}

var server = http.createServer(exp);

server.listen(PORT,(req, res)=>{
                    console.log('Server listening in '+ PORT);
                    startKeepAlive();
                    startKeepAlive1()
                    });
