var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ValidationError = require('./../errors').ValidationError;

var FloodEntrySchema = new Schema({
  target_id: {type: String, required: true},
  type: {type: String, required: true},
  timestamp: {type: Date, required: true},
  expires: {type: Date, required: true},
});

// Expire Flood Entries based on expires field.
FloodEntrySchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

/**
 * Create a flood entry.
 *
 * @param  {object} fields
 *   Requires the target_id and type fields. Optionally provide a timestamp.
 * @param  {int} expireInMinutes
 *   Specify the number of minutes before the entry should be expired by Mongo
 */
FloodEntrySchema.static('create', function(fields, expiresInMinutes, cb) {
  if (fields.timestamp === undefined) {
    fields.timestamp = new Date();
  }
  fields.expires = new Date();
  fields.expires.setMinutes(fields.expires.getMinutes() + expiresInMinutes);

  var entry = new FloodEntryModel(fields);
  entry.save(cb);
});

/**
 * Retrieve the count of active flood events by type and target.
 */
FloodEntrySchema.static('count', function(fields, cb) {
  FloodEntryModel.where(fields).count(cb);
});

mongoose.model('flood_entry', FloodEntrySchema);

var FloodEntryModel = mongoose.model('flood_entry');
module.exports = FloodEntryModel;
