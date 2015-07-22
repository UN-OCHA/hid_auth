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




/*
var async = require('async');

var floodCount = 0;

function createEntry(cb) {
  Flood.create({ type: 'test', target_id: 'A' }, 60, function(err, entry) {
    if (err || !entry) {
      console.error('Could not create flood entry')
      return cb(true);
    }
    else {
      console.log('Created new flood entry:');
      console.log(JSON.stringify(entry));
    }
    return cb();
  });
}

async.series([
  function (cb) {
    createEntry(cb);
  },
  function (cb) {
    createEntry(cb);
  },
  function (cb) {
    console.log('Counting flood entries:');
    Flood.count({type: 'test', target_id: 'A'}, function(err, count) {
      if (err) {
        return cb(true);
      }
      else {
        console.log(count);
        floodCount = count;
        return cb();
      }
    });
  },
  function (cb) {
    console.log('Finding all related flood entries.');
    Flood.find({type: 'test', target_id: 'A'}, function (err, entries) {
      if (!err && entries.length) {
        entries.forEach(function(item) {
          console.log(JSON.stringify(item));
          return item.remove(function(err, item) {
            if (err || !item) {
              console.error('Could not remove flood entry.');
              return cb(true);
            }
            else {
              console.log('Removed flood entry');
              return cb();
            }
          });
        });
      }
    });
  }
], function(err, results) {
  console.log('Flood Count from Middle of Test: ' + floodCount);
  console.log('Test Completed');
});
*/
