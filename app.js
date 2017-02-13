
var Q = require('q')
var winston = require('winston');
var request = require('request');
var _ = require('lodash');
var TelegramBot = require('node-telegram-bot-api');
var token = '206517901:AAHl1xImPUQZI-HOulXqHt3a1PStaPEslT8';
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var weather = require('openweather-apis');
 
weather.setLang('it');
weather.setCity('Roma');
weather.setUnits('metric');
weather.setAPPID('b76dfef9065842dab1454f9c5c92e340');

// Set up Conversation service.
var conversation = new ConversationV1({
  username: '78eb61d9-c770-4ae1-9f8c-d1e85ce5921e', // replace with username from service key
  password: 'RpmakscG5esQ', // replace with password from service key
  path: { workspace_id: '50588b08-dd05-4975-8b9b-d0292134fd2a' }, // replace with workspace ID
  version_date: '2016-07-11'
});


var transports = [
  new(winston.transports.Console)({
    colorize: true,
    prettyPrint: true,
    //timestamp : true,
    level: 'debug',
  })
];

var log = new(winston.Logger)({
  "transports": transports
});

// Setup polling way 
var bot = new TelegramBot(token, {polling: true});
var users = [{name:"claudio",id:"301563941", response:"", email:"claudio.digiovanni@gmail.com",enabled:true}]


function createBooking(date,time,userEmail){

  var defer = Q.defer()
  
  var slot1 = getSlotFromHour(time)
  var form1 = {'date': date, 'ranges': [slot1,slot1 + 1, slot1 +2],'gameT':0,'courtsNumber':4,'circolo':'56be660ae49818d0034c9edf'}

  request.post({url:'http://localhost:3000/botApi/v1/checkBeforeCreateBooking', form: form1}, function(err,httpResponse,body){ 
    
    log.info('createBooking..')
    log.info(body)
    if (err || JSON.parse(body).status == 400 ){
      defer.resolve("-1")
    } 
    else{
      log.info('-------------')
      log.info(body)
      var obj = {circolo : '56be660ae49818d0034c9edf', ranges : [slot1,slot1 + 1, slot1 +2], email: userEmail, gameType :  0, payed : false, 
      court: JSON.parse(body).data[0], date :  date}
      request.post({url:'http://localhost:3000/botApi/v1/createBooking', form: {'book':obj}}, function(err,httpResponse,body){ 
        if (err){
          log.info(err)
          defer.resolve("-1")
        }
        else
          defer.resolve(obj.court)
      })
    }
 })
 return defer.promise
}


function sendMessageToWatsonAndProcessIt(newMessageFromUser,chatId){    
    var defer = Q.defer()
    var myresp = ""
    var user = _.find(users,function(u){
      return u.id == chatId
    })   
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
          if (response.output.action === 'verify') {
            log.info(response)
            var date = new Date(response.context.date); date.setHours(0); date.setMinutes(0); date.setSeconds(0);date.setMilliseconds(0)
            var time = response.context.time
            log.info('verify')
            createBooking(date,time,user.email)
            .then(function(court){
                log.info(court)
                log.info('court.....')
                
                if (court != -1){
                    response.context.verified = 'ok'
                    response.context.court = court
                }
                else{
                    response.context.verified = 'notOk'
                    log.info('notOk')
                    return checkForFirstFreeSlot(date,time,user.email).then(function(results){
                        log.info('results....Q.all')
                        var newTime = ""
                        _.forEach(results, function(value, key) {
                          if (value.state == 'fulfilled'){
                            newTime += " - " + getHourMinuteFromSlot(value.value)
                          }
                        });
                        _.remove(response.context,function(item){
                          return item.verified == 'ok'
                        })
                        response.context.newTime = newTime
                        })
                }
            }).then(function(x){

                conversation.message({
                  input: { text: '.......' },
                  // Send back the context to maintain state.
                  context : response.context 
                }, function(err,response){user.response = response; log.info('xxxx');log.info(response);myresp = "...";bot.sendMessage(chatId, response.output.text[0]);})

            })
            
          } 
          else if (response.output.action === 'weather'){
            weather.getAllWeather(function(error,smart){
            console.log(smart);
            console.log(error);
            myresp = smart.weather[0].description
            myresp += " - " + JSON.stringify(smart.main)
            bot.sendMessage(chatId, myresp);
            defer.resolve(myresp)
    });
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
  var user = _.find(users,function(u){
      return u.id == chatId
    })
  if (user == null)
    bot.sendMessage(chatId, "Ops! non sei registrato! Per favore inviami il tuo indirizzo email. Thanks ;-)");
  else{
    sendMessageToWatsonAndProcessIt(message.text,chatId).then(function(response){
      bot.sendMessage(chatId, response);
    })
  }

});

function checkForFirstFreeSlot(date,time,userEmail){
  log.info('checkForFirstFreeSlot')
  var promises = []
  var slot1 = getSlotFromHour(time)
  var form1 = {'date': date, 'ranges': [slot1,slot1 + 1, slot1 +2],'gameT':0,'courtsNumber':4,'circolo':'56be660ae49818d0034c9edf'}
  
  
  _.times(10,function(){
      var deferx = Q.defer()
      log.info(form1)
      form1.ranges[0] = slot1
      form1.ranges[1] = slot1 + 1
      form1.ranges[2] = slot1 + 2
      
      request.post({url:'http://localhost:3000/botApi/v1/checkBeforeCreateBooking', form: form1}, function(err,httpResponse,body){ 
        log.info('risposta checkbefore.....')
        log.info(body)
        if (err || JSON.parse(body).status == 400 ){
          log.info(err)
          deferx.reject('err')
        } 
        else{
          deferx.resolve(JSON.parse(body).slot1)
        }
      })
      promises.push(deferx.promise)
      slot1++

  })
    log.info(promises)
    return Q.allSettled(promises)
  
}



function getSlotFromHour(time){

        var splittedTime = time.split(':')
        var hour = splittedTime[0]
        var minute = splittedTime[1]
        if (minute != '0')
            return ((hour * 2)  + 2)
        return ((hour * 2) + 1)
}
function getHourMinuteFromSlot(r){
      var ret = "";
      try{
        log.info(r)
        r  = parseInt(r) - 0.5
        //log.info(r)
        if (parseInt(r) % 2 === 0 ){
          ret+=(parseInt(r) / 2)
          ret+=".00"
        }
        else{
            ret+=(parseInt(r / 2))
            ret+=".30"
        } 
        log.info(ret)
      }
      catch(err){
        log.error(err)
      }
      
        
      return ret;
    }


var x = getSlotFromHour('9.20')
log.info(x)
    
log.info("BOT ready!");

/*var AlchemyAPI = require('alchemy-api');
var alchemy = new AlchemyAPI('99383e974c425463b6d6d4a5d6308afabbb32f89');
alchemy.imageFaces('http://www.ilgiornale.it/news/cronache/benedetto-xvi-si-confessa-ecco-perch-lasciai-pontificato-1298906.html', {}, function(err, response) {
  if (err) throw err;

  // See http://www.alchemyapi.com/api/ for format of returned object
  var entities = response.imageFaces;
  log.info(entities)
log.info("--------------------------------------")
  var persons = _.filter(entities, function(item){
    return item.type == "Person"
  })
  log.info(persons)
  // Do something with data
});
*/


