#!/bin/bash

cd $NODE_APP_DIR

echo "==> Update npm"
npm install -g npm

echo "==> Installing npm dependencies"
npm install

echo "==> Starting the server"
exec npm start