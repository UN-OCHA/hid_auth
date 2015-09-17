var bcrypt = require('bcrypt');
var crypto = require('crypto');
var escapeStringRegexp = require('escape-string-regexp');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ValidationError = require('./../errors').ValidationError;

var OAuthUsersSchema = new Schema({
  user_id: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  email_recovery: { type: String },
  hashed_password: { type: String, required: true },
  password_reset_token: { type: String },
  reset_token_expires: Date,
  name_given: String,
  name_family: String,
  authorized_services: Schema.Types.Mixed,
  active: Number,
  roles: [String],
  login_last: Date,
  reminded_verify: Number, // timestamp
  times_reminded_verify: Number // Number of times the user was reminded to verify his account
});

function hashPassword(password) {
  return bcrypt.hashSync(password, 11);
}

// Whether we should send a reminder to verify email to user
// Reminder emails are sent out 2, 4, 7 and 30 days after registration
OAuthUsersSchema.methods.shouldSendReminderVerify = function() {
  var created = this.user_id.replace(this.email + '_', '');
  var current = Date.now();
  if (this.active) {
    return false;
  }
  if (!this.reminded_verify && !this.times_reminded_verify && current.valueOf() - created > 48 * 3600 * 1000) {
    return true;
  }
  if (this.reminded_verify && this.times_reminded_verify == 1 && current.valueOf() - this.reminded_verify > 48 * 3600 * 1000) {
    return true;
  }
  if (this.reminded_verify && this.times_reminded_verify == 2 && current.valueOf() - this.reminded_verify > 72 * 3600 * 1000) {
    return true;
  }
  if (this.reminded_verify && this.times_reminded_verify == 3 && current.valueOf() - this.reminded_verify > 23 * 24 * 3600 * 1000) {
    return true;
  }
  return false;
};


OAuthUsersSchema.static('register', function(fields, cb) {
  var user;

  fields.hashed_password = hashPassword(fields.password);
  delete fields.password;

  fields.user_id = fields.email + '_' + Date.now();

  user = new OAuthUsersModel(fields);
  user.save(cb);
});

OAuthUsersSchema.static('getUser', function(email, password, cb) {
  OAuthUsersModel.authenticate(email, password, function(err, user) {
    if (err || !user) return cb(err);
    cb(null, user.email);
  });
});

OAuthUsersSchema.static('authenticate', function(email, password, cb) {
  this.findOne({email: new RegExp('^' + escapeStringRegexp(email) + '$', 'i')}, function(err, user) {
    if (err || !user) return cb(err);
    cb(null, bcrypt.compareSync(password, user.hashed_password) && user.active ? user : null);
  });
});

OAuthUsersSchema.methods.sanitize = function() {
  // Remove sensitive fields. The delete operator is not sufficient.
  var sanitized = this.toObject();
  sanitized.hashed_password = undefined;
  sanitized.email_recovery = undefined;
  sanitized._id = undefined;
  sanitized.__v = undefined;
  delete sanitized.hashed_password;
  delete sanitized.email_recovery;
  delete sanitized._id;
  delete sanitized.__v;
  return sanitized;
};

mongoose.model('users', OAuthUsersSchema);

var OAuthUsersModel = mongoose.model('users');
OAuthUsersModel.hashPassword = hashPassword;
module.exports = OAuthUsersModel;
