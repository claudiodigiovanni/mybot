
var prompt = require('prompt-sync')();
var ConversationV1 = require('watson-developer-cloud/conversation/v1');

// Set up Conversation service.
var conversation = new ConversationV1({
  username: '78eb61d9-c770-4ae1-9f8c-d1e85ce5921e', // replace with username from service key
  password: 'RpmakscG5esQ', // replace with password from service key
  path: { workspace_id: '50588b08-dd05-4975-8b9b-d0292134fd2a' }, // replace with workspace ID
  version_date: '2016-07-11'
});

// Start conversation with empty message.
conversation.message({}, processResponse);

// Process the conversation response.
function processResponse(err, response) {
  if (err) {
    console.error(err); // something went wrong
    return;
  }

  
  if (response.output.action === 'display_time') {
    // User asked what time it is, so we output the local system time.
    console.log('The current time is ' + new Date().toLocaleTimeString());
  } else if (response.output.action === 'end_conversation') {
    // User said goodbye, so we're done.
    console.log(response.output.text[0]);
    //endConversation = true;
  } else if (response.output.action === 'verify') {
        console.log('verify....');
        console.log(response.output.text[0]);
        console.log(response.output.text[1]);
        
  }
  else {
    // Display the output from dialog, if any.
    if (response.output.text.length != 0) {
        console.log(response.output.text[0]);
    }
  }

var newMessageFromUser =  prompt('>>');
console.log('Input utente: ' + newMessageFromUser)
  

    
    /*if (newMessageFromUser == "si" || newMessageFromUser == "ok"){
        response.context.confirmed = true
    }*/
    conversation.message({
      input: { text: newMessageFromUser },
      // Send back the context to maintain state.
      context : response.context
    }, processResponse)

  }


    
  