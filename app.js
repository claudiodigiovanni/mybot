
var Q = require('q')
var _ = require('lodash');
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


// Setup polling way 
var bot = new TelegramBot(token, {polling: true});

var users = [{name:"claudio",id:"301563941", response:""}]

function sendMessageToWatsonAndProcessIt(newMessageFromUser,chatId){
    
    var myresp = ""
    var user = _.find(users,function(u){
      return u.id == chatId
    })
    var defer = Q.defer()
    conversation.message({
      input: { text: newMessageFromUser },
      // Send back the context to maintain state.
      context : user.response ? user.response.context : null
    }, function(err,response){
          user.response = response
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
          defer.resolve(myresp)

        })
    return defer.promise
}



// Attach event on every received message 
bot.on('message', function (message) {
  var chatId = message.chat.id;
  sendMessageToWatsonAndProcessIt(message.text,chatId).then(function(response){
    bot.sendMessage(chatId, response);
  })
  
});

console.log("BOT ready!");
