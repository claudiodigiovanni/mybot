
//var TelegramBot = require('node-telegram-bot-api');
var Q = require('q')
var moment = require('moment')
var winston = require('winston');
var request = require('request');
var _ = require('lodash');

var token = '206517901:AAHl1xImPUQZI-HOulXqHt3a1PStaPEslT8';
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var weather = require('openweather-apis');
var AlchemyAPI = require('alchemy-api');
var alchemy = new AlchemyAPI('99383e974c425463b6d6d4a5d6308afabbb32f89');


const TeleBot = require('telebot');
const bot = new TeleBot('206517901:AAHl1xImPUQZI-HOulXqHt3a1PStaPEslT8');

var mongoose = require('mongoose');

var User = require('./user.js');

mongoose.set('debug', true);
mongoose.connect("mongodb://mybooking:mareblu69030303@127.0.0.1:27017/watson");
//mongoose.connect("mongodb://127.0.0.1:27017/watson");
mongoose.connection.on('error', function () {
    debug('Mongoose connection error');
});

 
weather.setLang('it');
weather.setUnits('metric');
weather.setAPPID('b76dfef9065842dab1454f9c5c92e340');

var chuck = require('chuck-norris-api');

// Set up Conversation service.
var conversation = new ConversationV1({
  username: '78eb61d9-c770-4ae1-9f8c-d1e85ce5921e', // replace with username from service key
  password: 'RpmakscG5esQ', // replace with password from service key
  path: { workspace_id: '983fa7b8-47d6-42ae-86f4-9774a711c86c' }, // replace with workspace ID
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


function createBooking(date,time,userEmail){

  var defer = Q.defer()
  
  var slot1 = getSlotFromHour(time)
  var form1 = {'date': date, 'ranges': [slot1,slot1 + 1, slot1 +2],'gameT':0,'courtsNumber':4,'circolo':'56be660ae49818d0034c9edf'}

  request.post({url:'http://localhost:3000/botApi/v1/checkBeforeCreateBooking', form: form1}, function(err,httpResponse,body){ 
    
        log.info('createBooking..')
        if (err || JSON.parse(body).status == 400 ){
            log.info('verify: NOT ok....')
            checkForFirstFreeSlot(date,time,userEmail).then(function(results){
                log.info('results....Q.all')
                var newTime = ""
                _.forEach(results, function(value, key) {
                  if (value.state == 'fulfilled'){
                    newTime += " - " + getHourMinuteFromSlot(value.value)
                  }
                });
                defer.resolve("Ops! *Nessun campo disponibile* per quell'ora. Se vuoi i seguenti orari *risultano ancora disponibili* :  " + newTime)   
                })
        } else{
          log.info('verify: ok....')
          var okCourt = JSON.parse(body).data[0]
          var obj = {circolo : '56be660ae49818d0034c9edf', ranges : [slot1,slot1 + 1, slot1 +2], email: userEmail, gameType :  0, payed : false, 
          court: okCourt, date :  date}
          request.post({url:'http://localhost:3000/botApi/v1/createBooking', form: {'book':obj}}, function(err,httpResponse,body){ 
            if (err){
              log.info(err)
              defer.resolve("Ops!!! Problemi durante la prenotazione.....")
            }
            else
              defer.resolve("Great! Hai il campo: " + okCourt)
          })
        }
    })
    return defer.promise
}

function findMyBookings(date,time,userEmail){

  var defer = Q.defer()
  var form1 = {'date': date, 'userEmail': userEmail}

  request.post({url:'http://localhost:3000/botApi/v1/findMyBookings', form: form1}, function(err,httpResponse,body){ 
    
        log.info('findMyBookings..')
        var ret = "*Ecco i tuoi impegni* \n"
        var data =JSON.parse(body)
        _.each(data.data,function(item){
          ret += moment(item.startHour).format('DD/MM/YY HH:mm') + " - " + moment(item.endHour).format('HH:mm') + "\n"
        })
        if (data.data.length == 0) ret = "*Non hai nessun impegno.* Si batte la fiacca eh!"
        defer.resolve(ret)
        
    })
    return defer.promise
}

function alchemyEntitiesCallback(obj,address){
  var defer = Q.defer()
  log.info(obj) 
  var myAddress = 'http://www.ilgiornale.it/news/cronache/benedetto-xvi-si-confessa-ecco-perch-lasciai-pontificato-1298906.html'   
  if (address != null)
    myAddress = address 
  alchemy.entities(myAddress, {}, function(err, response) {
      if (err) {log.error(err);throw err}

      // See http://www.alchemyapi.com/api/ for format of returned object
      var entities = response.entities;
      //log.info(entities)
      var filteredObjects = _.filter(entities, function(item){
        if (obj == 'tutto') return true
        return item.type == obj
      })
      log.info(filteredObjects)
      var mystring = ""
      _.each(filteredObjects,function(item){
        mystring += "*Tipo*: " + item.type + "   *Rilevanza*: " + item.relevance + "   *Num. citazioni*: " + item.count + "   *Valore*: " + item.text + " \n"
      })
      defer.resolve(mystring)
      log.info('alchemyEntitiesCallback end......')
      // Do something with data
    });
    return defer.promise
  
}

function alchemyFacesCallback(address){
  var defer = Q.defer()
  var myAddress = 'http://www.ilgiornale.it/news/cronache/benedetto-xvi-si-confessa-ecco-perch-lasciai-pontificato-1298906.html'   
  if (address != null)
    myAddress = address 
  alchemy.imageFaces(myAddress, {}, function(err, response) {
      if (err) {log.error(err);throw err}

      // See http://www.alchemyapi.com/api/ for format of returned object
      var entities = response.imageFaces;
      log.info(entities)
      defer.resolve(JSON.stringify(entities))
      // Do something with data
    });
    return defer.promise
  
}

function processResponse(err,response,defer,myresp,user,chatId){
          
          user.response = response
          if (err) {
            console.error(err); // something went wrong
            return;
          }
          if (response.output.action === 'chuck') {
            /*const API = 'https://thecatapi.com/api/images/get?format=src&type=';
            bot.sendPhoto(chatId, API + 'png', { fileName: 'kitty.jpg' });*/
            chuck.getRandom().then(function (data) {
                console.log(data.value.joke);
                defer.resolve("_" + data.value.joke + "_")
            });
          }
          else if (response.output.action === 'prenota') {
            var date = new Date(response.context.date); date.setHours(0); date.setMinutes(0); date.setSeconds(0);date.setMilliseconds(0)
            var time = response.context.time
            log.info('verify')
            bot.sendMessage(chatId, "Dammi un attimo per la verifica....;-)");
            createBooking(date,time,user.email).then(function(message){ defer.resolve(message)}) 
          } 
          else if (response.output.action === 'weather'){
              
              weather.setCity(response.context.citta);
              weather.getAllWeather(function(error,smart){
                console.log("weather");
                console.log(response.context.citta);  
                console.log(smart.main);
                  myresp = "*Condizioni meteo di " + response.context.citta + ": " + smart.weather[0].description + "* \n"
                  myresp += "Temperatura:" + JSON.stringify(smart.main.temp) + "\n"
                  myresp += "Pressione:" + JSON.stringify(smart.main.pressure) + "\n"
                  myresp += "Umidità:" + JSON.stringify(smart.main.humidity) + "\n"
                  myresp += "Minima:" + JSON.stringify(smart.main.temp_min) + "\n"
                  myresp += "Massima:" + JSON.stringify(smart.main.temp_max) + "\n"
                  defer.resolve(myresp)
                
            });
          }
          else if (response.output.action === 'impegni') {
            var date = new Date(); date.setHours(0); date.setMinutes(0); date.setSeconds(0);date.setMilliseconds(0)
            log.info('impegni')
            bot.sendMessage(chatId, "Dammi un attimo per favore....;-)");
            findMyBookings(date,time,user.email).then(function(message){ defer.resolve(message)}) 
          } 
          else if (response.output.action === 'trova') {
              log.info('trova')
              var obj = response.context.obj
              var address = response.context.address
              log.info(obj)
              log.info(address)
              bot.sendMessage(chatId, "Dammi un attimo per favore....;-)");
              alchemyEntitiesCallback(obj,address).then(function(message){ log.info('okkkkkkk1111');log.info(message);defer.resolve(message)})
          } 
          else if (response.output.action === 'newAddress') {
              log.info('newAddress')
              defer.resolve("Qual'è il nuovo indirizzo?")
          } 
          else if (response.output.action === 'faces') {
              log.info('faces')
              var address = response.context.address
              bot.sendMessage(chatId, "Dammi un attimo per favore....;-)");
              alchemyFacesCallback(address).then(function(message){ defer.resolve(message)})
          } 
          else {
            // Display the output from dialog, if any.
            if (response.output.text.length != 0) {
                myresp = response.output.text[0]
            }
            defer.resolve(myresp)
          }
}
function sendMessageToWatsonAndProcessIt(newMessageFromUser,chatId,user){    
    var defer = Q.defer()
    var myresp = " "
      
    //Sending message for Dialog.....
    conversation.message({
      input: { text: newMessageFromUser },
      // Send back the context to maintain state.
      context : user.response ? user.response.context : null
    }, function(err,response){ processResponse(err,response,defer,myresp,user,chatId)})
    return defer.promise
}

var hashcode = 'axsdfgtg21'
var users = []


// On commands
bot.on(['/start'], msg => {

  log.info('start...........')
  User.findOne({chatId:msg.from.id}).then(function(myuser){
        if (myuser) return  bot.sendMessage(msg.from.id, 'Bentornato');
        // /start email:name:hashcode

        if (msg.text.length < 7) return bot.sendMessage(msg.from.id, "Ops! non sei registrato!");
        var code = unescape(msg.text).substring(7)
        var ar = _.split(code,':')
        log.info(ar)
        User.findOne({email:ar[0]}).then(function(user){
          if (user != null)
            return bot.sendMessage(msg.from.id, 'Bentornato ' + ar[1] + "!");
          else if (user == null && ar[2] == hashcode){
              var u = new User({name:ar[1],chatId:msg.from.id, response:"{}", email:ar[0]})
              u.save()
              //non importa: posso dare il messaggio anche se il save è asincrono....
              bot.sendMessage(msg.from.id, 'Benvenuto ' + ar[1] + "!");
              return bot.sendPhoto(msg.from.id, 'steve.png')
          }
          return bot.sendMessage(msg.from.id, "Ops! non sei registrato!");
          })
  })
})

//********************************************** */
// On Text
bot.on(['text'], msg => {
   
  if (msg.text.startsWith("\/start")){
    log.info('....captured')
    return
  }
    var chatId = msg.from.id
    var user = _.find(users,function(u){
      return u.chatId == chatId
    })
    if (user == null){
      User.findOne({chatId:chatId}).then(function(myuser){
        user = myuser._doc
        users.push(user)
        sendMessageToWatsonAndProcessIt(msg.text,chatId,user).then(function(response){
          return bot.sendMessage(chatId, response);
        })
      })
    }
    else{
      let parse = "Markdown"
      sendMessageToWatsonAndProcessIt(msg.text,chatId,user).then(function(response){
          return bot.sendMessage(chatId, response, {parse});
      })
    }
})
bot.connect();

//********************************************** */

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
        if (minute != '00')
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

/*
const TeleBot = require('telebot');
const bot = new TeleBot('206517901:AAHl1xImPUQZI-HOulXqHt3a1PStaPEslT8');

// On commands
bot.on(['/start', '/back'], msg => {
  
  let markup = bot.keyboard([
    ['/buttons', '/inlineKeyboard'],
    ['/start','/hide']
  ], { resize: true });
  
  return bot.sendMessage(msg.from.id, 'Keyboard example.', { markup });

});

// Buttons
bot.on('/buttons', msg => {

  let markup = bot.keyboard([
    [bot.button('contact', 'Invia Contatto'), bot.button('location', 'Invia Posizione')],
    ['/back', '/hide']
  ], { resize: true });

  return bot.sendMessage(msg.from.id, 'Button example.', { markup });

});

// Hide keyboard
bot.on('/hide', msg => {
  return bot.sendMessage(
    msg.from.id, 'Hide keyboard example. Type /back to show.', { markup: 'hide' }
  );
});

// On location on contact message
bot.on(['location', 'contact'], (msg, self) => {
  return bot.sendMessage(msg.from.id, `Thank you for ${ self.type }.`);
});

// Inline buttons
bot.on('/inlineKeyboard', msg => {

  let markup = bot.inlineKeyboard([
    [
      bot.inlineButton('callback', { callback: 'this_is_data' }),
      bot.inlineButton('inline', { inline: 'some query' })
    ], [
      bot.inlineButton('url', { url: 'https://telegram.org' })
    ]
  ]);

  return bot.sendMessage(msg.from.id, 'Inline keyboard example.', { markup });

});

// Inline button callback
bot.on('callbackQuery', msg => {
  // User message alert
  return bot.sendMessage(msg.from.id, `Inline button callback: ${ msg.data}`);
  //return bot.answerCallback(msg.id, `Inline button callback: ${ msg.data }`, true);
});

// Inline query
bot.on('inlineQuery', msg => {

  const query = msg.query;
  const answers = bot.answerList(msg.id);

  answers.addArticle({
    id: 'query',
    title: 'Inline Query',
    description: `Your query: ${ query }`,
    message_text: 'Click!'
  });

  return bot.answerQuery(answers);

});

bot.connect();


*/

/*
// Setup polling way 
var bot = new TelegramBot(token, {polling: true});
var users = [{name:"claudio",id:"301563941", response:"", email:"claudio.digiovanni@gmail.com",enabled:true}]

// Attach event on every received message 
bot.on('message', function (message) {
  var chatId = message.chat.id;
  var user = _.find(users,function(u){
      return u.id == chatId
    })

  if (user == null)
    bot.sendMessage(chatId, "Ops! non sei registrato! Per favore scrivi il tuo indirizzo email. Thanks ;-)");
  else{
    sendMessageToWatsonAndProcessIt(message.text,chatId).then(function(response){
      bot.sendMessage(chatId, response);
    })
  }

});

*/