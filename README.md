#Performance Recommendation Client
Use this code to check the performance recommendation API

run ```node client.js``` to see examples of valid command lines

Assuming the docker server is hooked up to amsnov02, you can run:
```
node index.js status -a simon -h http://amsnov02:8080 -k simonrocks
```
This should be forwarded to (e.g.) amsnov01:8083
