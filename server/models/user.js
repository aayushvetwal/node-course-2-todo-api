const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minLength: 1,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  tokens: [{
    access: {
      type: String,
      require: true
    },
    token: {
      type: String,
      require: true
    }
  }]
});

//instance method
UserSchema.methods.toJSON = function(){
  var user = this;
  var userObject = user.toObject(); //converts mongoose object to regular object where only properties available on document exists
  return _.pick(userObject, ['_id', 'email']);
}

//instance method
UserSchema.methods.generateAuthToken = function(){
  var user = this;
  var access = 'auth';
  var token = jwt.sign({_id: user._id.toHexString(), access}, '123abc').toString();

  user.tokens.push({access, token});

  return user.save().then(() => {
    return token;
  });
  //token is passed/returned as a success value to the next then call to be called in server.js file
};
//we used regular function instead of arrow function in the code above because arrow function doesn't bind 'this' keyword
//Here, we need 'this' keyword to access individual document.

//model method
UserSchema.statics.findByToken = function(token){
  var User = this;
  var decoded;

  try{
    decoded = jwt.verify(token, '123abc');
  } catch(e){
    // return new Promise((resolve, reject) => {
    //   reject();
    // });
    return Promise.reject();
  }

  return User.findOne({
    _id: decoded._id,
    'tokens.token': token,
    'tokens.access': 'auth'
  });
};

//model method
UserSchema.statics.findByCredentials = function(email, password){
  var User = this;
  return User.findOne({email}).then((user) => {
    if(!user){
      return Promise.reject();
    }

    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        if(res){
          resolve(user);
        } else{
          reject();
        }
      });
    });

  });
};

UserSchema.methods.removeToken = function(token){
  var user = this;

  return user.update({
    $pull:{
      tokens: {token}
    }
  });
};

UserSchema.pre('save', function(next){
  var user = this;

  if(user.isModified('password')){
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
})

var User = mongoose.model('User', UserSchema);

module.exports = {User};
