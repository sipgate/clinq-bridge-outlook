#!/bin/bash

KEY=$(cat token);
curl 'http://localhost:8080/contacts' -H "X-Provider-Key: $KEY"
