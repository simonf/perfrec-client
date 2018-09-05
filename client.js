const commandLineArgs = require('command-line-args')
const util = require('util')
var logger = require('./log')
var auth = require('./auth')
var Client = require('node-rest-client').Client
var client = new Client()

var usage = (msg) => {
  console.log(msg)
  console.log('\nUsage: node client.js <command> <options>')
  console.log('Commands:')
  console.log('\tstatus -a <appid> -h <host> -k <key>')
  console.log('\tsign -h <host> -k <key> -b <POST body> -p <path>')
  console.log('\tpost -a <appid> -h <host> -k <key> -s <service id> -w <bandwidth change>')
  console.log('\tget -a <appid> -h <host> -k <key> -r <recommendation id>')
  console.log('\nExamples:')
  console.log('node client.js status -a app1 -h http://localhost:8081 -k mykey')
  console.log('node client.js sign -a app1 -h http://localhost:8081 -k mykey -b \'\' -p /recommendation/1')
  console.log('node client.js sign -a app1 -h http://localhost:8081 -k mykey -b \'{service_id: "8001234",bandwidth_change: 20, action: "INCREASE_BANDWIDTH"}\' -p /recommendation/1')
  console.log('node client.js post -a app1 -h http://localhost:8081 -k mykey -s 8001234 -w -50')
  console.log('node client.js get -a app1 -h http://localhost:8081 -k mykey -r 22')
  process.exit()
}

var parseAndDispatch = () => {
  /* first - parse the main command */
  const mainDefinitions = [
    { name: 'command', defaultOption: true }
  ]
  const mainOptions = commandLineArgs(mainDefinitions, { stopAtFirstUnknown: true })
  const argv = mainOptions._unknown || []

  // console.log('mainOptions\n===========')
  // console.log(mainOptions)

  switch(mainOptions.command) {
    case 'status':  getStatus(argv)
                    break
    case 'sign':    postSign(argv)
                    break
    case 'post':    postRecommendation(argv)
                    break
    case 'get':     getRecommendation(argv)
                    break
    default:        usage()
  }
}

var validateOrDie = (options, name) => {
  if (!options[name]) usage('You must supply a ' + name)
  return options[name]
}

var sendSignedGet = (url, appid, sig) => {
  var args = {
    headers: { 
      'x-colt-app-id': appid,
      'x-colt-app-sig': sig
    }
  }
  return new Promise((resolve, reject) => {
      let req = client.get(url, args, (data, response) => {
//	  console.log(response)
      resolve(data)
      })
    req.on('error', (err) => {
      reject(err)
    })
  })
}

var sendSignedPost = (url, appid, sig, body) => {
  var args = {
    data: body,
    headers: { 
      'Content-Type': 'application/json',
      'x-colt-app-id': appid,
      'x-colt-app-sig': sig
    }
  }
  return new Promise((resolve, reject) => {
    let req = client.post(url, args, (data, response) => {
      resolve(data)
      })
    req.on('error', (err) => {
      reject(err)
    })
  })  
}

var pad2 = function(ival) {
	if (ival < 10) return '0' +ival
	else return '' + ival
}

var sign = (key, path, payload) => {
  logger.info('SIGNING body ' + payload)
  var body_sig = auth.signBody(payload, key)
  let dt = new Date()
  var hourstamp = '' +
                  dt.getUTCFullYear() +
                  pad2(dt.getUTCMonth()+1) +
                  pad2(dt.getUTCDate()) +
                  pad2(dt.getUTCHours())
  logger.info('SIGNING ' + hourstamp + ' with path ' + path + ' and hash ' + body_sig)
  var full_sig = auth.signBody(hourstamp+path+body_sig, key)
  logger.debug('Full sig: ' + full_sig)
  return full_sig
}

var postSign = (argv) => {
    const getStatusDefinitions = [
	{name: 'body', alias: 'b', type: String},
	{name: 'key', alias: 'k', type: String},
	{name: 'path', alias: 'p', type: String}
    ]

    const getStatusOptions = commandLineArgs(getStatusDefinitions,{ argv })
    var key = validateOrDie(getStatusOptions,'key')
    var body = getStatusOptions['body'] || ''
    var path = validateOrDie(getStatusOptions,'path')
    
    var signature = sign(key, path, body)
    console.log('-----------')
    console.log(signature)
}

var getStatus = (argv) => {
  const getStatusDefinitions = [
    {name: 'app_id', alias: 'a', type: String},
    {name: 'host_string', alias: 'h', type: String},
    {name: 'key', alias: 'k', type: String}
  ]

  const getStatusOptions = commandLineArgs(getStatusDefinitions,{ argv })
  var appid = validateOrDie(getStatusOptions, 'app_id')
  var host = validateOrDie(getStatusOptions, 'host_string')
  var key = validateOrDie(getStatusOptions,'key')
  
  var get_url = host + '/status'

  var signature = sign(key, '/status', '')

  sendSignedGet(get_url, appid, signature).then((response) => {
    console.log('---------------')
      console.log(response)
  }).catch((err) => {
    usage(err)
  })
}

var getRecommendation = (argv) => {
  const getRecDefinitions = [
    {name: 'app_id', alias: 'a', type: String},
    {name: 'host_string', alias: 'h', type: String},
    {name: 'key', alias: 'k', type: String},
    {name: 'recommendation_id', alias: 'r', type: Number}
  ]
  const getRecOptions = commandLineArgs(getRecDefinitions,{ argv })
  var appid = validateOrDie(getRecOptions, 'app_id')
  var host = validateOrDie(getRecOptions, 'host_string')
  var recid = validateOrDie(getRecOptions, 'recommendation_id')
  var key = validateOrDie(getRecOptions,'key')
  
  var get_url = host + '/recommendation/'+recid

  var signature = sign(key, '/recommendation/'+recid, '')

  sendSignedGet(get_url, appid, signature).then((response) => {
    console.log('---------------')
    console.log(response)
  }).catch((err) => {
    usage(err)
  })
}

var postRecommendation = (argv) => {
  const postRecDefinitions = [
    {name: 'app_id', alias: 'a', type: String},
    {name: 'host_string', alias: 'h', type: String},
    {name: 'key', alias: 'k', type: String},
    {name: 'service_id', alias: 's', type: String},
    {name: 'bw_change', alias: 'w', type: Number},
  ]
  const postRecOptions = commandLineArgs(postRecDefinitions,{ argv })
  var appid = validateOrDie(postRecOptions, 'app_id')
  var host = validateOrDie(postRecOptions, 'host_string')
  var key = validateOrDie(postRecOptions,'key')
  var svcid = validateOrDie(postRecOptions, 'service_id')
  var bwc = parseInt(validateOrDie(postRecOptions, 'bw_change'))
  var change_dir = bwc > 0 ? 'INCREASE_BANDWIDTH' : 'DECREASE_BANDWIDTH'
  
  var post_url = host + '/recommendation'

  var plaintext = {
      service_id: svcid,
      bandwidth_change: Math.abs(bwc),
      action: change_dir
  }

  var signature = sign(key, '/recommendation', plaintext)

  sendSignedPost(post_url, appid, signature, plaintext).then((response) => {
    console.log('---------------')
    console.log(response)
  }).catch((err) => {
    usage(err)
  })
}


parseAndDispatch()

