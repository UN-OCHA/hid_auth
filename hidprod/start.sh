#!/bin/bash

fig rm -v --force; rm -frv /Volumes/data/contactsid_auth/mongo{1,2,3}; fig up $@
