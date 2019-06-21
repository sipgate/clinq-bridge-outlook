#!/bin/bash

KEY=$(cat token); // expecting access_token:refresh_token in file ./token
curl 'http://localhost:8080/contacts' -H 'X-Provider-Key: $KEY'
