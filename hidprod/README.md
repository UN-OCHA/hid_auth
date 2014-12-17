# MongoDB Replica Set Testing Environment

## Bringing the environment up

To start this environment up, run `sh start.sh -d` to remove all old data and start the containers in the background.

That will get you the following containers:

- Instance name 'hidprod_mongo1_1' with hostname 'mongo1.contactsid.vm'
- Instance name 'hidprod_mongo2_1' with hostname 'mongo2.contactsid.vm'
- Instance name 'hidprod_mongo3_1' with hostname 'mongo3.contactsid.vm'
- Instance name 'hidprod_auth_1' with hostname 'auth.contactsid.vm'

## Starting the Mongo replSet

Startup of the Node applications will likely initially fail because the replica set has not yet been created. To bootstrap it, do the following:

- Connect to mongo on mongo1.contactsid.vm.
 - If you have MongoDB installed on your host machine, do a `mongo mongo1.contactsid.vm`.
 - Otherwise, a `docker exec -it hidprod_mongo1_1 mongo` should work to do so from the mongo1 container.
- Start the replSet with `rs.initiate()`.
- Add mongo2 as a full member with `rs.add('mongo2.contactsid.vm')`.
- Add mongo3 as an arbiter (dataless node used only to vote in quorum calculations) with `rs.addArb('mongo3.contactsid.vm')`.

At that point, you should have a fully-functioning replica set with 3 members.

When you connect to any node, it will show you its status (PRIMARY, SECONDARY, ARBITER, or STARTUP2 are the most common.)

Because the prod configuration is connecting to all 3 hosts, one of the data nodes can fail and the application with be uninterrupted.

You can also check the status of any of the nodes by running `rs.status()` from any of the machines in the replSet. Its output will look something like the following:

```
me@myhost$ mongo mongo1.contactsid.vm
MongoDB shell version: 2.6.6
connecting to: mongo1.contactsid.vm/test
hid:SECONDARY> rs.status()
{
        "set" : "hid",
        "date" : ISODate("2014-12-17T22:38:30Z"),
        "myState" : 2,
        "syncingTo" : "mongo2.contactsid.vm:27017",
        "members" : [
                {
                        "_id" : 0,
                        "name" : "mongo1.contactsid.vm:27017",
                        "health" : 1,
                        "state" : 2,
                        "stateStr" : "SECONDARY",
                        "uptime" : 393,
                        "optime" : Timestamp(1418855510, 1),
                        "optimeDate" : ISODate("2014-12-17T22:31:50Z"),
                        "self" : true
                },
                {
                        "_id" : 1,
                        "name" : "mongo2.contactsid.vm:27017",
                        "health" : 1,
                        "state" : 1,
                        "stateStr" : "PRIMARY",
                        "uptime" : 393,
                        "optime" : Timestamp(1418855510, 1),
                        "optimeDate" : ISODate("2014-12-17T22:31:50Z"),
                        "lastHeartbeat" : ISODate("2014-12-17T22:38:29Z"),
                        "lastHeartbeatRecv" : ISODate("2014-12-17T22:38:30Z"),
                        "pingMs" : 0
                },
                {
                        "_id" : 2,
                        "name" : "mongo3.contactsid.vm:27017",
                        "health" : 1,
                        "state" : 7,
                        "stateStr" : "ARBITER",
                        "uptime" : 393,
                        "lastHeartbeat" : ISODate("2014-12-17T22:38:29Z"),
                        "lastHeartbeatRecv" : ISODate("2014-12-17T22:38:29Z"),
                        "pingMs" : 0
                }
        ],
        "ok" : 1
}
```
