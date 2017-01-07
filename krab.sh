#!/bin/bash
directory=$(dirname "$BASH_SOURCE")
krabjs=$directory
krabjs+="/krab.js"
node "$krabjs" "$@"