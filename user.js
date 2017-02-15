var mongoose = require('mongoose');
var Schema = mongoose.Schema;




// create a schema
var userSchema = new Schema({
  chatId: { type: String, required: false },
  email: { type: String, required: false  },
  response: { type: String, required: false },
  enabled: { type: Boolean},
  nome: { type: String, required: false },
  phoneNumber: { type: String, required: false },
  created_at: Date,
  updated_at: Date
});



// the schema is useless so far
// we need to create a model using it
var User = mongoose.model('User', userSchema);

// make this available to our users in our Node applications
module.exports = User;