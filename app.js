/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

//******************************************** 

var TelegramBot = require('node-telegram-bot-api');
var token = '206517901:AAHl1xImPUQZI-HOulXqHt3a1PStaPEslT8';
var ConversationV1 = require('watson-developer-cloud/conversation/v1');

// Set up Conversation service.
var conversation = new ConversationV1({
  username: '78eb61d9-c770-4ae1-9f8c-d1e85ce5921e', // replace with username from service key
  password: 'RpmakscG5esQ', // replace with password from service key
  path: { workspace_id: '50588b08-dd05-4975-8b9b-d0292134fd2a' }, // replace with workspace ID
  version_date: '2016-07-11'
});


var myresp = ""
var responsex = null

// Process the conversation response.
function processResponse(err, response) {
	responsex = response
  if (err) {
    console.error(err); // something went wrong
    return;
  }
  myresp = response.output.text[0];
  if (response.output.action === 'display_time') {
    // User asked what time it is, so we output the local system time.
    console.log('The current time is ' + new Date().toLocaleTimeString());
  } else if (response.output.action === 'end_conversation') {
    // User said goodbye, so we're done.
    myresp = response.output.text[0];
    //endConversation = true;
  } else if (response.output.action === 'verify') {
        console.log('verify....');
        myresp = response.output.text[0] + " " + response.output.text[1];
        
  }
  else {
    // Display the output from dialog, if any.
    if (response.output.text.length != 0) {
        myresp = response.output.text[0]
    }
  }
  
  
}

function sendMessageToWatson(newMessageFromUser){
    console.log(newMessageFromUser)
    conversation.message({
      input: { text: newMessageFromUser },
      // Send back the context to maintain state.
      context : responsex ? responsex.context : null
    }, processResponse)


}

// Setup polling way 
var bot = new TelegramBot(token, {polling: true});

// Attach event on every received message 
bot.on('message', function (message) {
  sendMessageToWatson(message.text);
  setTimeout(function(){
              var chatId = message.chat.id;
              // send a message to the chat acknowledging receipt of their message
              bot.sendMessage(chatId, myresp);
  },2000)
});

console.log("BOT ready!");
//******************************************** */

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
