var Flood = require('./../models').FloodEntry;
var assert = require('assert');
var should = require('should');

describe('Flood System', function() {
  var floodCount = 0;

  it('should allow creation of Flood Entries', function(done) {
    Flood.create({ type: 'test', target_id: 'A' }, 60, function(err, entry) {
      entry.should.be.an.instanceOf(Flood);
      done();
    });
  });
  it('should allow creation of multiple entries for same type and target', function(done) {
    Flood.create({ type: 'test', target_id: 'A' }, 60, function(err, entry) {
      entry.should.be.an.instanceOf(Flood);
      done();
    });
  });
  it('should count the number of events by type and target', function(done) {
    Flood.count({type: 'test', target_id: 'A'}, function(err, count) {
      count.should.be.equal(2);
      floodCount = count;
      done();
    });
  });
  it('should find all flood events for type and target', function(done) {
    Flood.find({type: 'test', target_id: 'A'}, function (err, entries) {
      entries.length.should.be.equal(floodCount);
      done();
    });
  });
  it('should remove all flood events for type and target', function(done){
    Flood.remove({type: 'test', target_id: 'A'}, function(err, count) {
      count.should.be.equal(2);
      done();
    });
  });
  it('should not count any events after the purge', function(done) {
    Flood.count({type: 'test', target_id: 'A'}, function(err, count) {
      count.should.be.equal(0);
      done();
    });
  });
})
