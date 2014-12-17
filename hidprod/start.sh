#!/bin/bash

rm -frv /data/contactsid_auth/mongo{1,2,3}; fig rm -v --force; fig up $@
